// @/lib/schemas/role-schemas.ts

import { z } from "zod";
import { BASE_ROLES } from "@/lib/types/auth";

// ── Assign / revoke a role to a user ─────────────────────────

export const assignRoleSchema = z
  .object({
    base_role:  z.enum(BASE_ROLES),
    // admin_role is a free text slug referencing admin_role_definitions.id
    // Empty string "" means "revoke admin title" (set to null)
    admin_role: z.string().nullable(),
    reason:     z
      .string()
      .min(5,   "Provide a reason (min 5 characters)")
      .max(500, "Reason must be under 500 characters"),
  })
  .superRefine((val, ctx) => {
    if (val.base_role === "admin" && !val.admin_role) {
      ctx.addIssue({
        code:    z.ZodIssueCode.custom,
        message: "An administrative title is required for admin accounts",
        path:    ["admin_role"],
      });
    }
    if (val.base_role !== "admin" && val.admin_role) {
      ctx.addIssue({
        code:    z.ZodIssueCode.custom,
        message: "Administrative title only applies to administrators",
        path:    ["admin_role"],
      });
    }
  });

export type AssignRoleFormValues = z.infer<typeof assignRoleSchema>;

// ── Create a new admin role definition ───────────────────────

const slugRegex = /^[a-z][a-z0-9_]*$/;

export const createRoleDefinitionSchema = z.object({
  id: z
    .string()
    .min(2,   "ID must be at least 2 characters")
    .max(64,  "ID must be under 64 characters")
    .regex(slugRegex, "ID must be lowercase letters, numbers and underscores only (e.g. sports_director)"),
  label: z
    .string()
    .min(2,  "Label must be at least 2 characters")
    .max(80, "Label must be under 80 characters"),
  description: z
    .string()
    .max(500, "Description must be under 500 characters")
    .default(""),
  allowed_paths: z
    .array(
      z.string()
        .startsWith("/", "Each path must start with /")
        .max(200, "Path too long")
    )
    .min(1, "At least one allowed path is required"),
  sort_order: z
    .number()
    .int()
    .min(1)
    .max(9999)
    .default(100),
});

export type CreateRoleDefinitionFormValues = z.infer<typeof createRoleDefinitionSchema>;

// ── Update an existing role definition ───────────────────────
// id is read-only after creation (it's the PK slug)

export const updateRoleDefinitionSchema = createRoleDefinitionSchema
  .omit({ id: true })
  .extend({
    is_active: z.boolean().default(true),
  });

export type UpdateRoleDefinitionFormValues = z.infer<typeof updateRoleDefinitionSchema>;