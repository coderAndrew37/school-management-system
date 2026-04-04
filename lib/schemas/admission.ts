import { z } from "zod";

// ── Shared student fields ─────────────────────────────────────────────────────

const studentFields = {
  studentName: z
    .string()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name must be under 100 characters")
    .regex(
      /^[a-zA-Z\s'-]+$/,
      "Name can only contain letters, spaces, hyphens, and apostrophes",
    ),

  dateOfBirth: z
    .string()
    .min(1, "Date of birth is required")
    .refine((val) => {
      const date = new Date(val);
      const now = new Date();
      const minAge = new Date(
        now.getFullYear() - 25,
        now.getMonth(),
        now.getDate(),
      );
      const maxAge = new Date(
        now.getFullYear() - 2,
        now.getMonth(),
        now.getDate(),
      );
      return date >= minAge && date <= maxAge;
    }, "Date of birth must represent a student aged 2–25 years"),

  gender: z.enum(["Male", "Female"], { message: "Please select a gender" }),

  currentGrade: z
    .string()
    .min(1, "Grade is required")
    .max(20, "Grade must be under 20 characters"),

  relationshipType: z
    .enum(["mother", "father", "guardian", "other"])
    .default("guardian"),
};

// ── Flat schema — discriminate manually in the action ─────────────────────────
// Zod's discriminatedUnion requires ZodLiteral discriminators. Using it with
// z.string().uuid() vs z.null() causes silent fallthrough. We use a single flat
// schema and validate parent fields conditionally in the server action instead.

// lib/schemas/admission.ts

export const admissionSchema = z.object({
  ...studentFields,

  // Optional if linking to existing parent, but required for Flow B
  parentName: z.string().min(2, "Parent name is required").optional(),
  parentEmail: z.string().email("Invalid email address").optional(),

  parentPhone: z
    .string()
    .regex(
      /^(?:254|\+254|0)?(7|1)(?:(?:[0-9][0-9])|(?:0[0-8]))[0-9]{6}$/,
      "Enter a valid Kenyan phone number (e.g., 0712345678)",
    )
    .optional(),
});

export type AdmissionFormValues = {
  studentName: string;
  dateOfBirth: string;
  gender: "Male" | "Female";
  currentGrade: string;
  relationshipType: "mother" | "father" | "guardian" | "other";
  existingParentId?: string | null;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
};

export interface AdmissionActionResult {
  success: boolean;
  message: string;
  studentId?: string;
}

export interface Parent {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  created_at: string;
}

export interface Student {
  id: string;
  readable_id: string | null;
  upi_number: string | null;
  full_name: string;
  date_of_birth: string;
  gender: "Male" | "Female" | null;
  current_grade: string;
  created_at: string;
}
