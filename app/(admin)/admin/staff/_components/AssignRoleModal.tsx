"use client";

// @/app/admin/staff/_components/AssignRoleModal.tsx

import { useForm }           from "react-hook-form";
import { zodResolver }       from "@hookform/resolvers/zod";
import { toast }             from "sonner";
import { ShieldCheck, Eye, ShieldOff } from "lucide-react";

import { assignRoleAction }                           from "@/lib/actions/role-management";
import { assignRoleSchema, type AssignRoleFormValues } from "@/lib/schemas/role-schemas";
import { BASE_ROLES, BASE_ROLE_LABELS }               from "@/lib/types/auth";
import type { AdminRoleDefinition, StaffMember }      from "@/lib/types/auth";

import { Modal, ModalHeader, Field, Select, Textarea, Button, Avatar, RoleBadge } from "./UI";

interface AssignRoleModalProps {
  user:        StaffMember | null;
  roleDefs:    AdminRoleDefinition[];   // active definitions, passed from server
  isOpen:      boolean;
  onClose:     () => void;
  onSuccess:   () => void;
}

export function AssignRoleModal({ user, roleDefs, isOpen, onClose, onSuccess }: AssignRoleModalProps) {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AssignRoleFormValues>({
    resolver: zodResolver(assignRoleSchema),
    values: {
      base_role:  user?.base_role  ?? "staff", // Changed from "teacher" to match the new BaseRole schema
      admin_role: user?.admin_role ?? null,
      reason:     "",
    },
  });

  const watchedBase  = watch("base_role");
  const watchedAdmin = watch("admin_role");

  // Find the live definition for the currently selected admin role
  const selectedDef = roleDefs.find((d) => d.id === watchedAdmin) ?? null;

  const handleClose = () => { reset(); onClose(); };

  const onSubmit = async (data: AssignRoleFormValues) => {
    if (!user) return;
    const result = await assignRoleAction({
      targetUserId: user.id,
      base_role:    data.base_role,
      admin_role:   data.base_role === "admin" ? (data.admin_role ?? null) : null,
      reason:       data.reason,
    });
    if (result.success) { toast.success(result.message); handleClose(); onSuccess(); }
    else toast.error(result.message);
  };

  if (!user) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <ModalHeader title="Edit Role" subtitle={user.full_name ?? user.id} onClose={handleClose} />

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="px-6 py-5 space-y-5">

          {/* Current state */}
          <div className="flex items-center gap-3 rounded-xl bg-stone-50 border border-stone-100 px-4 py-3">
            <Avatar id={user.id} name={user.full_name} src={user.avatar_url} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-stone-800 truncate">{user.full_name ?? "—"}</p>
              <p className="text-xs text-stone-400 truncate">{user.email ?? user.id}</p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <RoleBadge role={user.base_role} type="base" />
              {user.admin_role && (
                <RoleBadge
                  role={user.admin_role}
                  type="admin"
                  label={user.admin_role_definition?.label}
                />
              )}
            </div>
          </div>

          {/* Base Role */}
          <Field label="Base Role" required error={errors.base_role?.message}
            hint="Determines which portal and dashboard this person sees">
            <Select {...register("base_role")} hasError={!!errors.base_role}>
              {BASE_ROLES.map((r) => (
                <option key={r} value={r}>{BASE_ROLE_LABELS[r]}</option>
              ))}
            </Select>
          </Field>

          {/* Admin Role — only when base_role = admin */}
          {watchedBase === "admin" && (
            <Field label="Administrative Title" required error={errors.admin_role?.message}
              hint="Controls which admin sub-pages this person can access">
              <Select {...register("admin_role")} hasError={!!errors.admin_role}>
                <option value="">Select a title…</option>
                {roleDefs.map((def) => (
                  <option key={def.id} value={def.id}>{def.label}</option>
                ))}
              </Select>
            </Field>
          )}

          {/* Access preview — live from the definition */}
          {watchedBase === "admin" && selectedDef && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-blue-600">
                <Eye className="h-3.5 w-3.5" />
                Access Preview
              </div>
              {selectedDef.allowed_paths.length === 1 && selectedDef.allowed_paths[0] === "/admin" ? (
                <p className="text-xs text-blue-700 font-medium">Full admin access — all pages</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {selectedDef.allowed_paths.map((p) => (
                    <span key={p}
                      className="inline-flex items-center rounded-md bg-white px-2 py-0.5 text-xs font-mono text-blue-800 ring-1 ring-blue-200">
                      {p.replace("/admin/", "").replace("/admin", "dashboard")}
                    </span>
                  ))}
                </div>
              )}
              {selectedDef.description && (
                <p className="text-xs text-blue-600/70 italic">{selectedDef.description}</p>
              )}
            </div>
          )}

          {/* Revoke notice when switching away from admin */}
          {user.admin_role && watchedBase !== "admin" && (
            <div className="flex items-start gap-2.5 rounded-xl border border-orange-100 bg-orange-50/60 px-4 py-3">
              <ShieldOff className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
              <p className="text-xs text-orange-700">
                Changing base role will <strong>revoke</strong> the{" "}
                <strong>{user.admin_role_definition?.label ?? user.admin_role}</strong> administrative title.
              </p>
            </div>
          )}

          {/* Reason */}
          <Field label="Reason for Change" required error={errors.reason?.message}
            hint="Recorded in the audit log">
            <Textarea {...register("reason")} hasError={!!errors.reason}
              placeholder="e.g. Promoted to Deputy Headteacher following staff restructuring" />
          </Field>
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <Button type="button" variant="secondary" onClick={handleClose} className="flex-1">Cancel</Button>
          <Button type="submit" variant="primary" loading={isSubmitting} className="flex-1">
            <ShieldCheck className="h-4 w-4" />
            {isSubmitting ? "Saving…" : "Save Role"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}