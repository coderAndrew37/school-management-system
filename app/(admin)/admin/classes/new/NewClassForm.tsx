"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClassAction } from "@/lib/actions/classes";
import { Save, ChevronLeft, Calendar } from "lucide-react";
import Link from "next/link";

interface Props {
  currentYear: number;
}

export function NewClassForm({ currentYear }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      grade: formData.get("grade") as string,
      stream: formData.get("stream") as string,
      level: formData.get("level") as any,
      academicYear: Number(formData.get("academicYear")),
    };

    const res = await createClassAction(data);
    if (res.success) {
      router.push("/admin/classes");
    } else {
      alert(res.message);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0f172a] p-6 text-white flex justify-center items-start pt-20">
      <div className="w-full max-w-md space-y-6">
        <Link
          href="/admin/classes"
          className="text-slate-400 hover:text-white flex items-center gap-2 text-sm font-medium transition-colors"
        >
          <ChevronLeft size={16} /> Back to Registry
        </Link>

        <form
          onSubmit={handleSubmit}
          className="bg-[#1e293b] p-8 rounded-3xl border border-slate-800 space-y-6 shadow-2xl relative overflow-hidden"
        >
          {/* Subtle Year Indicator */}
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Calendar size={80} />
          </div>

          <div className="relative">
            <h2 className="text-xl font-bold">New Class Setup</h2>
            <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mt-1">
              Active Session: {currentYear}
            </p>
          </div>

          {/* Hidden input to pass the dynamic year */}
          <input type="hidden" name="academicYear" value={currentYear} />

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-500 ml-1">
              Grade Label
            </label>
            <input
              name="grade"
              placeholder="e.g. Grade 4"
              required
              className="w-full bg-[#0f172a] border border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-500 ml-1">
              Stream / Wing
            </label>
            <input
              placeholder="e.g. North"
              name="stream"
              defaultValue="Main"
              required
              className="w-full bg-[#0f172a] border border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-500 ml-1">
              Education Level
            </label>
            <div className="relative">
              <select
                id="level"
                aria-label="select level"
                defaultValue="lower_primary"
                name="level"
                required
                className="w-full bg-[#0f172a] border border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer"
              >
                <option value="lower_primary">Lower Primary (PP1 - G3)</option>
                <option value="upper_primary">Upper Primary (G4 - G6)</option>
                <option value="junior_secondary">
                  Junior Secondary (JSS 1 - 3)
                </option>
              </select>
              <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-500">
                <ChevronLeft size={16} className="-rotate-90" />
              </div>
            </div>
          </div>

          <button
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-blue-900/20 active:scale-[0.98]"
          >
            <Save size={18} />
            {loading ? "Initializing..." : "Register Class"}
          </button>
        </form>

        <p className="text-center text-[10px] text-slate-500 font-medium px-4">
          Note: Ensure the grade and stream combination is unique for the{" "}
          {currentYear} academic year to avoid system conflicts.
        </p>
      </div>
    </div>
  );
}
