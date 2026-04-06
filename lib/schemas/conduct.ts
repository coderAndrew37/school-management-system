// lib/schemas/conduct.ts
// Single source of truth for conduct validation.
// Imported by the server action (lib/actions/conduct.ts) and the client
// components. Nothing in this file touches the DOM or the database.

import { z } from "zod";

// ── Enums — iterate these in the UI instead of duplicating string literals ────

export const CONDUCT_TYPES = ["merit", "demerit", "incident"] as const;
export const CONDUCT_CATEGORIES = [
  "academic",
  "behaviour",
  "leadership",
  "sport",
  "community",
  "other",
] as const;
export const SEVERITIES = ["low", "medium", "high"] as const;

export type ConductType = (typeof CONDUCT_TYPES)[number];
export type ConductCategory = (typeof CONDUCT_CATEGORIES)[number];
export type Severity = (typeof SEVERITIES)[number];

// ── Core schema ───────────────────────────────────────────────────────────────
// Points arrive as a positive integer; the action applies the sign based on type.
// grade / stream are denormalised onto the record so the feed never needs a join.

export const conductSchema = z.object({
  student_id: z.string().uuid("Please select a student."),
  grade: z.string().min(1, "Grade is required."),
  stream: z.string().min(1, "Stream is required."),
  academic_year: z.coerce.number().int().min(2020).max(2030),
  term: z.coerce.number().int().min(1).max(3),
  type: z.enum(CONDUCT_TYPES, { message: "Invalid conduct type." }),
  category: z.enum(CONDUCT_CATEGORIES, { message: "Invalid category." }),
  points: z.coerce.number().int().min(1).max(10),
  description: z
    .string()
    .min(1, "Description is required.")
    .max(1000, "Description must be under 1000 characters."),
  action_taken: z.string().max(500).optional().nullable(),
  severity: z.enum(SEVERITIES).optional().nullable(),
});

// Inferred types — import these instead of writing them by hand.
export type ConductInput = z.input<typeof conductSchema>;
export type ConductData = z.output<typeof conductSchema>;

// ── ActionState ───────────────────────────────────────────────────────────────
// Discriminated union consumed by useActionState in the client.
// The success arm echoes the full parsed data back so the client can build an
// optimistic record without a round-trip fetch.

export type ActionState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      fieldErrors: Partial<Record<keyof ConductInput, string[]>>;
    }
  | {
      status: "success";
      message: string;
      id: string;
      data: ConductData;
      studentName: string;
    };
