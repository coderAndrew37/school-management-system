// @/lib/types/auth.ts
// Kibali Academy — Hybrid Role System
// Single source of truth for all role-related types

import { z } from "zod";

// ── Base Roles ───────────────────────────────────────────────
// Determines which dashboard/portal the user lands on.
// Stored in profiles.base_role (text) and synced to app_metadata.role.

export const BASE_ROLES = ["admin", "teacher", "parent", "support"] as const;
export type  BaseRole   = (typeof BASE_ROLES)[number];

// ── Admin Role IDs ───────────────────────────────────────────
// These are the *known* slugs seeded in admin_role_definitions.
// New roles created at runtime extend this list but TypeScript
// won't know about them — they're just `string` from the DB.
// We keep this const array for the UI select options for built-in roles.

export const SEEDED_ADMIN_ROLES = [
  "super_admin",
  "headteacher",
  "deputy_headteacher",
  "bursar",
  "dos",
  "school_doctor",
  "librarian",
] as const;
export type AdminRole = (typeof SEEDED_ADMIN_ROLES)[number] | string;

// ── Admin Role Definition (from admin_role_definitions table) ─
// This is the live, CRUD-managed catalog row. The UI reads these
// at runtime so new roles created by super admin appear immediately.

export interface AdminRoleDefinition {
  id:            string;          // slug PK: 'bursar', 'dos'
  label:         string;          // 'Bursar', 'Director of Studies'
  description:   string;
  allowed_paths: string[];        // route prefixes: ['/admin/fees', '/admin/finance']
  is_active:     boolean;
  sort_order:    number;
  created_at:    string;
  updated_at:    string;
}

// ── Static labels for seeded roles (UI fallback when DB not loaded) ─

export const SEEDED_ROLE_LABELS: Record<string, string> = {
  super_admin:        "Super Administrator",
  headteacher:        "Headteacher",
  deputy_headteacher: "Deputy Headteacher",
  bursar:             "Bursar",
  dos:                "Director of Studies",
  school_doctor:      "School Doctor",
  librarian:          "Librarian",
};

export const BASE_ROLE_LABELS: Record<BaseRole, string> = {
  admin:   "Administrator",
  teacher: "Teacher",
  parent:  "Parent / Guardian",
  support: "Support Staff",
};

// ── Profile ──────────────────────────────────────────────────

export interface Profile {
  id:          string;
  base_role:   BaseRole;
  admin_role:  string | null;      // FK to admin_role_definitions.id
  roles:       string[] | null;    // legacy multi-role array (kept for backward compat)
  full_name:   string | null;
  avatar_url:  string | null;
  teacher_id:  string | null;
  created_at:  string;
  updated_at:  string;
}

// ── StaffMember ──────────────────────────────────────────────
// Enriched with email (from auth.users via admin client) and
// optionally the full role definition.

export interface StaffMember {
  id:                   string;
  full_name:            string | null;
  avatar_url:           string | null;
  email:                string | null;
  base_role:            BaseRole;
  admin_role:           string | null;
  admin_role_definition: AdminRoleDefinition | null;  // joined when available
  roles:                string[] | null;
  created_at:           string;
  updated_at:           string;
}

// ── Role Statistics ──────────────────────────────────────────

export interface RoleStatistics {
  total:       number;
  byBaseRole:  Partial<Record<BaseRole, number>>;
  byAdminRole: Record<string, number>;
}

// ── Payloads for server actions ──────────────────────────────

export interface AssignRolePayload {
  targetUserId: string;
  base_role:    BaseRole;
  admin_role:   string | null;   // null = revoke admin title, keep base_role
  reason:       string;
}

export interface RoleDefinitionPayload {
  id:            string;          // slug (only for create)
  label:         string;
  description:   string;
  allowed_paths: string[];
  sort_order:    number;
}

// ── Auth ─────────────────────────────────────────────────────

export interface AuthUser {
  id:      string;
  email:   string;
  profile: Profile;
}

// ── Routes ───────────────────────────────────────────────────

export const CHOOSE_ROLE_ROUTE = "/auth/choose-role";

export const ROLE_ROUTES: Record<BaseRole, string> = {
  admin:   "/admin/dashboard",
  teacher: "/teacher/dashboard",
  parent:  "/parent/dashboard",
  support: "/support/dashboard",
};

// PROTECTED_PREFIXES controls base-role access (middleware layer 1).
// Admin sub-route access is controlled by admin_role allowed_paths (layer 2).
export const PROTECTED_PREFIXES: Record<string, BaseRole[]> = {
  "/admin":             ["admin"],
  "/admin/dashboard":   ["admin"],
  "/admin/students":    ["admin"],
  "/admin/admission":   ["admin"],
  "/admin/parents":     ["admin"],
  "/admin/teachers":    ["admin"],
  "/admin/reports":     ["admin"],
  "/admin/timetable":   ["admin", "teacher"],
  "/admin/allocation":  ["admin", "teacher"],
  "/admin/assessments": ["admin", "teacher"],
  "/admin/fees":        ["admin"],
  "/admin/finance":     ["admin"],
  "/admin/payments":    ["admin"],
  "/admin/health":      ["admin"],
  "/admin/library":     ["admin"],
  "/admin/curriculum":  ["admin"],
  "/admin/staff":       ["admin"],
  "/teacher":           ["teacher", "admin"],
  "/teacher/dashboard": ["teacher", "admin"],
  "/teacher/assess":    ["teacher", "admin"],
  "/parent":            ["parent"],
  "/parent/dashboard":  ["parent"],
  "/support":           ["support"],
};

// ── UserRole (backward compat with old triggers/middleware) ──
export type UserRole = BaseRole;

// ── Zod auth form schemas ─────────────────────────────────────

export const loginSchema = z.object({
  email:    z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8,           "Password must be at least 8 characters")
      .regex(/[A-Z]/,   "Must contain at least one uppercase letter")
      .regex(/[0-9]/,   "Must contain at least one number")
      .regex(/[^A-Za-z0-9]/, "Must contain at least one special character"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path:    ["confirmPassword"],
  });

export type LoginFormValues          = z.infer<typeof loginSchema>;
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormValues  = z.infer<typeof resetPasswordSchema>;