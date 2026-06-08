"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createSubjectAction, updateSubjectAction } from "@/lib/actions/subjects";
import type { Subject } from "@/lib/data/subjects";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface SubjectModalProps {
  subject?: Subject | null; // null/undefined = create mode
  open: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

interface FormFields {
  name: string;
  code: string;
  level: "lower_primary" | "upper_primary" | "junior_secondary";
  weekly_lessons: string; // keep as string for controlled input, coerce on submit
  knec_learning_area: string;
}

type FormErrors = Partial<Record<keyof FormFields, string>>;

const LEVEL_OPTIONS: {
  value: "lower_primary" | "upper_primary" | "junior_secondary";
  label: string;
}[] = [
  { value: "lower_primary", label: "Lower Primary" },
  { value: "upper_primary", label: "Upper Primary" },
  { value: "junior_secondary", label: "Junior Secondary" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

function validateForm(fields: FormFields): FormErrors {
  const errors: FormErrors = {};

  if (!fields.name.trim()) {
    errors.name = "Subject name is required.";
  } else if (fields.name.trim().length < 2) {
    errors.name = "Name must be at least 2 characters.";
  }

  if (!fields.code.trim()) {
    errors.code = "Subject code is required.";
  } else if (!/^[A-Za-z0-9\-_]{2,20}$/.test(fields.code.trim())) {
    errors.code = "Code must be 2–20 alphanumeric characters (hyphens/underscores allowed).";
  }

  if (!fields.level) {
    errors.level = "Education level is required.";
  }

  const lessons = parseInt(fields.weekly_lessons, 10);
  if (isNaN(lessons) || lessons < 1) {
    errors.weekly_lessons = "Weekly lessons must be a positive whole number.";
  } else if (lessons > 10) {
    errors.weekly_lessons = "Weekly lessons cannot exceed 10.";
  }

  return errors;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function SubjectModal({
  subject,
  open,
  onClose,
  onSuccess,
}: SubjectModalProps) {
  const isEdit = !!subject;
  const overlayRef = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string>("");
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const [fields, setFields] = useState<FormFields>({
    name: "",
    code: "",
    level: "lower_primary",
    weekly_lessons: "5",
    knec_learning_area: "",
  });

  // Track previous open state to catch raw transitions without cascading loops
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setFields({
        name: subject?.name ?? "",
        code: subject?.code ?? "",
        level: subject?.level ?? "lower_primary",
        weekly_lessons: subject ? String(subject.weekly_lessons) : "5",
        knec_learning_area: subject?.knec_learning_area ?? "",
      });
      setFormErrors({});
      setServerError("");
    }
  }

  // Close on backdrop click
  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) {
      onClose();
    }
  }

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;
    setFields((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name as keyof FormErrors]) {
      setFormErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }

  function handleSubmit() {
    const errors = validateForm(fields);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setServerError("");

    const formData = new FormData();
    formData.set("name", fields.name.trim());
    formData.set("code", fields.code.trim().toUpperCase());
    formData.set("level", fields.level);
    formData.set("weekly_lessons", fields.weekly_lessons);
    if (fields.knec_learning_area.trim()) {
      formData.set("knec_learning_area", fields.knec_learning_area.trim());
    }

    startTransition(async () => {
      const result = isEdit
        ? await updateSubjectAction(subject!.id, formData)
        : await createSubjectAction(formData);

      if (!result.success) {
        setServerError(result.message);
        return;
      }

      onSuccess(result.message);
      onClose();
    });
  }

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="subject-modal-title"
    >
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-blue-900 px-6 py-5 flex items-center justify-between">
          <div>
            <h2
              id="subject-modal-title"
              className="text-lg font-bold text-white tracking-tight"
            >
              {isEdit ? "Edit Subject" : "Add New Subject"}
            </h2>
            <p className="text-blue-200 text-sm mt-0.5">
              {isEdit
                ? "Update subject details below."
                : "Fill in the details for the new subject."}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isPending}
            className="text-blue-200 hover:text-white transition-colors p-1 rounded-lg hover:bg-blue-800 disabled:opacity-50"
            aria-label="Close modal"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-5">
          {serverError && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <svg
                className="w-5 h-5 text-red-500 mt-0.5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z"
                />
              </svg>
              <p className="text-sm text-red-700 font-medium">{serverError}</p>
            </div>
          )}

          {/* Name */}
          <div>
            <label
              className="block text-sm font-semibold text-slate-700 mb-1.5"
              htmlFor="subject-name"
            >
              Subject Name <span className="text-red-500">*</span>
            </label>
            <input
              id="subject-name"
              name="name"
              type="text"
              value={fields.name}
              onChange={handleChange}
              disabled={isPending}
              placeholder="e.g. Mathematics"
              className={`w-full px-4 py-2.5 rounded-xl border text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all disabled:opacity-60 disabled:bg-slate-50 ${
                formErrors.name
                  ? "border-red-300 focus:ring-red-200 bg-red-50"
                  : "border-slate-200 focus:ring-blue-200 focus:border-blue-400 bg-white"
              }`}
            />
            {formErrors.name && (
              <p className="mt-1.5 text-xs text-red-600">{formErrors.name}</p>
            )}
          </div>

          {/* Code */}
          <div>
            <label
              className="block text-sm font-semibold text-slate-700 mb-1.5"
              htmlFor="subject-code"
            >
              Subject Code <span className="text-red-500">*</span>
            </label>
            <input
              id="subject-code"
              name="code"
              type="text"
              value={fields.code}
              onChange={handleChange}
              disabled={isPending}
              placeholder="e.g. MAT-LP"
              className={`w-full px-4 py-2.5 rounded-xl border text-sm text-slate-800 uppercase placeholder:normal-case placeholder:text-slate-400 font-mono focus:outline-none focus:ring-2 transition-all disabled:opacity-60 disabled:bg-slate-50 ${
                formErrors.code
                  ? "border-red-300 focus:ring-red-200 bg-red-50"
                  : "border-slate-200 focus:ring-blue-200 focus:border-blue-400 bg-white"
              }`}
            />
            {formErrors.code ? (
              <p className="mt-1.5 text-xs text-red-600">{formErrors.code}</p>
            ) : (
              <p className="mt-1.5 text-xs text-slate-400">
                Unique per school. Auto-uppercased.
              </p>
            )}
          </div>

          {/* Level + Weekly Lessons */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                className="block text-sm font-semibold text-slate-700 mb-1.5"
                htmlFor="subject-level"
              >
                Education Level <span className="text-red-500">*</span>
              </label>
              <select
                id="subject-level"
                name="level"
                value={fields.level}
                onChange={handleChange}
                disabled={isPending}
                className={`w-full px-4 py-2.5 rounded-xl border text-sm text-slate-800 focus:outline-none focus:ring-2 transition-all disabled:opacity-60 disabled:bg-slate-50 appearance-none bg-no-repeat cursor-pointer ${
                  formErrors.level
                    ? "border-red-300 focus:ring-red-200 bg-red-50"
                    : "border-slate-200 focus:ring-blue-200 focus:border-blue-400 bg-white"
                }`}
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                  backgroundPosition: "right 12px center",
                  backgroundSize: "16px",
                  paddingRight: "36px",
                }}
              >
                {LEVEL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {formErrors.level && (
                <p className="mt-1.5 text-xs text-red-600">{formErrors.level}</p>
              )}
            </div>

            <div>
              <label
                className="block text-sm font-semibold text-slate-700 mb-1.5"
                htmlFor="subject-weekly"
              >
                Weekly Lessons <span className="text-red-500">*</span>
              </label>
              <input
                id="subject-weekly"
                name="weekly_lessons"
                type="number"
                min={1}
                max={10}
                value={fields.weekly_lessons}
                onChange={handleChange}
                disabled={isPending}
                className={`w-full px-4 py-2.5 rounded-xl border text-sm text-slate-800 focus:outline-none focus:ring-2 transition-all disabled:opacity-60 disabled:bg-slate-50 ${
                  formErrors.weekly_lessons
                    ? "border-red-300 focus:ring-red-200 bg-red-50"
                    : "border-slate-200 focus:ring-blue-200 focus:border-blue-400 bg-white"
                }`}
              />
              {formErrors.weekly_lessons && (
                <p className="mt-1.5 text-xs text-red-600">
                  {formErrors.weekly_lessons}
                </p>
              )}
            </div>
          </div>

          {/* KNEC Learning Area */}
          <div>
            <label
              className="block text-sm font-semibold text-slate-700 mb-1.5"
              htmlFor="subject-knec"
            >
              KNEC Learning Area
              <span className="ml-2 text-xs font-normal text-slate-400">
                (optional)
              </span>
            </label>
            <input
              id="subject-knec"
              name="knec_learning_area"
              type="text"
              value={fields.knec_learning_area}
              onChange={handleChange}
              disabled={isPending}
              placeholder="e.g. Mathematical Activities"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-white transition-all disabled:opacity-60 disabled:bg-slate-50"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-900 hover:bg-blue-800 active:bg-blue-950 transition-colors disabled:opacity-60 flex items-center gap-2 min-w-[120px] justify-center"
          >
            {isPending ? (
              <>
                <svg
                  className="w-4 h-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                {isEdit ? "Saving…" : "Creating…"}
              </>
            ) : isEdit ? (
              "Save Changes"
            ) : (
              "Create Subject"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}