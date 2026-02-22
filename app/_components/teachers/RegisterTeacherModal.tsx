"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, UserPlus, X } from "lucide-react";
import {
  teacherRegistrationSchema,
  TeacherFormValues,
} from "@/lib/schemas/teacher";
import { addTeacherAction } from "@/lib/actions/addTeacher";
import { KButton, KInput } from "../shared/Forms";

export default function RegisterTeacherModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TeacherFormValues>({
    resolver: zodResolver(teacherRegistrationSchema),
  });

  const onSubmit = async (data: TeacherFormValues) => {
    setIsPending(true);
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => formData.append(key, value));

    try {
      const result = await addTeacherAction(formData);
      if (result.success) {
        toast.success("Staff member registered successfully");
        reset();
        setIsOpen(false);
      } else {
        toast.error(result.message);
      }
    } catch (err) {
      toast.error("A connection error occurred.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <>
      <KButton onClick={() => setIsOpen(true)}>
        <UserPlus className="mr-2 h-4 w-4" /> Register Teacher
      </KButton>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            onClick={() => !isPending && setIsOpen(false)}
          />

          {/* Modal Content */}
          <div className="relative bg-[#0F0F11] border border-white/10 w-full max-w-md rounded-2xl shadow-2xl p-8 overflow-hidden">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">New Teacher</h2>
                <p className="text-xs text-slate-500">
                  Add staff to the CBC management system.
                </p>
              </div>
              <button
                aria-label="close modal"
                onClick={() => setIsOpen(false)}
                className="text-slate-500 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <KInput
                label="Full Name"
                placeholder="e.g. David Ndungu"
                error={errors.fullName?.message}
                {...register("fullName")}
              />

              <div className="grid grid-cols-2 gap-4">
                <KInput
                  label="TSC Number"
                  placeholder="7654321"
                  error={errors.tscNumber?.message}
                  {...register("tscNumber")}
                />
                <KInput
                  label="Phone Number"
                  placeholder="07..."
                  error={errors.phone?.message}
                  {...register("phone")}
                />
              </div>

              <KInput
                label="Email Address"
                type="email"
                placeholder="teacher@kibali.sc.ke"
                error={errors.email?.message}
                {...register("email")}
              />

              <div className="flex gap-3 pt-4">
                <KButton
                  type="button"
                  variant="ghost"
                  className="flex-1"
                  onClick={() => setIsOpen(false)}
                >
                  Cancel
                </KButton>
                <KButton type="submit" className="flex-1" disabled={isPending}>
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Register Staff"
                  )}
                </KButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
