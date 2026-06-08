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
    const session = await getSession();
    if (!session || !session.profile) {
      return { success: false, message: "Unauthorised" };
    }

    const { base_role, is_super_admin, is_dev, school_id } = session.profile;
    const isPlatformAdmin = is_super_admin || is_dev;

    if (base_role !== "admin" && !isPlatformAdmin) {
      return { success: false, message: "Unauthorised" };
    }

    // Critical Check: Enforce school isolation context
    if (!school_id) {
      return { success: false, message: "Action failed: Missing structural school ID linkage." };
    }

    const supabase = await createSupabaseServerClient();
    const parsed = classSchema.parse(data);

    // Inject school_id explicitly into mutations
    const { error } = await supabase.from("classes").insert({
      grade: parsed.grade,
      stream: parsed.stream,
      level: parsed.level,
      academic_year: parsed.academicYear,
      school_id: school_id, 
    });

    if (error) {
      if (error.code === "23505") {
        return { 
          success: false, 
          message: "This class and stream already exist for this academic year." 
        };
      }
      throw error;
    }

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