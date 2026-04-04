"use client";

import { useState, ChangeEvent } from "react"; // Added ChangeEvent
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, UserPlus, X, Camera, Plus } from "lucide-react"; // Added Camera, Plus
import Image from "next/image"; // Added Image
import {
  teacherRegistrationSchema,
  TeacherFormValues,
} from "@/lib/schemas/teacher";
import { addTeacherAction } from "@/lib/actions/addTeacher";
import { KButton, KInput } from "../shared/Forms";

export default function RegisterTeacherModal() {
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
  });

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const onSubmit = async (data: TeacherFormValues) => {
    setIsPending(true);
    const formData = new FormData();

    // Append standard fields
    Object.entries(data).forEach(([key, value]) =>
      formData.append(key, value as string),
    );

    // Append image if exists
    if (imageFile) {
      formData.append("image", imageFile);
    }

    try {
      const result = await addTeacherAction(formData);
      if (result.success) {
        toast.success("Staff member registered successfully");
        reset();
        setImageFile(null);
        setPreviewUrl(null);
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
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            onClick={() => !isPending && setIsOpen(false)}
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
                onClick={() => setIsOpen(false)}
                className="text-slate-500 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Profile Image Uploader */}
              <div className="flex justify-center pb-2">
                <div className="relative group h-24 w-24">
                  <div className="h-24 w-24 rounded-full bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center">
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
                  <label className="absolute bottom-0 right-0 h-8 w-8 bg-blue-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-500 transition-colors border-2 border-[#0F0F11]">
                    <Plus className="h-4 w-4 text-white" />
                    <input
                      id="image"
                      aria-label="Teacher profile image"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageChange}
                    />
                  </label>
                </div>
              </div>

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
