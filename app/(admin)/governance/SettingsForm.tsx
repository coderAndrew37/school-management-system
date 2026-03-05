"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { updateSystemSettingsAction } from "@/lib/actions/governance";
import { KButton, KInput } from "@/app/_components/shared/Forms";

interface SettingsFormProps {
  initialData: {
    current_academic_year: number;
    current_term: number;
    school_name: string;
  } | null;
}

export default function SettingsForm({ initialData }: SettingsFormProps) {
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsPending(true);

    const formData = new FormData(e.currentTarget);
    const result = await updateSystemSettingsAction(formData);

    if (result.success) {
      toast.success("Governance settings updated!");
    } else {
      toast.error(result.message);
    }
    setIsPending(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* School Name */}
        <div className="md:col-span-2">
          <KInput
            label="Official School Name"
            name="schoolName"
            defaultValue={initialData?.school_name || "Kibali Academy"}
            placeholder="e.g. Kibali Academy Primary"
            required
          />
        </div>

        {/* Academic Year */}
        <KInput
          label="Active Academic Year"
          name="academicYear"
          type="number"
          defaultValue={initialData?.current_academic_year || 2026}
          min={2024}
          max={2030}
          required
        />

        {/* Term Selection */}
        <div className="space-y-1.5 w-full">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
            Active Term
          </label>
          <select
            aria-label="term"
            name="term"
            defaultValue={initialData?.current_term || 1}
            className="w-full bg-[#1A1A1C] border border-white/10 focus:border-emerald-500/50 rounded-xl px-4 py-2.5 text-sm text-white outline-none transition-all appearance-none"
          >
            <option value="1">Term 1 (Opening)</option>
            <option value="2">Term 2 (Mid-Year)</option>
            <option value="3">Term 3 (Finals/Reporting)</option>
          </select>
        </div>
      </div>

      <div className="pt-4 border-t border-white/5 flex justify-end">
        <KButton
          type="submit"
          disabled={isPending}
          className="w-full md:w-auto px-8"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Apply Changes
        </KButton>
      </div>
    </form>
  );
}
