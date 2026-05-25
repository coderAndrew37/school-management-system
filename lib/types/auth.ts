// lib/types/auth.ts
// Kibali Academy — Domain-Action Permission System
// Single source of truth for all auth, role, and permission types.

import { z } from "zod";

// ── Base Roles ───────────────────────────────────────────────────────────────
// Determines which dashboard portal the user lands on.
// Stored in profiles.base_role and synced to app_metadata.role.

export const BASE_ROLES = ["admin", "teacher", "parent", "support"] as const;
export type BaseRole = (typeof BASE_ROLES)[number];

// ── Domain-Action Token System ───────────────────────────────────────────────
// Permission tokens are structured as: domain:subdomain:action
// e.g. "finance:fees:read", "academics:assessments:write", "people:students:delete"
//
// This is the canonical type for any permission token string used in the system.
// Tokens can be exact (finance:fees:read) or domain-level wildcards (finance:*).

export type PermissionToken = string & { readonly __brand: unique symbol };

// Known top-level domains in the application
export const PERMISSION_DOMAINS = [
  "finance",
  "academics",
  "people",
  "comms",
  "security",
  "system",
  "knec",
] as const;
export type PermissionDomain = (typeof PERMISSION_DOMAINS)[number];

// Known actions (used as the final segment of a token)
export const PERMISSION_ACTIONS = ["read", "write", "delete", "manage"] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

// ── Seeded Admin Role Slugs ──────────────────────────────────────────────────
// These are the known slugs seeded in admin_role_definitions.
// Runtime-created roles extend this list as plain strings.

export const SEEDED_ADMIN_ROLES = [
  "super_admin",
  "headteacher",
  "deputy_headteacher",
  "bursar",
  "dos",
  "school_doctor",
  "librarian",
] as const;
export type SeededAdminRole = (typeof SEEDED_ADMIN_ROLES)[number];
export type AdminRole = SeededAdminRole | string;

// ── Admin Role Definition (from admin_role_definitions table) ────────────────

export interface AdminRoleDefinition {
  id: string;
  label: string;
  description: string;
  allowed_paths: string[];
  // Baseline permission tokens that this role inherits by default
  baseline_permissions: string[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// ── Baseline Role Capability Map ─────────────────────────────────────────────
// Defines the fallback permission set for each seeded admin role.
// The hasPermission evaluator uses this when no override is present.

export const BASELINE_ROLE_CAPABILITIES: Record<string, readonly string[]> = {
  super_admin: ["*"], // Wildcard — bypasses all checks
  headteacher: [
    "finance:fees:read",
    "academics:assessments:read",
    "academics:assessments:write",
    "people:students:read",
    "people:teachers:read",
    "people:students:write",
    "comms:events:read",
    "comms:announcements:write",
    "system:settings:read",
    "knec:exports:read",
  ],
  deputy_headteacher: [
    "academics:assessments:read",
    "academics:assessments:write",
    "academics:classes:read",
    "academics:classes:write",
    "people:students:read",
    "people:teachers:read",
    "knec:exports:read",
    "comms:events:read",
  ],
  bursar: [
    "finance:fees:read",
    "finance:fees:write",
    "finance:payments:read",
    "finance:payments:write",
    "people:students:read",
  ],
  dos: [
    "academics:assessments:read",
    "academics:assessments:write",
    "academics:classes:read",
    "academics:analytics:read",
    "academics:heatmap:read",
    "people:students:read",
    "people:teachers:read",
    "knec:exports:read",
    "knec:exports:write",
  ],
  school_doctor: [
    "people:students:read",
    "system:health:read",
    "system:health:write",
  ],
  librarian: [
    "people:students:read",
    "system:library:read",
    "system:library:write",
  ],
} as const;

// ── JWT App Metadata Schema ──────────────────────────────────────────────────

export interface UserAppMetadata {
  provider?: string;
  providers?: string[];
  role: BaseRole;
  roles?: BaseRole[];
  admin_role?: string;
  admin_paths?: string[];
  // Effective, resolved permission token array flushed at login/sync time
  permissions?: string[];
  is_super_admin?: boolean;
}

// ── Profile (single source of truth from public.profiles) ───────────────────
// This maps directly to the database row. The two override arrays are the
// core of the Domain-Action permission evaluation pipeline.

export interface Profile {
  id: string;
  school_id: string | null;
  base_role: BaseRole;
  admin_role: string | null;
  roles: string[] | null;
  full_name: string | null;
  avatar_url: string | null;
  email?: string | null;
  phone_number?: string | null;
  teacher_id: string | null;
  is_super_admin: boolean;
  is_dev: boolean;
  created_at: string;
  updated_at: string;

  // ── Domain-Action Override Arrays ─────────────────────────────────────────
  // These columns live on public.profiles and drive the runtime permission engine.
  //
  // allowed_permissions_override: explicit grants that expand beyond baseline role.
  // denied_permissions_override:  explicit revocations that override everything.
  //
  // Evaluation priority: denied > allowed_override > baseline_role > deny
  allowed_permissions_override: string[] | null;
  denied_permissions_override: string[] | null;
}

// ── Enriched Staff Member ────────────────────────────────────────────────────

export interface StaffMember {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
  base_role: BaseRole;
  admin_role: string | null;
  admin_role_definition: AdminRoleDefinition | null;
  roles: string[] | null;
  is_super_admin: boolean;
  is_dev: boolean;
  created_at: string;
  updated_at: string;
}

// ── Role Statistics ──────────────────────────────────────────────────────────

export interface RoleStatistics {
  total: number;
  byBaseRole: Partial<Record<BaseRole, number>>;
  byAdminRole: Record<string, number>;
}

// ── Server Action Payloads ───────────────────────────────────────────────────

export interface AssignRolePayload {
  targetUserId: string;
  base_role: BaseRole;
  admin_role: string | null;
  reason: string;
}

export interface UpdatePermissionOverridesPayload {
  targetUserId: string;
  allowed_permissions_override: string[];
  denied_permissions_override: string[];
  reason: string;
}

export interface RoleDefinitionPayload {
  id: string;
  label: string;
  description: string;
  allowed_paths: string[];
  baseline_permissions: string[];
  sort_order: number;
}

// ── Auth Result ──────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  profile: Profile;
}

export interface AuthActionResult {
  success: boolean;
  message: string;
  redirectTo?: string;
  roles?: BaseRole[];
}

// ── Route Constants ──────────────────────────────────────────────────────────

export const CHOOSE_ROLE_ROUTE = "/auth/choose-role";
export const ACCESS_DENIED_ROUTE = "/admin/access-denied";

export const ROLE_ROUTES: Record<BaseRole, string> = {
  admin: "/admin/dashboard",
  teacher: "/teacher/dashboard",
  parent: "/parent/dashboard",
  support: "/support/dashboard",
};

// Maps route prefixes to the minimum base roles that may access them.
// This is the middleware Layer 1 check. Domain-action tokens are Layer 2.
export const PROTECTED_PREFIXES: Record<string, BaseRole[]> = {
  "/admin": ["admin"],
  "/teacher": ["teacher", "admin"],
  "/parent": ["parent"],
  "/support": ["support"],
};

// ── Static Labels ────────────────────────────────────────────────────────────

export const SEEDED_ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Administrator",
  headteacher: "Headteacher",
  deputy_headteacher: "Deputy Headteacher",
  bursar: "Bursar",
  dos: "Director of Studies",
  school_doctor: "School Doctor",
  librarian: "Librarian",
};

export const BASE_ROLE_LABELS: Record<BaseRole, string> = {
  admin: "Administrator",
  teacher: "Teacher",
  parent: "Parent / Guardian",
  support: "Support Staff",
};

// ── Zod Auth Form Schemas ────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Must contain at least one uppercase letter")
      .regex(/[0-9]/, "Must contain at least one number")
      .regex(/[^A-Za-z0-9]/, "Must contain at least one special character"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type LoginFormValues = z.infer<typeof loginSchema>;
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

// Legacy alias kept for backward compatibility with existing middleware
export type UserRole = BaseRole;