"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";
import { generateTimetableAction } from "@/lib/actions/allocation";

interface GenerateTimetableButtonProps {
  academicYear?: number;
}

export function GenerateTimetableButton({
  academicYear = 2026,
}: GenerateTimetableButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleGenerate = () => {
    if (
      !window.confirm(
        "This will regenerate the entire timetable for all grades and overwrite any existing schedule. Continue?",
      )
    )
      return;

    startTransition(async () => {
      toast.loading("Generating timetable…", { id: "timetable-gen" });
      const result = await generateTimetableAction(academicYear);
      toast.dismiss("timetable-gen");

      if (result.success) {
        toast.success("Timetable Generated!", {
          description: result.message,
          duration: 7000,
        });
      } else {
        toast.error("Generation Failed", { description: result.message });
      }
    });
  };

  return (
    <button
      onClick={handleGenerate}
      disabled={isPending}
      className="group relative flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 hover:bg-emerald-400/20 active:scale-95 transition-all duration-200 px-5 py-2.5 text-sm font-bold text-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed overflow-hidden"
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Sparkles className="h-4 w-4" />
      )}
      {isPending ? "Generating…" : "Generate Timetable"}
      <span className="absolute inset-0 -skew-x-12 translate-x-[-200%] bg-white/10 transition-transform duration-500 group-hover:translate-x-[200%]" />
    </button>
  );
}
