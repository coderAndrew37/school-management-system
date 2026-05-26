// components/modals/RegisterTeacherModalClient.tsx
"use client";

import React, { useState, ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, UserPlus, X, Camera, Plus } from "lucide-react";
import Image from "next/image";
import {
  teacherRegistrationSchema,
  type TeacherFormValues,
} from "@/lib/schemas/teacher";
import type { ActionResult } from "@/lib/types/dashboard";
import { KButton, KInput } from "../shared/Forms";

interface RegisterTeacherModalClientProps {
  schoolId: string | null;
  onRegisterAction: (formData: FormData) => Promise<ActionResult>;
}

export function RegisterTeacherModalClient({ 
  schoolId, 
  onRegisterAction 
}: RegisterTeacherModalClientProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TeacherFormValues>({
    resolver: zodResolver(teacherRegistrationSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      tscNumber: "",
    },
  });

  // Strict structural block: Do not permit creation loops if tenant identity is missing
  if (!schoolId) {
    return (
      <KButton disabled variant="ghost" className="border-rose-500/20 text-rose-400 text-xs">
        Registration Locked: Missing Tenant Context
      </KButton>
    );
  }

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  // UX Optimization: Intercept key hits to ensure numbers only pass through the filter
  const handleNumericKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const allowedKeys = ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Enter"];
    if (!/^\d$/.test(e.key) && !allowedKeys.includes(e.key)) {
      e.preventDefault();
    }
  };

  const onSubmit = async (data: TeacherFormValues) => {
    setIsPending(true);
    const formData = new FormData();

    // Append validated text values safely
    formData.append("fullName", data.fullName);
    formData.append("email", data.email);
    formData.append("phone", data.phone);
    formData.append("tscNumber", data.tscNumber);

    // Append image payload if loaded
    if (imageFile) {
      formData.append("image", imageFile);
    }

    try {
      // Execute the server action passed through components props
      const result = await onRegisterAction(formData);
      if (result.success) {
        toast.success(result.message || "Staff member registered successfully");
        reset();
        setImageFile(null);
        setPreviewUrl(null);
        setIsOpen(false);
      } else {
        toast.error(result.message);
      }
    } catch (err) {
      toast.error("A network or system exception occurred.");
    } finally {
      setIsPending(false);
    }
  };

  const handleClose = () => {
    if (isPending) return;
    reset();
    setImageFile(null);
    setPreviewUrl(null);
    setIsOpen(false);
  };

  return (
    <>
      <KButton onClick={() => setIsOpen(true)}>
        <UserPlus className="mr-2 h-4 w-4" /> Register Teacher
      </KButton>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            onClick={handleClose}
          />

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
                onClick={handleClose}
                disabled={isPending}
                className="text-slate-500 hover:text-white transition-colors disabled:opacity-30"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="flex justify-center pb-2">
                <div className="relative group h-24 w-24">
                  <div className="h-24 w-24 rounded-full bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center relative">
                    {previewUrl ? (
                      <Image
                        src={previewUrl}
                        alt="Preview"
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <Camera className="h-8 w-8 text-white/20" />
                    )}
                  </div>
                  <label className="absolute bottom-0 right-0 h-8 w-8 bg-emerald-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-emerald-600 transition-colors border-2 border-[#0F0F11]">
                    <Plus className="h-4 w-4 text-white" />
                    <input
                      id="image"
                      aria-label="Teacher profile image"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageChange}
                      disabled={isPending}
                    />
                  </label>
                </div>
              </div>

              <KInput
                label="Full Name"
                placeholder="e.g. David Ndungu"
                error={errors.fullName?.message}
                disabled={isPending}
                {...register("fullName")}
              />

              <div className="grid grid-cols-2 gap-4">
                <KInput
                  label="TSC Number"
                  placeholder="7654321"
                  type="text"
                  inputMode="numeric"
                  maxLength={7}
                  onKeyDown={handleNumericKeyDown}
                  error={errors.tscNumber?.message}
                  disabled={isPending}
                  {...register("tscNumber")}
                />
                <KInput
                  label="Phone Number"
                  placeholder="07..."
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  onKeyDown={handleNumericKeyDown}
                  error={errors.phone?.message}
                  disabled={isPending}
                  {...register("phone")}
                />
              </div>

              <KInput
                label="Email Address"
                type="email"
                placeholder="teacher@kibali.sc.ke"
                error={errors.email?.message}
                disabled={isPending}
                {...register("email")}
              />

              <div className="flex gap-3 pt-4">
                <KButton
                  type="button"
                  variant="ghost"
                  className="flex-1"
                  onClick={handleClose}
                  disabled={isPending}
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