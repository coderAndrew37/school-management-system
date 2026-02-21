import { z } from "zod";

export const admissionSchema = z.object({
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

  gender: z.enum(["Male", "Female"], {
    message: "Please select a gender",
  }),

  currentGrade: z
    .string()
    .min(1, "Grade is required")
    .max(20, "Grade must be under 20 characters"),

  parentPhone: z
    .string()
    .min(10, "Phone number must be at least 10 digits")
    .max(15, "Phone number must be under 15 digits")
    .regex(
      /^(\+?254|0)[17]\d{8}$/,
      "Enter a valid Kenyan phone number (e.g. 0712345678)",
    ),

  parentEmail: z
    .string()
    .min(1, "Email is required")
    .email("Enter a valid email address"),

  parentName: z
    .string()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name must be under 100 characters")
    .regex(
      /^[a-zA-Z\s'-]+$/,
      "Name can only contain letters, spaces, hyphens, and apostrophes",
    ),
});

export type AdmissionFormValues = z.infer<typeof admissionSchema>;

export interface AdmissionActionResult {
  success: boolean;
  message: string;
  studentId?: string;
  readableId?: string;
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
  parent_id: string | null;
  created_at: string;
}
