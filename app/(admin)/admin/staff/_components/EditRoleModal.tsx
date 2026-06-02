// @/app/admin/staff/_components/EditRoleDefModal.tsx
"use client";
import { updateRoleDefinitionAction } from "@/lib/actions/role-management";
import { 
  UpdateRoleDefinitionFormInput, 
  UpdateRoleDefinitionFormValues, 
  updateRoleDefinitionSchema 
} from "@/lib/schemas/role-schemas";
import { AdminRoleDefinition } from "@/lib/types/auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, SubmitHandler } from "react-hook-form";
import { toast } from "sonner";
import { useState, useEffect } from "react";

export default function EditRoleDefModal({ def, isOpen, onClose, onSuccess }: {
  def: AdminRoleDefinition | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  // Use the INPUT type (without defaults) for form management
  const form = useForm<UpdateRoleDefinitionFormInput>({
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

  const handleClose = () => { reset(); onClose(); };

  // Submit handler now works with the input type
  const onSubmit: SubmitHandler<UpdateRoleDefinitionFormInput> = async (data) => {
    if (!def) return;
    
    // If you need the full type with defaults (e.g., for API calls),
    // you can parse it again or cast safely
    const fullData = updateRoleDefinitionSchema.parse(data) as UpdateRoleDefinitionFormValues;
    
    const payload = {
      label: fullData.label,
      description: fullData.description ?? "",
      allowed_paths: fullData.allowed_paths,
      sort_order: fullData.sort_order,
      is_active: fullData.is_active,
      baseline_permissions: def.baseline_permissions ?? [],
    };
    
    try {
      const result = await updateRoleDefinitionAction(def.id, payload);
      if (result.success) { 
        toast.success(result.message); 
        handleClose(); 
        onSuccess(); 
      } else {
        toast.error(result.message || "Failed to update role definition");
      }
    } catch (e) { 
      console.error(e);
      toast.error("An unexpected error occurred");
    }
  };

  if (!def) return null;
  
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label htmlFor="label">Label</label>
        <input id="label" {...register("label")} />
        {errors.label && <span className="error">{errors.label.message}</span>}
      </div>
      
      <div>
        <label htmlFor="description">Description</label>
        <textarea id="description" {...register("description")} />
        {errors.description && <span className="error">{errors.description.message}</span>}
      </div>
      
      <div>
        <label>Allowed Paths</label>
        {/* You'll need a better UI for array fields, this is simplified */}
        {paths.map((path, index) => (
          <div key={index}>
            <input 
              {...register(`allowed_paths.${index}`)} 
              defaultValue={path}
            />
          </div>
        ))}
        <button 
          type="button" 
          onClick={() => setValue("allowed_paths", [...paths, ""])}
        >
          Add Path
        </button>
        {errors.allowed_paths && <span className="error">{errors.allowed_paths.message}</span>}
      </div>
      
      <div>
        <label htmlFor="sort_order">Sort Order</label>
        <input 
          id="sort_order" 
          type="number" 
          {...register("sort_order", { valueAsNumber: true })} 
        />
        {errors.sort_order && <span className="error">{errors.sort_order.message}</span>}
      </div>
      
      <div>
        <label htmlFor="is_active">
          <input 
            id="is_active" 
            type="checkbox" 
            {...register("is_active")} 
          />
          Active
        </label>
        {errors.is_active && <span className="error">{errors.is_active.message}</span>}
      </div>
      
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : "Save"}
      </button>
      <button type="button" onClick={handleClose}>
        Cancel
      </button>
    </form>
  );
}