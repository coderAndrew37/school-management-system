// lib/actions/auth-utils.ts
// Kibali Academy — Auth & Permission Helpers
//
// This single file covers two related but distinct concerns:
//
//   1. Portal/role resolution (resolveAllRoles, resolvePrimaryRole)
//      `profiles.roles` is a legacy column being phased out. The single
//      source of truth for "what portals can this user reach" is:
//        - profiles.base_role   (single canonical role, DB)
//        - JWT app_metadata.accessible_portals (superset, computed by
//          sync_user_jwt_claims from teacher_id / staff_role_assignments)
//      These operate ONLY on base_role + accessible_portals + is_super_admin.
//
//   2. Domain-action permission evaluation (isSuperAdmin, isAdmin,
//      hasPermission, hasAnyPermission, hasAllPermissions,
//      resolveEffectivePermissions)
//      Core evaluation pipeline for the three-layer permission system:
//        1. Super-Admin bypass  →  full access, no further checks
//        2. Denied override     →  explicit block, always wins
//        3. Allowed override    →  explicit grant, expands past baseline
//        4. Baseline role       →  default capabilities for this admin_role
//        5. Default deny        →  everything else is blocked
//      Domain-action matching supports both exact tokens ("finance:fees:read")
//      and wildcard segments ("finance:*" or "finance:fees:*").

import {
  ROLE_PRIORITY,
  toBaseRoleArray,
  BASELINE_ROLE_CAPABILITIES,
  type BaseRole,
  type Profile,
} from "@/lib/types/auth";

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1 — Portal / Role Resolution (base_role + accessible_portals)
// ═══════════════════════════════════════════════════════════════════════════

export interface RoleResolutionFragment {
  base_role?: string | null;
  accessible_portals?: readonly string[] | null;
  is_super_admin?: boolean | null;
}

/**
 * Compiles a prioritized, deduplicated array of all BaseRoles linked to this account.
 * Always includes base_role even if accessible_portals is empty or missing.
 * Sorted by ROLE_PRIORITY: super_admin → admin → staff → parent → student
 */
export function resolveAllRoles(
  p: RoleResolutionFragment | null | undefined
): BaseRole[] {
  if (!p) return ["parent"];

  const collected = new Set<BaseRole>();

  const baseRole = toBaseRoleArray([p.base_role])[0];
  if (baseRole) collected.add(baseRole);

  for (const r of toBaseRoleArray(p.accessible_portals)) {
    collected.add(r);
  }

  if (p.is_super_admin === true) {
    collected.add("super_admin");
  }

  if (collected.size === 0) return ["parent"];

  return ROLE_PRIORITY.filter((role) => collected.has(role));
}

/**
 * Resolves the single primary BaseRole for portal routing purposes.
 * Enforces strict prioritization sequence: super_admin → admin → staff → parent → student
 */
export function resolvePrimaryRole(
  p: RoleResolutionFragment | null | undefined
): BaseRole {
  const all = resolveAllRoles(p);
  return all[0] ?? "parent";
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2 — Domain-Action Permission Evaluator
// ═══════════════════════════════════════════════════════════════════════════

// ── Internal fragment type ────────────────────────────────────────────────────
// Used broadly across helpers that accept either a full Profile or a JWT
// app_metadata fragment (e.g. from session.user.app_metadata).

export interface ProfileOrMetadataFragment {
  base_role?: string | null;
  admin_role?: string | null;
  role?: string | null;
  admin_paths?: string[] | null;
  permissions?: string[] | null;
  is_super_admin?: boolean | null;
  is_dev?: boolean | null;
}

// ── Token Matching ────────────────────────────────────────────────────────────

/**
 * Checks whether a single candidate token in the user's permission set
 * satisfies a required permission token.
 *
 * Matching rules (in order):
 * - Wildcard `"*"` candidate → matches everything.
 * - Exact match → "finance:fees:read" satisfies "finance:fees:read".
 * - Domain wildcard → "finance:*" satisfies "finance:fees:read".
 * - Subdomain wildcard → "finance:fees:*" satisfies "finance:fees:read".
 *
 * @param candidateToken  The token held by the user (e.g., "finance:*")
 * @param requiredToken   The token required by the resource (e.g., "finance:fees:read")
 */
function tokenMatchesRequired(
  candidateToken: string,
  requiredToken: string
): boolean {
  // Global wildcard — super-admin bypass at token level
  if (candidateToken === "*") return true;

  // Exact match
  if (candidateToken === requiredToken) return true;

  // Wildcard suffix matching — split and compare segment by segment
  const candidateParts = candidateToken.split(":");
  const requiredParts = requiredToken.split(":");

  // Candidate must not be longer than required (can't be more specific than the target)
  if (candidateParts.length > requiredParts.length) return false;

  for (let i = 0; i < candidateParts.length; i++) {
    const c = candidateParts[i];
    const r = requiredParts[i];

    // A trailing "*" wildcard segment matches everything at this depth and beyond
    if (c === "*") return true;

    // Segment mismatch — no match
    if (c !== r) return false;
  }

  // All candidate segments matched — but only if candidate matches structural depth
  // (otherwise e.g. a raw standalone "finance" token would match "finance:fees:read")
  return candidateParts.length === requiredParts.length || candidateParts[candidateParts.length - 1] === "*";
}

/**
 * Checks whether any token in a token array matches the required permission.
 */
function arrayGrantsPermission(
  tokenArray: string[] | null | undefined,
  requiredPermission: string
): boolean {
  if (!tokenArray || tokenArray.length === 0) return false;
  return tokenArray.some((t) => tokenMatchesRequired(t, requiredPermission));
}

// ── Super Admin Detection ─────────────────────────────────────────────────────

/**
 * Returns true if this profile has unconditional system-wide access.
 * A user is considered super-admin if:
 * - profile.is_super_admin is explicitly true, OR
 * - their admin_role is "super_admin", OR
 * - their base_role is "super_admin", OR
 * - their JWT permissions include the global wildcard "*".
 */
export function isSuperAdmin(
  p: ProfileOrMetadataFragment | null | undefined
): boolean {
  if (!p) return false;

  if (p.is_super_admin === true) return true;

  const resolvedRole = p.base_role ?? p.role;
  if (resolvedRole === "super_admin" || p.admin_role === "super_admin") return true;

  if (p.permissions?.includes("*") || p.permissions?.includes("all_permissions")) {
    return true;
  }

  return false;
}

/**
 * Returns true if the profile has the "admin" base_role portal access.
 */
export function isAdmin(
  p: ProfileOrMetadataFragment | null | undefined
): boolean {
  if (!p) return false;
  const resolvedRole = p.base_role ?? p.role;
  return resolvedRole === "admin" || resolvedRole === "super_admin";
}

// ── Core Domain-Action Evaluator ──────────────────────────────────────────────

/**
 * Evaluates whether a profile has access to a required domain-action token.
 *
 * Accepts the full Profile type (server-side, live DB data) or the lighter
 * ProfileOrMetadataFragment (client-side, from JWT app_metadata).
 *
 * Evaluation order:
 * 1. Super Admin bypass   → immediately return true
 * 2. Denied override     → if any token in denied_permissions_override matches, return false
 * 3. Allowed override    → if any token in allowed_permissions_override matches, return true
 * 4. Baseline role caps  → check BASELINE_ROLE_CAPABILITIES for this admin_role
 * 5. Default deny        → return false
 *
 * @param profile   The resolved profile row (live DB) or JWT metadata fragment
 * @param required  The domain-action token to check, e.g. "finance:fees:read"
 */
export function hasPermission(
  profile: Profile | ProfileOrMetadataFragment | null | undefined,
  required: string
): boolean {
  if (!profile) return false;

  // ── Layer 1: Super Admin bypass ───────────────────────────────────────────
  if (isSuperAdmin(profile)) return true;

  // Type safe checks distinguishing full Profile from an app_metadata token fragment
  const isFullProfile = "denied_permissions_override" in profile && "allowed_permissions_override" in profile;

  let deniedTokens: string[] | null = null;
  let allowedTokens: string[] | null = null;
  let jwtPermissions: string[] | null = null;

  if (isFullProfile) {
    const fullProfile = profile as Profile;
    deniedTokens = fullProfile.denied_permissions_override ?? null;
    allowedTokens = fullProfile.allowed_permissions_override ?? null;
  } else {
    const fragment = profile as ProfileOrMetadataFragment;
    jwtPermissions = fragment.permissions ?? null;
    // Note: client token fragments do not carry separate denied lists;
    // exclusions are pre-computed during JWT synchronization steps.
  }

  // ── Layer 2: Explicit denial (denied_permissions_override wins always) ────
  if (deniedTokens && arrayGrantsPermission(deniedTokens, required)) {
    return false;
  }

  // ── Layer 3: Explicit grant (allowed_permissions_override) ────────────────
  if (allowedTokens && arrayGrantsPermission(allowedTokens, required)) {
    return true;
  }

  // ── Layer 3b: JWT permissions array (fallback for client-side / stateless checks) ─
  if (jwtPermissions && arrayGrantsPermission(jwtPermissions, required)) {
    return true;
  }

  // ── Layer 4: Baseline role capabilities ──────────────────────────────────
  const adminRole =
    (profile as Profile).admin_role
      ?? (profile as ProfileOrMetadataFragment).admin_role
      ?? (profile as ProfileOrMetadataFragment).role
      ?? null;

  if (adminRole) {
    const baseline = BASELINE_ROLE_CAPABILITIES[adminRole];
    if (baseline && arrayGrantsPermission([...baseline], required)) {
      return true;
    }
  }

  // ── Layer 5: Default deny ─────────────────────────────────────────────────
  return false;
}

/**
 * Convenience: returns true if the profile has at least one of the given tokens.
 */
export function hasAnyPermission(
  profile: Profile | ProfileOrMetadataFragment | null | undefined,
  required: string[]
): boolean {
  return required.some((r) => hasPermission(profile, r));
}

/**
 * Convenience: returns true if the profile has every one of the given tokens.
 */
export function hasAllPermissions(
  profile: Profile | ProfileOrMetadataFragment | null | undefined,
  required: string[]
): boolean {
  return required.every((r) => hasPermission(profile, r));
}

/**
 * Computes the full effective permission set for a profile by running
 * baseline role capabilities through the override pipeline.
 *
 * Returns the resolved, deduplicated array of permission tokens this
 * user currently has access to. Used for database JWT claims synchronizations.
 */
export function resolveEffectivePermissions(profile: Profile): string[] {
  // Super admin inherits the absolute global wildcard token block
  if (isSuperAdmin(profile)) return ["*"];

  const adminRole = profile.admin_role;
  const baseline: string[] = adminRole
    ? [...(BASELINE_ROLE_CAPABILITIES[adminRole] ?? [])]
    : [];

  const allowed = profile.allowed_permissions_override ?? [];
  const denied = profile.denied_permissions_override ?? [];

  // Merge baseline role arrays with explicit individual grants
  const merged = new Set<string>([...baseline, ...allowed]);

  // Remove explicitly denied tokens (exact match checks for explicit targets)
  for (const token of denied) {
    merged.delete(token);

    // Also strip out any wildcard matches that fall under the umbrella of a denied rule
    for (const existing of merged) {
      if (tokenMatchesRequired(token, existing)) {
        merged.delete(existing);
      }
    }
  }

  return [...merged];
}