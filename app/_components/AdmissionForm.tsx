"use client";

import {
  admitStudentAction,
  uploadStudentPhotoAction,
  type ParentSearchResult
} from "@/lib/actions/admit";
import {
  admissionSchema,
  type AdmissionFormValues,
} from "@/lib/schemas/admission";
import Image from "next/image";
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
  Users
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Divider, FieldError, Label, ParentSearchBox, ClassSelect } from "./AdmissionFormUtils";

const RELATIONSHIP_TYPES = [
  { value: "mother", label: "Mother" },
  { value: "father", label: "Father" },
  { value: "guardian", label: "Guardian" },
  { value: "other", label: "Other" },
] as const;

export default function AdmissionForm() {
  const [isPending, startTransition] = useTransition();
  const [selectedParent, setSelectedParent] = useState<ParentSearchResult | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // We define the form without the generic <AdmissionFormValues> here 
  // to avoid the strict variance mismatch with the Zod resolver.
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(admissionSchema),
    defaultValues: {
      studentName: "",
      dateOfBirth: "",
      gender: "" as "Male" | "Female", // Typed directly to satisfy the enum
      classId: "",
      relationshipType: "guardian" as "mother" | "father" | "guardian" | "other",
      existingParentId: null as string | null,
      parentName: "",
      parentEmail: "",
      parentPhone: "",
    },
  });

  const selectedClassId = watch("classId");

  function handleParentSelect(parent: ParentSearchResult | null) {
    setSelectedParent(parent);
    setValue("existingParentId", parent?.id || null, { shouldValidate: true });
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Photo too large", { description: "Max 2 MB." });
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

  // Type the data here instead of the whole function
 // 1. Use the actual type from your schema instead of any
const onSubmit: SubmitHandler<AdmissionFormValues> = (values) => {
  startTransition(async () => {
    const fd = new FormData();

    // Now values is strictly typed, no 'as' casting needed
    fd.append("studentName", values.studentName);
    fd.append("dateOfBirth", values.dateOfBirth);
    fd.append("gender", values.gender);
    fd.append("classId", values.classId);
    fd.append("relationshipType", values.relationshipType);

    if (values.existingParentId) {
      fd.append("existingParentId", values.existingParentId);
    } else {
      // Use nullish coalescing to ensure we always append a string
      fd.append("parentName", values.parentName ?? "");
      fd.append("parentEmail", values.parentEmail ?? "");
      fd.append("parentPhone", values.parentPhone ?? "");
    }

    const result = await admitStudentAction(fd);

    if (!result.success) {
      toast.error("Admission Failed", { description: result.message });
      return;
    }

    if (photoFile && result.studentId) {
      setPhotoUploading(true);
      const photoFd = new FormData();
      photoFd.set("photo", photoFile);
      const photoResult = await uploadStudentPhotoAction(result.studentId, photoFd);
      setPhotoUploading(false);
      if (!photoResult.success) console.warn("Photo upload failed:", photoResult.message);
    }

    toast.success("Admission Successful 🎓", {
      description: selectedParent
        ? `${values.studentName} added to ${selectedParent.full_name}'s account.`
        : `${values.studentName} admitted — parent invite sent.`,
    });

    reset();
    setSelectedParent(null);
    setPhotoFile(null);
    setPhotoPreview(null);
    router.push("/admin/students");
  });
};

  const inputBase = "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition-all duration-200 focus:border-amber-400/60 focus:bg-white/10 focus:ring-2 focus:ring-amber-400/20 disabled:opacity-50 disabled:cursor-not-allowed";

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
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-400/70">Kibali Academy · Admin</p>
            <h1 className="text-xl font-bold tracking-tight text-white">New Student Admission</h1>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl shadow-2xl shadow-black/40">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="p-7 space-y-6">
            <div className="space-y-5">
              <div>
                <Label htmlFor="studentName" icon={<UserRoundPlus className="h-3.5 w-3.5" />}>Student Full Name</Label>
                <input id="studentName" type="text" placeholder="e.g. Amani Wanjiku Otieno" className={inputBase} {...register("studentName")} disabled={isPending} />
                <FieldError message={(errors.studentName?.message as string)} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dateOfBirth" icon={<CalendarDays className="h-3.5 w-3.5" />}>Date of Birth</Label>
                  <input id="dateOfBirth" type="date" className={`${inputBase} [color-scheme:dark]`} {...register("dateOfBirth")} disabled={isPending} />
                  <FieldError message={(errors.dateOfBirth?.message as string)} />
                </div>

                <div>
                  <Label htmlFor="gender" icon={<Users className="h-3.5 w-3.5" />}>Gender</Label>
                  <select id="gender" className={`${inputBase} cursor-pointer`} {...register("gender")} disabled={isPending}>
                    <option value="" disabled className="bg-[#0c0f1a] text-white/40">Select…</option>
                    <option value="Male" className="bg-[#0c0f1a] text-white">Male</option>
                    <option value="Female" className="bg-[#0c0f1a] text-white">Female</option>
                  </select>
                  <FieldError message={(errors.gender?.message as string)} />
                </div>
              </div>

              <div>
                <Label htmlFor="classId" icon={<GraduationCap className="h-3.5 w-3.5" />}>Assigned Class (2026)</Label>
                <ClassSelect 
                  value={selectedClassId as string} 
                  onChange={(val) => setValue("classId", val, { shouldValidate: true })}
                  disabled={isPending} 
                />
                <FieldError message={(errors.classId?.message as string)} />
              </div>
            </div>

            <Divider label="Passport Photo (Optional)" />

            <div className="flex items-start gap-4">
              <div 
                onClick={() => !isPending && fileInputRef.current?.click()}
                className="relative w-20 h-24 rounded-xl border-2 border-dashed border-white/15 bg-white/[0.04] flex items-center justify-center flex-shrink-0 cursor-pointer hover:border-amber-400/40 overflow-hidden group transition-all"
              >
                {photoPreview ? (
                  <Image src={photoPreview} alt="Preview" width={80} height={96} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-white/20 group-hover:text-white/40">
                    <Camera className="h-6 w-6" />
                    <span className="text-[9px] font-bold uppercase">Upload</span>
                  </div>
                )}
                {photoUploading && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 text-amber-400 animate-spin" />
                  </div>
                )}
              </div>

              <div className="flex-1">
                <input aria-label="student image" ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} disabled={isPending} />
                {photoFile ? (
                  <div className="space-y-1">
                    <p className="text-xs text-white/60 truncate">{photoFile.name}</p>
                    <button type="button" onClick={handleRemovePhoto} className="text-[10px] font-semibold text-rose-400/60 hover:text-rose-400 flex items-center gap-1">
                      <ImageOff className="h-3 w-3" /> Remove
                    </button>
                  </div>
                ) : (
                  <p className="text-[10px] text-white/25 leading-relaxed">
                    JPEG or PNG · Max 2 MB <br /> Clear face photo for school records.
                  </p>
                )}
              </div>
            </div>

            <Divider label="Parent / Guardian" />

            <div className="space-y-5">
              <div>
                <Label htmlFor="relationshipType" icon={<Users className="h-3.5 w-3.5" />}>Relationship</Label>
                <div className="relative">
                  <select id="relationshipType" className={`${inputBase} appearance-none pr-9`} {...register("relationshipType")} disabled={isPending}>
                    {RELATIONSHIP_TYPES.map((r) => <option key={r.value} value={r.value} className="bg-[#0c0f1a]">{r.label}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                </div>
              </div>

              <div>
                <Label htmlFor="parentSearch" icon={<Search className="h-3.5 w-3.5" />}>Search Existing Parents</Label>
                <ParentSearchBox onSelect={handleParentSelect} selected={selectedParent} disabled={isPending} />
              </div>

              {!selectedParent && (
                <div className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="rounded-xl border border-amber-400/10 bg-amber-400/[0.04] px-4 py-3">
                    <p className="text-[11px] text-amber-400/60">No parent selected — a new account will be created.</p>
                  </div>
                  
                  <div>
                    <Label htmlFor="parentName" icon={<User className="h-3.5 w-3.5" />}>Parent Full Name</Label>
                    <input id="parentName" type="text" placeholder="Full Name" className={inputBase} {...register("parentName")} disabled={isPending} />
                    <FieldError message={(errors.parentName?.message as string)} />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="parentEmail" icon={<Mail className="h-3.5 w-3.5" />}>Email Address</Label>
                      <input id="parentEmail" type="email" placeholder="email@example.com" className={inputBase} {...register("parentEmail")} disabled={isPending} />
                      <FieldError message={(errors.parentEmail?.message as string)} />
                    </div>
                    <div>
                      <Label htmlFor="parentPhone" icon={<Phone className="h-3.5 w-3.5" />}>Phone Number</Label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-4 flex items-center text-sm">🇰🇪</span>
                        <input id="parentPhone" type="tel" placeholder="07xx xxx xxx" className={`${inputBase} pl-12`} {...register("parentPhone")} disabled={isPending} />
                      </div>
                      <FieldError message={(errors.parentPhone?.message as string)} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="group relative w-full overflow-hidden rounded-xl bg-amber-400 px-6 py-3.5 text-sm font-bold text-[#0c0f1a] transition-all hover:bg-amber-300 active:scale-[0.98] disabled:opacity-60"
            >
              {isPending ? (
                <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Processing...</span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <UserRoundPlus className="h-4 w-4" />
                  {selectedParent ? `Add to ${selectedParent.full_name}` : "Admit & Create Account"}
                </span>
              )}
              <span className="absolute inset-0 -skew-x-12 translate-x-[-200%] bg-white/20 transition-transform duration-500 group-hover:translate-x-[200%]" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}