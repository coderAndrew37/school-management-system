import { z } from "zod";

/**
 * Core student fields used in the admission process.
 */
const studentFields = {
  studentName: z
    .string()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name must be under 100 characters"),
  
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  
  gender: z.enum(["Male", "Female"], { message: "Please select a gender" }),

  // Matches the component's 'classId' and the database FK
  classId: z.string().min(1, "Class selection is required"),

  relationshipType: z
    .enum(["mother", "father", "guardian", "other"])
    .default("guardian"),
};

/**
 * The full admission schema including parent logic.
 */
export const admissionSchema = z.object({
  ...studentFields,
  
  // Handled via the ParentSearchBox or initialized as null
  existingParentId: z.string().optional().nullable(),

  // Conditional fields: used only if existingParentId is not provided
  parentName: z.string().optional(),
  parentEmail: z
    .string()
    .email("Invalid email address")
    .optional()
    .or(z.literal("")),
  parentPhone: z.string().optional().or(z.literal("")),
});

// ── TYPES ────────────────────────────────────────────────────────────────────

/**
 * Form values inferred directly from the Zod schema
 */
export type AdmissionFormValues = z.infer<typeof admissionSchema>;

/**
 * Standardized response for the admission server action
 */
export type AdmissionActionResult = {
  success: boolean;
  message: string;
  studentId?: string;
};