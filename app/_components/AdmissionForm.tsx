"use client";

import {
  admitStudentAction,
  uploadStudentPhotoAction,
  type ParentSearchResult,
} from "@/lib/actions/admit";
import {
  admissionSchema,
  type AdmissionFormValues,
} from "@/lib/schemas/admission";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CalendarDays,
  Camera,
  ChevronDown,
  GraduationCap,
  ImageOff,
  Loader2,
  Mail,
  Phone,
  Search,
  User,
  UserRoundPlus,
  Users,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition } from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  ClassSelect,
  Divider,
  FieldError,
  Label,
  ParentSearchBox,
} from "./AdmissionFormUtils";

const RELATIONSHIP_TYPES = [
  { value: "mother", label: "Mother" },
  { value: "father", label: "Father" },
  { value: "guardian", label: "Guardian" },
  { value: "other", label: "Other" },
] as const;

interface AdmissionFormProps {
  availableClasses: { id: string; grade: string; stream: string }[];
}

export default function AdmissionForm({ availableClasses }: AdmissionFormProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedParent, setSelectedParent] = useState<ParentSearchResult | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AdmissionFormValues>({
    resolver: zodResolver(admissionSchema),
    defaultValues: {
      studentName: "",
      dateOfBirth: "",
      gender: "Male",
      classId: "",
      relationshipType: "guardian",
      existingParentId: null,
      parentName: "",
      parentEmail: "",
      parentPhone: "",
    },
    mode: "onBlur",
  });

  const selectedClassId = watch("classId");
  const existingParentId = watch("existingParentId");

  const isNewParent = useCallback(() => !existingParentId, [existingParentId])();

  function handleParentSelect(parent: ParentSearchResult | null) {
    setSelectedParent(parent);
    setValue("existingParentId", parent?.id || null, { shouldValidate: true });

    // Clear new parent fields when selecting existing parent
    if (parent) {
      setValue("parentName", "");
      setValue("parentEmail", "");
      setValue("parentPhone", "");
    }
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Photo too large", { description: "Maximum size is 2 MB." });
      return;
    }

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function handleRemovePhoto() {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const onSubmit: SubmitHandler<AdmissionFormValues> = async (values) => {
    startTransition(async () => {
      const fd = new FormData();

      fd.append("studentName", values.studentName.trim());
      fd.append("dateOfBirth", values.dateOfBirth);
      fd.append("gender", values.gender);
      fd.append("classId", values.classId);
      fd.append("relationshipType", values.relationshipType);

      if (values.existingParentId) {
        fd.append("existingParentId", values.existingParentId);
      } else {
        fd.append("parentName", values.parentName?.trim() || "");
        fd.append("parentEmail", values.parentEmail?.trim() || "");
        fd.append("parentPhone", values.parentPhone?.trim() || "");
      }

      const result = await admitStudentAction(fd);

      if (!result.success) {
        toast.error("Admission Failed", {
          description: result.message || "Please check your inputs and try again.",
        });
        return;
      }

      // Upload photo if provided
      if (photoFile && result.studentId) {
        setPhotoUploading(true);
        const photoFd = new FormData();
        photoFd.set("photo", photoFile);

        const photoResult = await uploadStudentPhotoAction(result.studentId, photoFd);
        setPhotoUploading(false);

        if (!photoResult.success) {
          toast.warning("Student admitted but photo upload failed", {
            description: photoResult.message,
          });
        }
      }

      toast.success("Student Admitted Successfully 🎉", {
        description: selectedParent
          ? `${values.studentName} has been added to ${selectedParent.full_name}'s account.`
          : `New parent account created. Invite sent to ${values.parentEmail}.`,
      });

      // Reset form
      reset();
      setSelectedParent(null);
      setPhotoFile(null);
      setPhotoPreview(null);
      router.push("/admin/students");
    });
  };

  const inputBase =
    "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition-all focus:border-amber-400/60 focus:bg-white/10 focus:ring-2 focus:ring-amber-400/20 disabled:opacity-50";

  return (
    <div className="min-h-screen bg-[#0c0f1a] flex items-center justify-center p-4 font-[family-name:var(--font-body)]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-amber-500/5 blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-blue-500/5 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-lg">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/10 border border-amber-400/20">
            <GraduationCap className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-400/70">Kibali Academy • Admin</p>
            <h1 className="text-2xl font-bold tracking-tight text-white">Admit New Student</h1>
          </div>
        </div>

        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-2xl shadow-2xl shadow-black/50">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="p-8 space-y-8">
            {/* Student Information */}
            <div className="space-y-6">
              <div>
                <Label htmlFor="studentName" icon={<UserRoundPlus className="h-4 w-4" />}>
                  Student Full Name
                </Label>
                <input
                  id="studentName"
                  type="text"
                  placeholder="e.g. Amani Wanjiku Otieno"
                  className={inputBase}
                  {...register("studentName")}
                  disabled={isPending}
                />
                <FieldError message={errors.studentName?.message} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dateOfBirth" icon={<CalendarDays className="h-4 w-4" />}>
                    Date of Birth
                  </Label>
                  <input
                    id="dateOfBirth"
                    type="date"
                    className={`${inputBase} [color-scheme:dark]`}
                    {...register("dateOfBirth")}
                    disabled={isPending}
                  />
                  <FieldError message={errors.dateOfBirth?.message} />
                </div>

                <div>
                  <Label htmlFor="gender" icon={<Users className="h-4 w-4" />}>
                    Gender
                  </Label>
                  <select id="gender" className={`${inputBase} cursor-pointer`} {...register("gender")} disabled={isPending}>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                  <FieldError message={errors.gender?.message} />
                </div>
              </div>

              <div>
                <Label htmlFor="classId" icon={<GraduationCap className="h-4 w-4" />}>
                  Assigned Class
                </Label>
                <ClassSelect
                  value={selectedClassId}
                  options={availableClasses}
                  onChange={(val) => setValue("classId", val, { shouldValidate: true })}
                  disabled={isPending}
                />
                <FieldError message={errors.classId?.message} />
              </div>
            </div>

            <Divider label="Passport Photo (Optional)" />

            {/* Photo Upload */}
            <div className="flex gap-5">
              <div
                onClick={() => !isPending && fileInputRef.current?.click()}
                className="relative w-28 h-32 rounded-2xl border-2 border-dashed border-white/20 bg-white/5 flex items-center justify-center cursor-pointer hover:border-amber-400/50 overflow-hidden transition-all active:scale-95"
              >
                {photoPreview ? (
                  <Image src={photoPreview} alt="Preview" fill className="object-cover" />
                ) : (
                  <div className="flex flex-col items-center text-white/30">
                    <Camera className="h-8 w-8 mb-1" />
                    <span className="text-xs font-medium">Upload Photo</span>
                  </div>
                )}

                {photoUploading && (
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
                  </div>
                )}
              </div>

              <div className="flex-1 text-sm">
                <input
                aria-label="Student passport photo"
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                  disabled={isPending}
                />

                {photoFile ? (
                  <div>
                    <p className="font-medium text-white/80">{photoFile.name}</p>
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="mt-2 text-rose-400 hover:text-rose-500 text-xs flex items-center gap-1"
                    >
                      <ImageOff className="h-3.5 w-3.5" /> Remove Photo
                    </button>
                  </div>
                ) : (
                  <p className="text-white/40 text-sm leading-relaxed">
                    Recommended: Clear face photo.<br />
                    JPEG or PNG • Max 2MB
                  </p>
                )}
              </div>
            </div>

            <Divider label="Parent / Guardian Information" />

            {/* Parent Section */}
            <div className="space-y-6">
              <div>
                <Label htmlFor="relationshipType" icon={<Users className="h-4 w-4" />}>
                  Relationship to Student
                </Label>
                <div className="relative">
                  <select
                    id="relationshipType"
                    className={`${inputBase} appearance-none pr-10`}
                    {...register("relationshipType")}
                    disabled={isPending}
                  >
                    {RELATIONSHIP_TYPES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                </div>
              </div>

              <div>
                <Label htmlFor="parentSearch" icon={<Search className="h-4 w-4" />}>
                  Search Existing Parent
                </Label>
                <ParentSearchBox onSelect={handleParentSelect} selected={selectedParent} disabled={isPending} />
              </div>

              {isNewParent && (
                <div className="space-y-6 pt-2 border-t border-white/10">
                  <div className="bg-amber-400/10 border border-amber-400/20 rounded-xl p-4">
                    <p className="text-amber-400 text-sm">New parent account will be created and invited.</p>
                  </div>

                  <div>
                    <Label htmlFor="parentName" icon={<User className="h-4 w-4" />}>
                      Parent Full Name
                    </Label>
                    <input
                      id="parentName"
                      type="text"
                      placeholder="e.g. Jane Wanjiku Otieno"
                      className={inputBase}
                      {...register("parentName")}
                      disabled={isPending}
                    />
                    <FieldError message={errors.parentName?.message} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="parentEmail" icon={<Mail className="h-4 w-4" />}>
                        Email Address
                      </Label>
                      <input
                        id="parentEmail"
                        type="email"
                        placeholder="parent@email.com"
                        className={inputBase}
                        {...register("parentEmail")}
                        disabled={isPending}
                      />
                      <FieldError message={errors.parentEmail?.message} />
                    </div>

                    <div>
                      <Label htmlFor="parentPhone" icon={<Phone className="h-4 w-4" />}>
                        Phone Number
                      </Label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg">🇰🇪</span>
                        <input
                          id="parentPhone"
                          type="tel"
                          placeholder="0712 345 678"
                          className={`${inputBase} pl-12`}
                          {...register("parentPhone")}
                          disabled={isPending}
                        />
                      </div>
                      <FieldError message={errors.parentPhone?.message} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="mt-4 w-full rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 py-4 text-lg font-bold text-[#0c0f1a] hover:brightness-110 active:scale-[0.985] transition-all disabled:opacity-60 flex items-center justify-center gap-3 shadow-lg shadow-amber-500/30"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Processing Admission...
                </>
              ) : (
                <>
                  <UserRoundPlus className="h-5 w-5" />
                  {selectedParent ? `Add Student to ${selectedParent.full_name.split(" ")[0]}` : "Admit Student & Send Invite"}
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}