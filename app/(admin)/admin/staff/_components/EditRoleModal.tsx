"use client";

import { updateRoleDefinitionAction } from "@/lib/actions/role-management";
import { UpdateRoleDefinitionFormValues, updateRoleDefinitionSchema } from "@/lib/schemas/role-schemas";
import { AdminRoleDefinition } from "@/lib/types/auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Modal, ModalHeader, Field, Input, Textarea, Button } from "./UI";
import { X } from "lucide-react";
import { useState, useEffect } from "react";

export default function EditRoleDefModal({
  def,
  isOpen,
  onClose,
  onSuccess,
}: {
  def: AdminRoleDefinition | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const form = useForm<UpdateRoleDefinitionFormValues>({
    resolver: zodResolver(updateRoleDefinitionSchema),
    defaultValues: {
      label: "",
      description: "",
      allowed_paths: [],
      sort_order: 100,
      is_active: true,
    },
  });

  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = form;

  const paths = watch("allowed_paths") ?? [];
  const isActive = watch("is_active") ?? true;

  // Populate form when opening with existing data
  useEffect(() => {
    if (isOpen && def) {
      reset({
        label: def.label,
        description: def.description ?? "",
        allowed_paths: Array.isArray(def.allowed_paths) ? def.allowed_paths : [],
        sort_order: typeof def.sort_order === "number" ? def.sort_order : 100,
        is_active: typeof def.is_active === "boolean" ? def.is_active : true,
      });
    }
  }, [def, isOpen, reset]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSubmit = (data: UpdateRoleDefinitionFormValues) => {
    if (!def) return;

    return updateRoleDefinitionAction(def.id, data).then((result) => {
      if (result.success) {
        toast.success(result.message);
        handleClose();
        onSuccess();
      } else {
        toast.error(result.message || "Failed to update role definition");
      }
    });
  };

  if (!def) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg">
      <ModalHeader 
        title="Edit Role Definition" 
        subtitle={`ID: ${def.id}`} 
        onClose={handleClose} 
      />

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Display Label" required error={errors.label?.message}>
              <Input {...register("label")} hasError={!!errors.label} />
            </Field>

            <Field label="Sort Order" required error={errors.sort_order?.message}>
              <Input
                {...register("sort_order", { valueAsNumber: true })}
                type="number"
                min={1}
                max={9999}
                hasError={!!errors.sort_order}
              />
            </Field>
          </div>

          <Field label="Description" error={errors.description?.message}>
            <Textarea {...register("description")} hasError={!!errors.description} />
          </Field>

          <Field
            label="Allowed Route Prefixes"
            required
            hint="Changing paths immediately re-syncs middleware access for all users with this role."
            error={errors.allowed_paths?.message as string | undefined}
          >
            <PathListEditor
              value={paths}
              onChange={(v) => setValue("allowed_paths", v, { shouldValidate: true })}
              error={errors.allowed_paths?.message as string | undefined}
            />
          </Field>

          {def.id !== "super_admin" && (
            <div className="flex items-center justify-between rounded-xl border border-stone-100 bg-stone-50 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-stone-800">Active</p>
                <p className="text-xs text-stone-500">
                  Inactive roles cannot be assigned to new users
                </p>
              </div>
              <button
                aria-label={isActive ? "Deactivate role" : "Activate role"}
                type="button"
                onClick={() => setValue("is_active", !isActive, { shouldValidate: true })}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                  isActive ? "bg-amber-500" : "bg-stone-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                    isActive ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-3 px-6 pb-6 border-t border-stone-100 pt-4">
          <Button type="button" variant="secondary" onClick={handleClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={isSubmitting} className="flex-1">
            {isSubmitting ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// PathListEditor remains the same
function PathListEditor({ value, onChange, error }: {
  value: string[];
  onChange: (v: string[]) => void;
  error?: string;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (!v.startsWith("/")) {
      toast.error("Path must start with /");
      return;
    }
    if (value.includes(v)) {
      toast.error("Path already added");
      return;
    }
    onChange([...value, v]);
    setDraft("");
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="/admin/fees"
          className="flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2 text-sm font-mono text-stone-900 placeholder:text-stone-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
        />
        <button
          type="button"
          onClick={add}
          className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-600 hover:bg-stone-50 transition-colors"
        >
          Add
        </button>
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((p) => (
            <span
              key={p}
              className="inline-flex items-center gap-1 rounded-lg bg-stone-100 pl-2 pr-1 py-1 text-xs font-mono text-stone-700"
            >
              {p}
              <button
                aria-label={`Remove ${p}`}
                type="button"
                onClick={() => onChange(value.filter((x) => x !== p))}
                className="rounded p-0.5 hover:bg-stone-200 transition-colors"
              >
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