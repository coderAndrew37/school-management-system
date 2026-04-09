"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/actions/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ── 1. Validation Schema ──────────────────────────────────────────────────────

const classSchema = z.object({
  grade: z.string().min(1, "Grade is required"),
  stream: z.string().default("Main"),
  level: z.enum(["lower_primary", "upper_primary", "junior_secondary"]),
  academicYear: z.number().int(),
});

export type CreateClassInput = z.infer<typeof classSchema>;

// ── 2. Create Class Action ────────────────────────────────────────────────────

export async function createClassAction(data: CreateClassInput) {
  try {
    // Check Authorization
    const session = await getSession();
    if (!session || !["admin", "superadmin"].includes(session.profile.role)) {
      return { success: false, message: "Unauthorised" };
    }

    const supabase = await createSupabaseServerClient();
    const parsed = classSchema.parse(data);

    const { error } = await supabase.from("classes").insert({
      grade: parsed.grade,
      stream: parsed.stream,
      level: parsed.level,
      academic_year: parsed.academicYear,
    });

    if (error) {
      // Handle Unique Constraint Violation (Postgres code 23505)
      if (error.code === "23505") {
        return { 
          success: false, 
          message: "This class and stream already exist for this academic year." 
        };
      }
      throw error;
    }

    // Revalidate paths to update UI
    revalidatePath("/admin/classes");
    revalidatePath("/admin/class-teachers");

    return { success: true, message: "Class created successfully." };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "An unexpected error occurred";
    console.error("[createClassAction] Error:", msg);
    
    return { 
      success: false, 
      message: msg 
    };
  }
}