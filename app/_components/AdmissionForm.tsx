"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useTransition } from "react";
import { admissionSchema, AdmissionFormValues } from "@/lib/schemas/admission";
import {
  UserRoundPlus,
  CalendarDays,
  Phone,
  GraduationCap,
  Users,
  Loader2,
} from "lucide-react";
import { admitStudentAction } from "@/lib/actions/admit";

const GRADES = [
  "PP1",
  "PP2",
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
  "Grade 7 / JSS 1",
  "Grade 8 / JSS 2",
  "Grade 9 / JSS 3",
  "Form 1",
  "Form 2",
  "Form 3",
  "Form 4",
];

interface FieldErrorProps {
  message?: string;
}

function FieldError({ message }: FieldErrorProps) {
  if (!message) return null;
  return (
    <p className="mt-1.5 text-xs font-medium text-rose-400 flex items-center gap-1">
      <span className="inline-block w-1 h-1 rounded-full bg-rose-400" />
      {message}
    </p>
  );
}

interface LabelProps {
  htmlFor: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function Label({ htmlFor, icon, children }: LabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-amber-400/80 mb-2"
    >
      <span className="text-amber-400">{icon}</span>
      {children}
    </label>
  );
}

export default function AdmissionForm() {
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AdmissionFormValues>({
    resolver: zodResolver(admissionSchema),
  });

  const onSubmit = (values: AdmissionFormValues) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("studentName", values.studentName);
      formData.append("dateOfBirth", values.dateOfBirth);
      formData.append("gender", values.gender);
      formData.append("currentGrade", values.currentGrade);
      formData.append("parentPhone", values.parentPhone);

      const result = await admitStudentAction(formData);

      if (result.success) {
        toast.success("Admission Successful", {
          description: result.message,
          duration: 6000,
          icon: "🎓",
        });
        reset();
      } else {
        toast.error("Admission Failed", {
          description: result.message,
          duration: 5000,
        });
      }
    });
  };

  const inputBase =
    "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition-all duration-200 focus:border-amber-400/60 focus:bg-white/10 focus:ring-2 focus:ring-amber-400/20";

  return (
    <div className="min-h-screen bg-[#0c0f1a] flex items-center justify-center p-4 font-[family-name:var(--font-body)]">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-amber-500/5 blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-blue-500/5 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-lg">
        {/* Header badge */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/10 border border-amber-400/20">
            <GraduationCap className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-400/70">
              Kibali Academy
            </p>
            <h1 className="text-xl font-bold tracking-tight text-white">
              New Student Admission
            </h1>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl shadow-2xl shadow-black/40">
          {/* Card header stripe */}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />

          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="p-7 space-y-6"
          >
            {/* Student Name */}
            <div>
              <Label
                htmlFor="studentName"
                icon={<UserRoundPlus className="h-3.5 w-3.5" />}
              >
                Student Full Name
              </Label>
              <input
                aria-label="student name"
                id="studentName"
                type="text"
                placeholder="e.g. Amani Wanjiku Otieno"
                className={inputBase}
                {...register("studentName")}
                disabled={isPending}
              />
              <FieldError message={errors.studentName?.message} />
            </div>

            {/* Date of Birth + Gender row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label
                  htmlFor="dateOfBirth"
                  icon={<CalendarDays className="h-3.5 w-3.5" />}
                >
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
                <Label
                  htmlFor="gender"
                  icon={<Users className="h-3.5 w-3.5" />}
                >
                  Gender
                </Label>
                <select
                  id="gender"
                  className={`${inputBase} cursor-pointer`}
                  {...register("gender")}
                  disabled={isPending}
                  defaultValue=""
                >
                  <option
                    value=""
                    disabled
                    className="bg-[#0c0f1a] text-white/40"
                  >
                    Select…
                  </option>
                  <option value="Male" className="bg-[#0c0f1a] text-white">
                    Male
                  </option>
                  <option value="Female" className="bg-[#0c0f1a] text-white">
                    Female
                  </option>
                </select>
                <FieldError message={errors.gender?.message} />
              </div>
            </div>

            {/* Current Grade */}
            <div>
              <Label
                htmlFor="currentGrade"
                icon={<GraduationCap className="h-3.5 w-3.5" />}
              >
                Current Grade / Class
              </Label>
              <select
                id="currentGrade"
                className={`${inputBase} cursor-pointer`}
                {...register("currentGrade")}
                disabled={isPending}
                defaultValue=""
              >
                <option
                  value=""
                  disabled
                  className="bg-[#0c0f1a] text-white/40"
                >
                  Select grade…
                </option>
                {GRADES.map((grade) => (
                  <option
                    key={grade}
                    value={grade}
                    className="bg-[#0c0f1a] text-white"
                  >
                    {grade}
                  </option>
                ))}
              </select>
              <FieldError message={errors.currentGrade?.message} />
            </div>

            {/* Parent Phone */}
            <div>
              <Label
                htmlFor="parentPhone"
                icon={<Phone className="h-3.5 w-3.5" />}
              >
                Parent / Guardian Phone
              </Label>
              <div className="relative">
                <span className="absolute inset-y-0 left-4 flex items-center text-sm text-white/30 pointer-events-none select-none">
                  🇰🇪
                </span>
                <input
                  id="parentPhone"
                  type="tel"
                  placeholder="0712 345 678"
                  className={`${inputBase} pl-10`}
                  {...register("parentPhone")}
                  disabled={isPending}
                />
              </div>
              <FieldError message={errors.parentPhone?.message} />
            </div>

            {/* Divider */}
            <div className="h-px bg-white/[0.06]" />

            {/* Submit */}
            <button
              type="submit"
              disabled={isPending}
              className="group relative w-full overflow-hidden rounded-xl bg-amber-400 px-6 py-3.5 text-sm font-bold tracking-wide text-[#0c0f1a] transition-all duration-200 hover:bg-amber-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Admitting Student…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <UserRoundPlus className="h-4 w-4" />
                  Admit Student
                </span>
              )}
              {/* Shine effect */}
              <span className="absolute inset-0 -skew-x-12 translate-x-[-200%] bg-white/20 transition-transform duration-500 group-hover:translate-x-[200%]" />
            </button>

            <p className="text-center text-[11px] text-white/20">
              Student ID (KIB-YYYY-XXXX) is auto-generated by the system
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
