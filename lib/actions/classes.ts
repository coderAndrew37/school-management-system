"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const classSchema = z.object({
  grade: z.string().min(1, "Grade is required"),
  stream: z.string().default("Main"),
  level: z.enum(["lower_primary", "upper_primary", "junior_secondary"]),
  academicYear: z.number().int(),
});

export async function createClassAction(data: z.infer<typeof classSchema>) {
  try {
    const supabase = await createSupabaseServerClient();
    const parsed = classSchema.parse(data);

    const { error } = await supabase.from("classes").insert({
      grade: parsed.grade,
      stream: parsed.stream,
      level: parsed.level,
      academic_year: parsed.academicYear,
    });

    if (error) {
      if (error.code === "23505")
        throw new Error("This class and stream already exist for this year.");
      throw error;
    }

    revalidatePath("/admin/classes");
    revalidatePath("/admin/class-teachers");

    return { success: true, message: "Class created successfully." };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
