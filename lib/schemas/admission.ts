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
  classId: z.string().uuid("Invalid class selection"),

  relationshipType: z
    .enum(["mother", "father", "guardian", "other"]),
};

/**
 * The full admission schema including parent logic.
 */
export const admissionSchema = z
  .object({
    ...studentFields,

    // Handled via the ParentSearchBox or initialized as null
    existingParentId: z.string().uuid().optional().nullable(),

    // Conditional fields: used only if existingParentId is not provided
    parentName: z.string().optional(),
    parentEmail: z.string().email("Invalid email address").optional(),
    parentPhone: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // If creating a new parent, enforce required fields
    if (!data.existingParentId) {
      if (!data.parentName?.trim()) {
        ctx.addIssue({
          code: "custom",
          message: "Parent full name is required",
          path: ["parentName"],
        });
      }

      if (!data.parentEmail?.trim()) {
        ctx.addIssue({
          code: "custom",
          message: "Parent email is required",
          path: ["parentEmail"],
        });
      } else if (!z.string().email().safeParse(data.parentEmail).success) {
        ctx.addIssue({
          code: "custom",
          message: "Invalid email address",
          path: ["parentEmail"],
        });
      }

      if (!data.parentPhone?.trim()) {
        ctx.addIssue({
          code: "custom",
          message: "Parent phone number is required",
          path: ["parentPhone"],
        });
      }
    }
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