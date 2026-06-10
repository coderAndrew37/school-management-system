CREATE OR REPLACE FUNCTION public.sync_user_jwt_claims(p_profile_id UUID)
RETURNS VOID AS $$
DECLARE
    v_profile       RECORD;
    v_assignment    RECORD;
    v_permissions   TEXT[];
    v_allowed_paths TEXT[];
    v_portals       TEXT[];
    v_claims        JSONB;
BEGIN
    -- 1. Prevent concurrent race conditions/deadlocks
    IF NOT pg_try_advisory_xact_lock(hashtext(p_profile_id::text)) THEN
        RAISE WARNING '[sync_user_jwt_claims] Skipping execution to prevent deadlock for uid=%', p_profile_id;
        RETURN;
    END IF;

    -- 2. Safe profile extraction using base_role explicitly
    SELECT
        id,
        COALESCE(base_role::TEXT, 'staff') AS base_role,
        teacher_id,
        school_id,
        COALESCE(is_super_admin, false)    AS is_super_admin,
        COALESCE(is_dev, false)            AS is_dev
    INTO v_profile
    FROM public.profiles
    WHERE id = p_profile_id;

    IF NOT FOUND THEN
        RAISE WARNING '[sync_user_jwt_claims] profile not found for uid=%', p_profile_id;
        RETURN;
    END IF;

    -- 3. Load active staff assignment scopes safely
    BEGIN
        SELECT sra.role_id, ard.label, ard.allowed_paths
        INTO   v_assignment
        FROM   public.staff_role_assignments sra
        JOIN   public.admin_role_definitions ard
               ON  ard.id        = sra.role_id
               AND ard.school_id = sra.school_id
        WHERE  sra.profile_id = p_profile_id
          AND  sra.revoked_at IS NULL
        ORDER  BY sra.assigned_at DESC
        LIMIT  1;
    EXCEPTION WHEN OTHERS THEN
        v_assignment := NULL;
    END;

    -- 4. Gather authorized permissions tokens
    BEGIN
        SELECT array_agg(permission_id)
        INTO   v_permissions
        FROM   public.get_effective_permissions(p_profile_id);
    EXCEPTION WHEN OTHERS THEN
        v_permissions := ARRAY[]::TEXT[];
    END;

    v_permissions := COALESCE(v_permissions, ARRAY[]::TEXT[]);

    -- 5. Establish allowed paths array matrix
    IF v_profile.is_super_admin OR v_profile.is_dev THEN
        v_allowed_paths := ARRAY['/admin'];
    ELSIF v_assignment IS NOT NULL AND v_assignment.allowed_paths IS NOT NULL THEN
        v_allowed_paths := v_assignment.allowed_paths;
    ELSE
        v_allowed_paths := ARRAY['/admin/dashboard'];
    END IF;

    -- 6. BUILD MULTI-PORTAL ARRAY DYNAMICALLY (Using 'staff' instead of 'teacher')
    v_portals := ARRAY[v_profile.base_role];
    
    -- Condition A: If their base_role is 'parent' but they have a linked teacher_id, they are also staff
    IF v_profile.teacher_id IS NOT NULL AND NOT ('staff' = ANY(v_portals)) THEN
        v_portals := array_append(v_portals, 'staff');
    END IF;

    -- Condition B: If they have an active admin staff assignment, they gain admin portal access
    IF v_assignment IS NOT NULL OR v_profile.is_super_admin OR v_profile.is_dev THEN
        IF NOT ('admin' = ANY(v_portals)) THEN
            v_portals := array_append(v_portals, 'admin');
        END IF;
    END IF;

    -- 7. Construct meta payload cleanly
    v_claims := jsonb_build_object(
        'base_role',          v_profile.base_role,
        'school_id',          v_profile.school_id,
        'is_super_admin',     v_profile.is_super_admin,
        'is_dev',             v_profile.is_dev,
        'admin_role',         CASE WHEN v_assignment IS NOT NULL THEN v_assignment.role_id ELSE NULL END,
        'admin_label',        CASE WHEN v_assignment IS NOT NULL THEN v_assignment.label   ELSE NULL END,
        'admin_paths',        to_jsonb(v_allowed_paths),
        'permissions',        to_jsonb(v_permissions),
        'accessible_portals', to_jsonb(v_portals) -- Outputs e.g., ['parent', 'admin'] or ['staff', 'admin']
    );

    -- 8. Execute update wrapper
    BEGIN
        UPDATE auth.users
        SET    raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::JSONB) || v_claims
        WHERE  id = p_profile_id;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[sync_user_jwt_claims] Controlled rollback on raw_app_meta_data update for uid=%: %', 
            p_profile_id, SQLERRM;
    END;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;