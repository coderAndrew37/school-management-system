// lib/types/auth.ts
// Kibali Academy — Domain-Action Permission System
// Single source of truth for all auth, role, and permission types.

import { z } from "zod";

// ── Base Roles ───────────────────────────────────────────────────────────────
// Determines which dashboard portal the user lands on.
// Matches the public.user_role enum exactly:
//   super_admin → full system control, all views
//   admin       → school admin staff (headteacher, bursar, DOS etc.) — admin portal with dynamic views
//   staff       → subject/class teachers — teacher portal
//   parent      → parents — parent portal
//   student     → students (future)

export const BASE_ROLES = ["super_admin", "admin", "staff", "parent", "student"] as const;
export type BaseRole = (typeof BASE_ROLES)[number];

// ── Domain-Action Token System ───────────────────────────────────────────────
// Permission tokens are structured as: domain:subdomain:action
// e.g. "finance:fees:read", "academics:assessments:write", "people:students:delete"

export type PermissionToken = string & { readonly __brand: unique symbol };

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

export const PERMISSION_ACTIONS = ["read", "write", "delete", "manage"] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

// ── Seeded Admin Role Slugs ──────────────────────────────────────────────────
// These are the known slugs seeded in admin_role_definitions.
// Runtime-created roles extend this list as plain strings.

export const SEEDED_ADMIN_ROLES = [
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
  id:                   string;
  label:                string;
  description:          string;
  allowed_paths:        string[];
  baseline_permissions: string[];
  is_active:            boolean;
  sort_order:           number;
  created_at:           string;
  updated_at:           string;
  school_id:            string;

}

// ── Baseline Role Capability Map ─────────────────────────────────────────────
// Client-side reference only. The authoritative source is admin_role_definitions
// in the database. This is used for UI hints and fallback rendering.

export const BASELINE_ROLE_CAPABILITIES: Record<string, readonly string[]> = {
  super_admin: ["*"],
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
  provider?:          string;
  providers?:         string[];
  base_role:          BaseRole; // The new structural source of truth
  accessible_portals?: string[]; // Array compiled by the trigger function: ['parent', 'staff', 'admin']
  admin_role?:        string;
  admin_paths?:       string[];
  permissions?:       string[];
  is_super_admin?:    boolean;
  is_dev?:            boolean;
  school_id?:         string;
  
  /** @deprecated Use base_role instead */
  role?:              BaseRole;
  /** @deprecated Use accessible_portals instead */
  roles?:             BaseRole[];
}

// ── Profile (maps directly to public.profiles row) ───────────────────────────

export interface Profile {
  id:                           string;
  school_id:                    string | null;
  base_role:                    BaseRole;
  admin_role:                   string | null;
  roles:                        string[] | null;
  full_name:                    string | null;
  avatar_url:                   string | null;
  email?:                       string | null;
  phone_number?:                string | null;
  teacher_id:                   string | null;
  is_super_admin:               boolean;
  is_dev:                       boolean;
  created_at:                   string;
  updated_at:                   string;
  allowed_permissions_override: string[] | null;
  denied_permissions_override:  string[] | null;
}

// ── Enriched Staff Member ────────────────────────────────────────────────────

export interface StaffMember {
  id:                    string;
  full_name:             string | null;
  avatar_url:            string | null;
  email:                 string | null;
  base_role:             BaseRole;
  admin_role:            string | null;
  admin_role_definition: AdminRoleDefinition | null;
  roles:                 string[] | null;
  is_super_admin:        boolean;
  is_dev:                boolean;
  created_at:            string;
  updated_at:            string;
}

// ── Role Statistics ──────────────────────────────────────────────────────────

export interface RoleStatistics {
  total:       number;
  byBaseRole:  Partial<Record<BaseRole, number>>;
  byAdminRole: Record<string, number>;
}

// ── Server Action Payloads ───────────────────────────────────────────────────

export interface AssignRolePayload {
  targetUserId: string;
  base_role:    BaseRole;
  admin_role:   string | null;
  reason:       string;
}

export interface UpdatePermissionOverridesPayload {
  targetUserId:                 string;
  allowed_permissions_override: string[];
  denied_permissions_override:  string[];
  reason:                       string;
}

export interface RoleDefinitionPayload {
  id:                   string;
  label:                string;
  description:          string;
  allowed_paths:        string[];
  baseline_permissions: string[];
  sort_order:           number;
}

// ── Auth Result ──────────────────────────────────────────────────────────────

export interface AuthUser {
  id:      string;
  email:   string;
  profile: Profile;
}

export interface AuthActionResult {
  success:     boolean;
  message:     string;
  redirectTo?: string;
  roles?:      BaseRole[];
}

// ── Route Constants ──────────────────────────────────────────────────────────

export const CHOOSE_ROLE_ROUTE  = "/auth/choose-role";
export const ACCESS_DENIED_ROUTE = "/admin/access-denied";

// Where each base role lands after login
export const ROLE_ROUTES: Record<BaseRole, string> = {
  super_admin: "/admin/dashboard",
  admin:       "/admin/dashboard",
  staff:       "/teacher/dashboard",
  parent:      "/parent/dashboard",
  student:     "/student/dashboard",
};

// Maps route prefixes to the base roles that may access them.
// Layer 1 middleware check. Domain-action tokens are Layer 2+.
export const PROTECTED_PREFIXES: Record<string, BaseRole[]> = {
  "/admin":   ["admin", "super_admin"],
  "/teacher": ["staff"],
  "/parent":  ["parent"],
  "/student": ["student"],
};

// ── Static Labels ────────────────────────────────────────────────────────────

export const SEEDED_ROLE_LABELS: Record<string, string> = {
  headteacher:        "Headteacher",
  deputy_headteacher: "Deputy Headteacher",
  bursar:             "Bursar",
  dos:                "Director of Studies",
  school_doctor:      "School Doctor",
  librarian:          "Librarian",
};

export const BASE_ROLE_LABELS: Record<BaseRole, string> = {
  super_admin: "Super Administrator",
  admin:       "Administrator",
  staff:       "Teacher / Staff",
  parent:      "Parent / Guardian",
  student:     "Student",
};

// ── Zod Auth Form Schemas ────────────────────────────────────────────────────

export const loginSchema = z.object({
  email:    z.string().email("Enter a valid email address"),
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
    path:    ["confirmPassword"],
  });

export type LoginFormValues         = z.infer<typeof loginSchema>;
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormValues  = z.infer<typeof resetPasswordSchema>;

// ── Legacy alias ─────────────────────────────────────────────────────────────
// Kept for backward compatibility with middleware import
export type UserRole = BaseRole;