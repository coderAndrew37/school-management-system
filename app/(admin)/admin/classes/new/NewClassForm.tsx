"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClassAction, CreateClassInput } from "@/lib/actions/classes";
import { Save, ChevronLeft, Calendar, GraduationCap } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

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
    
    const data: CreateClassInput = {
      grade: formData.get("grade") as string,
      stream: formData.get("stream") as string,
      level: formData.get("level") as CreateClassInput["level"],
      academicYear: Number(formData.get("academicYear")),
    };

    // Initialize the sonner toast lifecycle tracker
    toast.promise(createClassAction(data), {
      loading: "Saving class structure to registry...",
      success: (res) => {
        if (!res.success) {
          setLoading(false);
          // Throwing passes the error message directly down to the 'error' render block
          throw new Error(res.message);
        }
        router.push("/admin/classes");
        return "Class registered successfully!";
      },
      error: (err: Error) => {
        setLoading(false);
        return err.message || "Failed to create class.";
      },
    });
  }

  return (
    <div className="min-h-screen bg-[#0c0f1a] p-6 text-white flex justify-center items-start pt-20 relative font-[family-name:var(--font-body)]">
      
      {/* Ambient background accent glows matching the app layout */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-60 left-1/4 w-[600px] h-[600px] rounded-full bg-amber-500/[0.03] blur-[130px]" />
        <div className="absolute top-1/2 right-1/4 w-80 h-80 rounded-full bg-sky-500/[0.03] blur-[110px]" />
      </div>

      <div className="w-full max-w-md space-y-6 relative z-10">
        <Link
          href="/admin/classes"
          className="text-white/30 hover:text-white/70 flex items-center gap-1.5 text-xs font-semibold tracking-tight transition-colors"
        >
          <ChevronLeft size={14} /> Back to Registry
        </Link>

        <form
          onSubmit={handleSubmit}
          className="bg-white/[0.03] p-8 rounded-3xl border border-white/[0.07] space-y-6 shadow-2xl relative overflow-hidden backdrop-blur-md"
        >
          {/* Subtle Dynamic Indicator Accent */}
          <div className="absolute -right-4 -bottom-4 opacity-[0.02] text-white pointer-events-none">
            <GraduationCap size={160} />
          </div>

          <div className="relative flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white">New Class Setup</h2>
              <p className="text-[10px] text-amber-400/80 font-bold uppercase tracking-[0.15em] mt-1 font-mono">
                Active Session: {currentYear}
              </p>
            </div>
            <div className="h-9 w-9 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400">
              <Calendar size={16} />
            </div>
          </div>

          <input type="hidden" name="academicYear" value={currentYear} />

          {/* Grade Input */}
          <div className="space-y-2">
            <label htmlFor="grade-input" className="text-[10px] font-black uppercase tracking-wider text-white/25 ml-1">
              Grade Label
            </label>
            <input
              id="grade-input"
              name="grade"
              placeholder="e.g. Grade 4"
              required
              disabled={loading}
              className="w-full bg-[#0c0f1a] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400/40 transition-all disabled:opacity-50"
            />
          </div>

          {/* Stream Input */}
          <div className="space-y-2">
            <label htmlFor="stream-input" className="text-[10px] font-black uppercase tracking-wider text-white/25 ml-1">
              Stream / Wing
            </label>
            <input
              id="stream-input"
              placeholder="e.g. North"
              name="stream"
              defaultValue="Main"
              required
              disabled={loading}
              className="w-full bg-[#0c0f1a] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400/40 transition-all disabled:opacity-50"
            />
          </div>

          {/* Education Level Dropdown */}
          <div className="space-y-2">
            <label htmlFor="level-select" className="text-[10px] font-black uppercase tracking-wider text-white/25 ml-1">
              Education Level
            </label>
            <div className="relative">
              <select
                id="level-select"
                defaultValue="lower_primary"
                name="level"
                required
                disabled={loading}
                className="w-full bg-[#0c0f1a] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400/40 appearance-none cursor-pointer transition-all disabled:opacity-50"
              >
                <option value="lower_primary" className="bg-[#0c0f1a]">Lower Primary (PP1 - G3)</option>
                <option value="upper_primary" className="bg-[#0c0f1a]">Upper Primary (G4 - G6)</option>
                <option value="junior_secondary" className="bg-[#0c0f1a]">Junior Secondary (JSS 1 - 3)</option>
              </select>
              <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-white/30">
                <ChevronLeft size={14} className="-rotate-90" />
              </div>
            </div>
          </div>

          {/* Submit Action Block */}
          <button
            disabled={loading}
            className="w-full bg-amber-400 hover:bg-amber-300 text-[#0c0f1a] py-3.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.98] shadow-lg shadow-amber-500/[0.05]"
          >
            <Save size={14} strokeWidth={3} />
            {loading ? "Registering..." : "Register Class"}
          </button>
        </form>

        <p className="text-center text-[10px] text-white/25 font-medium px-4 font-mono">
          Note: Ensure the grade and stream configuration is completely unique for the tracking scope of the {currentYear} year loop.
        </p>
      </div>
    </div>
  );
}