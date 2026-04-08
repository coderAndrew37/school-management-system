import { z } from "zod";

export const paySchema = z.object({
  student_id: z.string().min(1, "Student required"),
  term: z.coerce.number().int().min(1).max(3),
  amount_due: z.coerce.number().min(0),
  amount_paid: z.coerce.number().min(0),
  payment_method: z.enum(["mpesa", "bank_transfer", "cash", "cheque", "other"]),
  mpesa_code: z
    .string()
    .max(30)
    .optional()
    .transform((v) => v || ""),
  notes: z
    .string()
    .max(500)
    .optional()
    .transform((v) => v || ""),
});

export type PayValues = z.infer<typeof paySchema>;

export const fsSchema = z.object({
  class_id: z.string().min(1, "Class required"),
  term: z.coerce.number().int().min(1).max(3),
  tuition_fee: z.coerce.number().min(0),
  activity_fee: z.coerce.number().min(0),
  lunch_fee: z.coerce.number().min(0),
  transport_fee: z.coerce.number().min(0),
  other_fee: z.coerce.number().min(0),
  notes: z
    .string()
    .max(500)
    .optional()
    .transform((v) => v || ""),
});

export type FsValues = z.infer<typeof fsSchema>;