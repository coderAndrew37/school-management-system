"use client";

// @/app/admin/staff/_components/CreateStaffModal.tsx

import { createStaffUserAction } from "@/lib/actions/role-management";
import { BASE_ROLES, BASE_ROLE_LABELS } from "@/lib/types/auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const createStaffSchema = z.object({
  full_name: z.string().min(3, "Full name must be at least 3 characters"),
  email: z.string().email("Please enter a valid email address"),
  base_role: z.enum(BASE_ROLES),
  admin_role: z.string().nullable().optional(),
  phone_number: z.string().optional(),
});

type CreateStaffForm = z.infer<typeof createStaffSchema>;

interface CreateStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateStaffModal({ isOpen, onClose, onSuccess }: CreateStaffModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreateStaffForm>({
    resolver: zodResolver(createStaffSchema),
    defaultValues: {
      base_role: "staff", // Aligned default fallback to the correct domain model type
      admin_role: null,
    },
  });

  const selectedBaseRole = watch("base_role");

  const onSubmit = async (data: CreateStaffForm) => {
    setIsSubmitting(true);

    const formData = new FormData();
    formData.append("full_name", data.full_name);
    formData.append("email", data.email);
    formData.append("base_role", data.base_role);
    if (data.admin_role) formData.append("admin_role", data.admin_role);
    if (data.phone_number) formData.append("phone_number", data.phone_number);

    const result = await createStaffUserAction(formData);

    setIsSubmitting(false);

    if (result.success) {
      toast.success(result.message);
      reset();
      onSuccess?.();
      onClose();
    } else {
      toast.error(result.message);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60]"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 30 }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between border-b px-6 py-5">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">Add New Staff</h2>
                  <p className="text-slate-600 text-sm mt-1">Create a new staff account</p>
                </div>
                <button
                aria-label="Close modal"
                  onClick={onClose}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6" noValidate>
                {/* Full Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    {...register("full_name")}
                    type="text"
                    className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:outline-none focus:border-amber-400"
                    placeholder="e.g. John Kamau"
                  />
                  {errors.full_name && (
                    <p className="text-red-500 text-sm mt-1">{errors.full_name.message}</p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    {...register("email")}
                    type="email"
                    className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:outline-none focus:border-amber-400"
                    placeholder="john.kamau@kibali.ac.ke"
                  />
                  {errors.email && (
                    <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
                  )}
                </div>

                {/* Phone Number */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    {...register("phone_number")}
                    type="tel"
                    className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:outline-none focus:border-amber-400"
                    placeholder="+254 700 000 000"
                  />
                </div>

                {/* Base Role */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Base Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    {...register("base_role")}
                    className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:outline-none focus:border-amber-400"
                  >
                    {BASE_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {BASE_ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Admin Role - Conditional */}
                {selectedBaseRole === "admin" && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Administrative Title <span className="text-red-500">*</span>
                    </label>
                    <select
                      {...register("admin_role")}
                      className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:outline-none focus:border-amber-400"
                    >
                      <option value="">Select Title</option>
                      <option value="super_admin">Super Administrator</option>
                      <option value="headteacher">Headteacher</option>
                      <option value="deputy_headteacher">Deputy Headteacher</option>
                      <option value="bursar">Bursar</option>
                      <option value="dos">Director of Studies (DOS)</option>
                      <option value="school_doctor">School Doctor</option>
                      <option value="librarian">Librarian</option>
                    </select>
                  </div>
                )}

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-3.5 border border-slate-300 rounded-2xl font-medium hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3.5 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-2xl font-semibold hover:brightness-105 disabled:opacity-70 transition-all flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Creating Account...
                      </>
                    ) : (
                      "Create Staff Account"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}