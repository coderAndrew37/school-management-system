import { z } from "zod";

export const teacherRegistrationSchema = z.object({
  fullName: z.string().min(3, "Full name must be at least 3 characters"),
  email: z.string().email("Please enter a valid work email"),
  phone: z.string().min(10, "Valid phone number is required"),
  tscNumber: z
    .string()
    .min(5, "TSC Number is too short")
    .regex(/^[0-9]+$/, "TSC Number must contain only digits"),
});

export type TeacherFormValues = z.infer<typeof teacherRegistrationSchema>;
