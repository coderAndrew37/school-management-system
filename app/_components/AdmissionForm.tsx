"use client";

// app/_components/AdmissionForm.tsx
// Admin-side admission form.
// Flow A: search + select existing parent → link new student to their account.
// Flow B: fill in new parent details → create auth user + send invite.

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useTransition, useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  admissionSchema,
  type AdmissionFormValues,
} from "@/lib/schemas/admission";
import {
  UserRoundPlus,
  CalendarDays,
  Phone,
  GraduationCap,
  Users,
  Loader2,
  Mail,
  User,
  Search,
  X,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";
import {
  admitStudentAction,
  searchParentsAction,
  type ParentSearchResult,
} from "@/lib/actions/admit";

// ── Constants ─────────────────────────────────────────────────────────────────

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
];

const RELATIONSHIP_TYPES = [
  { value: "mother", label: "Mother" },
  { value: "father", label: "Father" },
  { value: "guardian", label: "Guardian" },
  { value: "other", label: "Other" },
];

// ── Shared sub-components ─────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 text-xs font-medium text-rose-400 flex items-center gap-1">
      <span className="inline-block w-1 h-1 rounded-full bg-rose-400" />
      {message}
    </p>
  );
}

function Label({
  htmlFor,
  icon,
  children,
}: {
  htmlFor: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
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

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4 py-1">
      <div className="h-px flex-1 bg-white/[0.06]" />
      <span className="text-[10px] font-bold uppercase tracking-widest text-white/20">
        {label}
      </span>
      <div className="h-px flex-1 bg-white/[0.06]" />
    </div>
  );
}

// ── Parent search combobox ────────────────────────────────────────────────────

function ParentSearchBox({
  onSelect,
  selected,
  disabled,
}: {
  onSelect: (p: ParentSearchResult | null) => void;
  selected: ParentSearchResult | null;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ParentSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const container = useRef<HTMLDivElement>(null);

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setSearching(true);
    const res = await searchParentsAction(q);
    setResults(res.data);
    setOpen(true);
    setSearching(false);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => runSearch(v), 300);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (container.current && !container.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Selected state — show parent card ──────────────────────────────────────
  if (selected) {
    return (
      <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/[0.06] px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
              <p className="text-sm font-semibold text-white truncate">
                {selected.full_name}
              </p>
            </div>
            <p className="text-xs text-white/40">{selected.email}</p>
            {selected.phone_number && (
              <p className="text-xs text-white/30">{selected.phone_number}</p>
            )}
          </div>
          <button
            type="button"
            aria-label="Deselect parent"
            onClick={() => onSelect(null)}
            disabled={disabled}
            className="text-white/30 hover:text-white flex-shrink-0 mt-0.5 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Existing children under this parent */}
        {selected.children.length > 0 && (
          <div className="mt-3 pt-3 border-t border-emerald-400/15">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/50 mb-1.5">
              Already enrolled ({selected.children.length})
            </p>
            <div className="space-y-1">
              {selected.children.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-2 text-xs text-white/50"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/40 flex-shrink-0" />
                  <span>{c.full_name}</span>
                  <span className="text-white/25">·</span>
                  <span className="text-white/35">{c.current_grade}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-amber-400/50 mt-2">
              The new student will be added to this parent's account alongside
              the above.
            </p>
          </div>
        )}

        {selected.children.length === 0 && (
          <p className="text-[10px] text-white/30 mt-2">
            This parent has no other enrolled students yet.
          </p>
        )}
      </div>
    );
  }

  // ── Search input ───────────────────────────────────────────────────────────
  return (
    <div ref={container} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25 pointer-events-none" />
        <input
          id="parentSearch"
          type="text"
          value={query}
          onChange={handleChange}
          disabled={disabled}
          autoComplete="off"
          placeholder="Search by name, email, or phone…"
          aria-label="Search for an existing parent"
          className="w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-10 py-3 text-sm text-white placeholder-white/25 outline-none transition-all focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20 disabled:opacity-50"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 animate-spin" />
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-white/10 bg-[#111827] shadow-2xl overflow-hidden">
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onSelect(p);
                setQuery("");
                setOpen(false);
              }}
              className="w-full text-left px-4 py-3 hover:bg-white/[0.06] transition-colors border-b border-white/[0.04] last:border-0"
            >
              <p className="text-sm font-medium text-white">{p.full_name}</p>
              <p className="text-xs text-white/40">{p.email}</p>
              {p.children.length > 0 ? (
                <p className="text-[10px] text-amber-400/60 mt-0.5">
                  {p.children.length} enrolled child
                  {p.children.length !== 1 ? "ren" : ""}:{" "}
                  {p.children.map((c) => c.full_name).join(", ")}
                </p>
              ) : (
                <p className="text-[10px] text-white/25 mt-0.5">
                  No enrolled children yet
                </p>
              )}
            </button>
          ))}
        </div>
      )}

      {open &&
        !searching &&
        results.length === 0 &&
        query.trim().length >= 2 && (
          <div className="absolute z-20 mt-1 w-full rounded-xl border border-white/10 bg-[#111827] px-4 py-3 text-sm text-white/30 shadow-2xl">
            No existing parents found — fill in the fields below to create one.
          </div>
        )}
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────

export default function AdmissionForm() {
  const [isPending, startTransition] = useTransition();
  const [selectedParent, setSelectedParent] =
    useState<ParentSearchResult | null>(null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AdmissionFormValues>({
    resolver: zodResolver(admissionSchema) as any,
    defaultValues: { relationshipType: "guardian" },
  });

  const onSubmit = (values: AdmissionFormValues) => {
    startTransition(async () => {
      const fd = new FormData();

      // Student
      fd.append("studentName", values.studentName);
      fd.append("dateOfBirth", values.dateOfBirth);
      fd.append("gender", values.gender);
      fd.append("currentGrade", values.currentGrade);
      fd.append("relationshipType", values.relationshipType ?? "guardian");

      if (selectedParent) {
        // Flow A: existing parent — send only the UUID, action skips new-parent validation
        fd.append("existingParentId", selectedParent.id);
        // Don't send parent name/email/phone — action ignores them for Flow A
      } else {
        // Flow B: new parent
        fd.append("parentName", values.parentName ?? "");
        fd.append("parentEmail", values.parentEmail ?? "");
        fd.append("parentPhone", values.parentPhone ?? "");
      }

      const result = await admitStudentAction(fd);

      if (!result.success) {
        toast.error("Admission Failed", {
          description: result.message,
          duration: 5000,
        });
        return;
      }

      toast.success("Admission Successful 🎓", {
        description: selectedParent
          ? `${values.studentName} added to ${selectedParent.full_name}'s account.`
          : `${values.studentName} admitted — parent invite sent.`,
        duration: 3000,
      });

      reset();
      setSelectedParent(null);

      await new Promise((r) => setTimeout(r, 1200));
      router.push("/admin/students");
    });
  };

  const inputBase =
    "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition-all duration-200 focus:border-amber-400/60 focus:bg-white/10 focus:ring-2 focus:ring-amber-400/20 disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="min-h-screen bg-[#0c0f1a] flex items-center justify-center p-4 font-[family-name:var(--font-body)]">
      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-amber-500/5 blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-blue-500/5 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-lg">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/10 border border-amber-400/20">
            <GraduationCap className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-400/70">
              Kibali Academy · Admin
            </p>
            <h1 className="text-xl font-bold tracking-tight text-white">
              New Student Admission
            </h1>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl shadow-2xl shadow-black/40">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />

          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="p-7 space-y-6"
          >
            {/* ── STUDENT INFO ──────────────────────────────────────────── */}
            <div className="space-y-5">
              <div>
                <Label
                  htmlFor="studentName"
                  icon={<UserRoundPlus className="h-3.5 w-3.5" />}
                >
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
                  {GRADES.map((g) => (
                    <option
                      key={g}
                      value={g}
                      className="bg-[#0c0f1a] text-white"
                    >
                      {g}
                    </option>
                  ))}
                </select>
                <FieldError message={errors.currentGrade?.message} />
              </div>
            </div>

            {/* ── PARENT / GUARDIAN ─────────────────────────────────────── */}
            <Divider label="Parent / Guardian" />

            <div>
              <Label
                htmlFor="relationshipType"
                icon={<Users className="h-3.5 w-3.5" />}
              >
                Relationship to Student
              </Label>
              <div className="relative">
                <select
                  id="relationshipType"
                  className={`${inputBase} cursor-pointer appearance-none pr-9`}
                  {...register("relationshipType")}
                  disabled={isPending}
                >
                  {RELATIONSHIP_TYPES.map((r) => (
                    <option
                      key={r.value}
                      value={r.value}
                      className="bg-[#0c0f1a] text-white"
                    >
                      {r.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              </div>
            </div>

            {/* Parent search */}
            <div>
              <Label
                htmlFor="parentSearch"
                icon={<Search className="h-3.5 w-3.5" />}
              >
                Search Existing Parents
              </Label>
              <ParentSearchBox
                onSelect={setSelectedParent}
                selected={selectedParent}
                disabled={isPending}
              />
              {!selectedParent && (
                <p className="mt-1.5 text-[11px] text-white/25">
                  Select an existing parent to add this child to their account,
                  or fill in the fields below to create a new parent.
                </p>
              )}
            </div>

            {/* Flow B: new parent fields — hidden when existing parent selected */}
            {!selectedParent && (
              <div className="space-y-5">
                <div className="rounded-xl border border-amber-400/10 bg-amber-400/[0.04] px-4 py-3">
                  <p className="text-[11px] text-amber-400/60">
                    No parent selected — fill in the fields below to create a
                    new parent account. A secure setup link will be emailed to
                    them.
                  </p>
                </div>

                <div>
                  <Label
                    htmlFor="parentName"
                    icon={<User className="h-3.5 w-3.5" />}
                  >
                    Parent Full Name
                  </Label>
                  <input
                    id="parentName"
                    type="text"
                    placeholder="e.g. David Otieno"
                    className={inputBase}
                    {...register("parentName")}
                    disabled={isPending}
                  />
                  <FieldError message={errors.parentName?.message} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label
                      htmlFor="parentEmail"
                      icon={<Mail className="h-3.5 w-3.5" />}
                    >
                      Email Address
                    </Label>
                    <input
                      id="parentEmail"
                      type="email"
                      placeholder="parent@example.com"
                      className={inputBase}
                      {...register("parentEmail")}
                      disabled={isPending}
                    />
                    <FieldError message={errors.parentEmail?.message} />
                  </div>

                  <div>
                    <Label
                      htmlFor="parentPhone"
                      icon={<Phone className="h-3.5 w-3.5" />}
                    >
                      Phone Number
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
                </div>
              </div>
            )}

            <div className="h-px bg-white/[0.06]" />

            <button
              type="submit"
              disabled={isPending}
              className="group relative w-full overflow-hidden rounded-xl bg-amber-400 px-6 py-3.5 text-sm font-bold tracking-wide text-[#0c0f1a] transition-all duration-200 hover:bg-amber-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {selectedParent ? "Adding Student…" : "Admitting Student…"}
                </span>
              ) : selectedParent ? (
                <span className="flex items-center justify-center gap-2">
                  <UserRoundPlus className="h-4 w-4" />
                  Add Student to {selectedParent.full_name}
                  {selectedParent.children.length > 0 && (
                    <span className="opacity-60 font-normal text-xs">
                      ({selectedParent.children.length + 1} children total)
                    </span>
                  )}
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <UserRoundPlus className="h-4 w-4" />
                  Admit Student & Create Parent Account
                </span>
              )}
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
