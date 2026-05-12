"use client";

// @/app/admin/staff/_components/RoleDefinitionsPanel.tsx
// Full CRUD for admin_role_definitions: create, edit, deactivate

import {
    createRoleDefinitionAction,
    deactivateRoleDefinitionAction,
    updateRoleDefinitionAction,
} from "@/lib/actions/role-management";
import {
    createRoleDefinitionSchema,
    updateRoleDefinitionSchema,
    type CreateRoleDefinitionFormValues,
    type UpdateRoleDefinitionFormValues,
} from "@/lib/schemas/role-schemas";
import type { AdminRoleDefinition } from "@/lib/types/auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, ChevronDown, ChevronUp, GripVertical, Pencil, Plus, PowerOff, X } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button, Field, Input, Modal, ModalHeader, Textarea } from "./UI";

// ── Deactivate confirmation ───────────────────────────────────

function DeactivateModal({ def, isOpen, onClose, onSuccess }: {
  def: AdminRoleDefinition | null; isOpen: boolean; onClose: () => void; onSuccess: () => void;
}) {
  const [reason,      setReason]      = useState("");
  const [submitting,  setSubmitting]  = useState(false);

  const handleClose = () => { setReason(""); onClose(); };

  const handleSubmit = async () => {
    if (!def || reason.trim().length < 5) {
      toast.error("Please provide a reason (at least 5 characters)"); return;
    }
    setSubmitting(true);
    const result = await deactivateRoleDefinitionAction(def.id, reason);
    setSubmitting(false);
    if (result.success) { toast.success(result.message); handleClose(); onSuccess(); }
    else toast.error(result.message);
  };

  if (!def) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <ModalHeader title="Deactivate Role" subtitle={def.label} onClose={handleClose} />
      <div className="px-6 py-5 space-y-5">
        <div className="flex gap-3 rounded-xl border border-orange-100 bg-orange-50/60 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
          <div className="text-sm text-orange-700 space-y-1">
            <p className="font-medium">Deactivating <strong>{def.label}</strong> will:</p>
            <ul className="list-disc list-inside space-y-0.5 text-xs">
              <li>Remove this title from all staff members currently assigned to it</li>
              <li>Make it unavailable for future assignments</li>
              <li>Not delete historical audit records</li>
            </ul>
          </div>
        </div>
        <Field label="Reason" required>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Role merged into Deputy Headteacher responsibilities" />
        </Field>
      </div>
      <div className="flex gap-3 px-6 pb-6">
        <Button type="button" variant="secondary" onClick={handleClose} className="flex-1">Cancel</Button>
        <Button type="button" variant="danger" loading={submitting} onClick={handleSubmit} className="flex-1">
          <PowerOff className="h-4 w-4" />
          {submitting ? "Deactivating…" : "Deactivate Role"}
        </Button>
      </div>
    </Modal>
  );
}

// ── Path list editor ──────────────────────────────────────────

function PathListEditor({ value, onChange, error }: {
  value: string[]; onChange: (v: string[]) => void; error?: string;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (!v.startsWith("/")) { toast.error("Path must start with /"); return; }
    if (value.includes(v)) { toast.error("Path already added"); return; }
    onChange([...value, v]);
    setDraft("");
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="/admin/fees"
          className="flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2 text-sm font-mono text-stone-900 placeholder:text-stone-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
        />
        <button type="button" onClick={add}
          className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-600 hover:bg-stone-50 transition-colors">
          Add
        </button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((p) => (
            <span key={p}
              className="inline-flex items-center gap-1 rounded-lg bg-stone-100 pl-2 pr-1 py-1 text-xs font-mono text-stone-700">
              {p}
              <button aria-label={`Remove ${p}`}
               type="button" onClick={() => onChange(value.filter((x) => x !== p))}
                className="rounded p-0.5 hover:bg-stone-200 transition-colors">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
    </div>
  );
}

// ── Create Modal ──────────────────────────────────────────────

function CreateRoleModal({ isOpen, onClose, onSuccess }: {
  isOpen: boolean; onClose: () => void; onSuccess: () => void;
}) {
  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } =
    useForm<CreateRoleDefinitionFormValues>({
      resolver: zodResolver(createRoleDefinitionSchema),
      defaultValues: { id: "", label: "", description: "", allowed_paths: [], sort_order: 100 },
    });

  const paths = watch("allowed_paths");
  const handleClose = () => { reset(); onClose(); };

  const onSubmit = async (data: CreateRoleDefinitionFormValues) => {
    const result = await createRoleDefinitionAction(data);
    if (result.success) { toast.success(result.message); handleClose(); onSuccess(); }
    else toast.error(result.message);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg">
      <ModalHeader title="Create New Role" subtitle="Add a new administrative title to the system" onClose={handleClose} />
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">

          <div className="grid grid-cols-2 gap-4">
            <Field label="Role ID (slug)" required error={errors.id?.message}
              hint="Lowercase, underscores only. Cannot be changed after creation.">
              <input {...register("id")}
                placeholder="sports_director"
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm font-mono text-stone-900 placeholder:text-stone-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40" />
              {errors.id && <p className="mt-1 text-xs text-red-500 font-medium">{errors.id.message}</p>}
            </Field>
            <Field label="Sort Order" hint="Lower = appears first in lists">
              <Input {...register("sort_order", { valueAsNumber: true })} type="number" min={1} max={9999}
                hasError={!!errors.sort_order} />
            </Field>
          </div>

          <Field label="Display Label" required error={errors.label?.message}>
            <Input {...register("label")} hasError={!!errors.label} placeholder="Sports Director" />
          </Field>

          <Field label="Description" error={errors.description?.message}>
            <Textarea {...register("description")} hasError={!!errors.description}
              placeholder="Brief description of this role's responsibilities" />
          </Field>

          <Field label="Allowed Route Prefixes" required
            error={errors.allowed_paths?.message as string | undefined}
            hint='Press Enter or click Add. Use "/admin" for full access.'>
            <PathListEditor
              value={paths}
              onChange={(v) => setValue("allowed_paths", v, { shouldValidate: true })}
              error={errors.allowed_paths?.message as string | undefined}
            />
          </Field>
        </div>

        <div className="flex gap-3 px-6 pb-6 border-t border-stone-100 pt-4">
          <Button type="button" variant="secondary" onClick={handleClose} className="flex-1">Cancel</Button>
          <Button type="submit" variant="primary" loading={isSubmitting} className="flex-1">
            <Plus className="h-4 w-4" />
            {isSubmitting ? "Creating…" : "Create Role"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Edit Modal ────────────────────────────────────────────────

function EditRoleDefModal({ def, isOpen, onClose, onSuccess }: {
  def: AdminRoleDefinition | null; isOpen: boolean; onClose: () => void; onSuccess: () => void;
}) {
  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } =
    useForm<UpdateRoleDefinitionFormValues>({
      resolver: zodResolver(updateRoleDefinitionSchema),
      values: def ? {
        label:         def.label,
        description:   def.description,
        allowed_paths: def.allowed_paths,
        sort_order:    def.sort_order,
        is_active:     def.is_active,
      } : undefined,
    });

  const paths    = watch("allowed_paths") ?? [];
  const isActive = watch("is_active");
  const handleClose = () => { reset(); onClose(); };

  const onSubmit = async (data: UpdateRoleDefinitionFormValues) => {
    if (!def) return;
    const result = await updateRoleDefinitionAction(def.id, data);
    if (result.success) { toast.success(result.message); handleClose(); onSuccess(); }
    else toast.error(result.message);
  };

  if (!def) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg">
      <ModalHeader title="Edit Role" subtitle={`ID: ${def.id}`} onClose={handleClose} />
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">

          <div className="grid grid-cols-2 gap-4">
            <Field label="Display Label" required error={errors.label?.message}>
              <Input {...register("label")} hasError={!!errors.label} />
            </Field>
            <Field label="Sort Order">
              <Input {...register("sort_order", { valueAsNumber: true })} type="number" min={1} max={9999} />
            </Field>
          </div>

          <Field label="Description" error={errors.description?.message}>
            <Textarea {...register("description")} hasError={!!errors.description} />
          </Field>

          <Field label="Allowed Route Prefixes" required
            hint='Changing paths immediately re-syncs middleware access for all users with this role.'
            error={errors.allowed_paths?.message as string | undefined}>
            <PathListEditor
              value={paths}
              onChange={(v) => setValue("allowed_paths", v, { shouldValidate: true })}
              error={errors.allowed_paths?.message as string | undefined}
            />
          </Field>

          {/* is_active toggle */}
          {def.id !== "super_admin" && (
            <div className="flex items-center justify-between rounded-xl border border-stone-100 bg-stone-50 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-stone-800">Active</p>
                <p className="text-xs text-stone-500">Inactive roles cannot be assigned to new users</p>
              </div>
              <button type="button"
                onClick={() => setValue("is_active", !isActive)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${isActive ? "bg-amber-500" : "bg-stone-300"}`}>
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${isActive ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-3 px-6 pb-6 border-t border-stone-100 pt-4">
          <Button type="button" variant="secondary" onClick={handleClose} className="flex-1">Cancel</Button>
          <Button type="submit" variant="primary" loading={isSubmitting} className="flex-1">
            {isSubmitting ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Main Panel ────────────────────────────────────────────────

interface RoleDefinitionsPanelProps {
  roleDefs:  AdminRoleDefinition[];
  onRefresh: () => void;
}

export function RoleDefinitionsPanel({ roleDefs, onRefresh }: RoleDefinitionsPanelProps) {
  const [expanded,    setExpanded]    = useState(false);
  const [creating,    setCreating]    = useState(false);
  const [editing,     setEditing]     = useState<AdminRoleDefinition | null>(null);
  const [deactivating, setDeactivating] = useState<AdminRoleDefinition | null>(null);

  const active   = roleDefs.filter((d) => d.is_active);
  const inactive = roleDefs.filter((d) => !d.is_active);

  return (
    <>
      <div className="rounded-2xl border border-stone-100 bg-white overflow-hidden">
        {/* Panel header */}
        <button type="button"
          onClick={() => setExpanded((p) => !p)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-stone-50 transition-colors text-left">
          <div>
            <h2 className="text-base font-semibold text-stone-900">Administrative Role Types</h2>
            <p className="mt-0.5 text-xs text-stone-500">
              {active.length} active role{active.length !== 1 ? "s" : ""}
              {inactive.length > 0 && ` · ${inactive.length} inactive`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button type="button"
              onClick={(e) => { e.stopPropagation(); setCreating(true); }}
              className="flex items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-amber-700 transition-colors shadow-sm shadow-amber-900/10">
              <Plus className="h-3.5 w-3.5" />
              New Role
            </button>
            {expanded ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
          </div>
        </button>

        {/* Definitions list */}
        {expanded && (
          <div className="border-t border-stone-100">
            {roleDefs.length === 0 ? (
              <p className="py-10 text-center text-sm text-stone-400">No role definitions found.</p>
            ) : (
              <div className="divide-y divide-stone-50">
                {roleDefs.map((def) => (
                  <div key={def.id}
                    className={`flex items-start gap-4 px-6 py-4 ${!def.is_active ? "opacity-50" : ""}`}>
                    <GripVertical className="h-4 w-4 text-stone-300 mt-1 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-stone-800">{def.label}</span>
                        <span className="font-mono text-xs text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded">{def.id}</span>
                        {!def.is_active && (
                          <span className="text-xs rounded-full bg-red-50 text-red-600 ring-1 ring-red-200 px-2 py-0.5 font-medium">Inactive</span>
                        )}
                      </div>
                      {def.description && (
                        <p className="mt-0.5 text-xs text-stone-500">{def.description}</p>
                      )}
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {def.allowed_paths.map((p) => (
                          <span key={p}
                            className="inline-flex items-center rounded bg-stone-100 px-1.5 py-0.5 text-xs font-mono text-stone-600">
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                    {def.id !== "super_admin" && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button type="button" title="Edit"
                          onClick={() => setEditing(def)}
                          className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {def.is_active && (
                          <button type="button" title="Deactivate"
                            onClick={() => setDeactivating(def)}
                            className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                            <PowerOff className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {!def.is_active && (
                          <button type="button" title="Re-activate by editing"
                            onClick={() => setEditing(def)}
                            className="rounded-lg p-1.5 text-stone-400 hover:bg-green-50 hover:text-green-600 transition-colors text-xs font-medium px-2">
                            Restore
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <CreateRoleModal   isOpen={creating}       onClose={() => setCreating(false)}      onSuccess={onRefresh} />
      <EditRoleDefModal  def={editing}     isOpen={!!editing}       onClose={() => setEditing(null)}      onSuccess={onRefresh} />
      <DeactivateModal   def={deactivating} isOpen={!!deactivating} onClose={() => setDeactivating(null)} onSuccess={onRefresh} />
    </>
  );
}