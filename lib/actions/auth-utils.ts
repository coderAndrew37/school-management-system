// lib/services/auth-utils.ts
// Kibali Academy — Domain-Action Permission Evaluator
//
// Core evaluation pipeline for the three-layer permission system:
//   1. Super-Admin bypass  →  full access, no further checks
//   2. Denied override     →  explicit block, always wins
//   3. Allowed override    →  explicit grant, expands past baseline
//   4. Baseline role       →  default capabilities for this admin_role
//   5. Default deny        →  everything else is blocked
//
// Domain-action matching supports both exact tokens ("finance:fees:read")
// and wildcard domain segments ("finance:*" or "finance:fees:*").

import {
  BASE_ROLES,
  BASELINE_ROLE_CAPABILITIES,
  type BaseRole,
  type Profile,
} from "@/lib/types/auth";

// ── Internal fragment type ────────────────────────────────────────────────────
// Used broadly across helpers that accept either a full Profile or a JWT
// app_metadata fragment (e.g. from session.user.app_metadata).

export interface ProfileOrMetadataFragment {
  base_role?: string | null;
  admin_role?: string | null;
  roles?: string[] | null;
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
 *   - Wildcard `"*"` candidate → matches everything.
 *   - Exact match → "finance:fees:read" satisfies "finance:fees:read".
 *   - Domain wildcard → "finance:*" satisfies "finance:fees:read".
 *   - Subdomain wildcard → "finance:fees:*" satisfies "finance:fees:read".
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

  // Candidate must not be longer than required (can't be more specific)
  if (candidateParts.length > requiredParts.length) return false;

  for (let i = 0; i < candidateParts.length; i++) {
    const c = candidateParts[i];
    const r = requiredParts[i];

    // A trailing "*" wildcard segment matches everything at this depth and beyond
    if (c === "*") return true;

    // Segment mismatch — no match
    if (c !== r) return false;
  }

  // All candidate segments matched — but only if candidate == required in length
  // (otherwise e.g. "finance" would match "finance:fees:read")
  return candidateParts.length === requiredParts.length;
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
 *   - profile.is_super_admin is explicitly true, OR
 *   - their admin_role is "super_admin", OR
 *   - their JWT permissions include the global wildcard "*".
 */
export function isSuperAdmin(
  p: ProfileOrMetadataFragment | null | undefined
): boolean {
  if (!p) return false;

  if (p.is_super_admin === true) return true;

  const adminRole = p.admin_role ?? p.role;
  if (adminRole === "super_admin") return true;

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
  return p.base_role === "admin" || p.role === "admin";
}

// ── Role Resolution Helpers ───────────────────────────────────────────────────

/**
 * Resolves the single primary BaseRole for portal routing purposes.
 */
export function resolvePrimaryRole(
  p: ProfileOrMetadataFragment | null | undefined
): BaseRole {
  if (!p) return "parent";

  const b = (p.base_role ?? p.role) as BaseRole | undefined;
  if (b && (BASE_ROLES as readonly string[]).includes(b)) return b;

  const first = p.roles?.[0] as BaseRole | undefined;
  if (first && (BASE_ROLES as readonly string[]).includes(first)) return first;

  return "parent";
}

/**
 * Compiles a deduplicated array of all BaseRoles linked to this account.
 */
export function resolveAllRoles(
  p: ProfileOrMetadataFragment | null | undefined
): BaseRole[] {
  if (!p) return ["parent"];

  const set = new Set<BaseRole>();

  const b = (p.base_role ?? p.role) as BaseRole | undefined;
  if (b && (BASE_ROLES as readonly string[]).includes(b)) set.add(b);

  for (const r of p.roles ?? []) {
    if ((BASE_ROLES as readonly string[]).includes(r)) set.add(r as BaseRole);
  }

  return set.size > 0 ? [...set] : ["parent"];
}

// ── Core Domain-Action Evaluator ──────────────────────────────────────────────

/**
 * Evaluates whether a profile has access to a required domain-action token.
 *
 * Accepts the full Profile type (server-side, live DB data) or the lighter
 * ProfileOrMetadataFragment (client-side, from JWT app_metadata).
 *
 * Evaluation order:
 *   1. Super Admin bypass  → immediately return true
 *   2. Denied override     → if any token in denied_permissions_override matches, return false
 *   3. Allowed override    → if any token in allowed_permissions_override matches, return true
 *   4. Baseline role caps  → check BASELINE_ROLE_CAPABILITIES for this admin_role
 *   5. Default deny        → return false
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

  // For the full Profile type, use the direct DB column arrays.
  // For a JWT fragment, fall back to the permissions[] array from app_metadata.
  const denied = (profile as Profile).denied_permissions_override
    ?? (profile as ProfileOrMetadataFragment).permissions
       ?.filter(() => false); // fragments don't carry separate denied lists

  const allowed = (profile as Profile).allowed_permissions_override
    ?? null;

  // Resolve denied array (DB column takes priority over any fragment)
  const deniedTokens: string[] | null = "denied_permissions_override" in profile
    ? (profile as Profile).denied_permissions_override
    : null;

  const allowedTokens: string[] | null = "allowed_permissions_override" in profile
    ? (profile as Profile).allowed_permissions_override
    : null;

  // JWT fragment permissions array (used when full Profile isn't available)
  const jwtPermissions: string[] | null =
    !(("denied_permissions_override" in profile))
      ? ((profile as ProfileOrMetadataFragment).permissions ?? null)
      : null;

  // ── Layer 2: Explicit denial (denied_permissions_override wins always) ────
  if (arrayGrantsPermission(deniedTokens, required)) {
    return false;
  }

  // ── Layer 3: Explicit grant (allowed_permissions_override) ────────────────
  if (arrayGrantsPermission(allowedTokens, required)) {
    return true;
  }

  // ── Layer 3b: JWT permissions array (for client-side / lightweight checks) ─
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
 * user currently has access to. Used for JWT claims sync.
 */
export function resolveEffectivePermissions(profile: Profile): string[] {
  // Super admin gets the global wildcard
  if (isSuperAdmin(profile)) return ["*"];

  const adminRole = profile.admin_role;
  const baseline: string[] = adminRole
    ? [...(BASELINE_ROLE_CAPABILITIES[adminRole] ?? [])]
    : [];

  const allowed = profile.allowed_permissions_override ?? [];
  const denied = profile.denied_permissions_override ?? [];

  // Merge baseline + explicit grants
  const merged = new Set<string>([...baseline, ...allowed]);

  // Remove explicitly denied tokens (exact match only for the deny step)
  for (const token of denied) {
    merged.delete(token);
    // Also remove wildcard-matching tokens from the merged set
    for (const existing of merged) {
      if (tokenMatchesRequired(token, existing)) {
        merged.delete(existing);
      }
    }
  }

  return [...merged];
}