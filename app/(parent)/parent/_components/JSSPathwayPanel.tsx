"use client";

import { saveJssPathwayAction } from "@/lib/actions/parent";
import type { JssPathway } from "@/lib/types/parent";
import { JSS_INTEREST_AREAS, JSS_PATHWAY_CLUSTERS } from "@/lib/types/parent";
import { Check, Compass, Loader2, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

// ── Helpers ───────────────────────────────────────────────────────────────────

function ToggleChip({
  label,
  active,
  onToggle,
  color = "sky",
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
  color?: "sky" | "emerald" | "amber" | "purple";
}) {
  const styles = {
    sky: active
      ? "bg-sky-400/15 border-sky-400/40 text-sky-400"
      : "border-white/10 text-white/40 hover:text-white hover:border-white/20",
    emerald: active
      ? "bg-emerald-400/15 border-emerald-400/40 text-emerald-400"
      : "border-white/10 text-white/40 hover:text-white hover:border-white/20",
    amber: active
      ? "bg-amber-400/15 border-amber-400/40 text-amber-400"
      : "border-white/10 text-white/40 hover:text-white hover:border-white/20",
    purple: active
      ? "bg-purple-400/15 border-purple-400/40 text-purple-400"
      : "border-white/10 text-white/40 hover:text-white hover:border-white/20",
  };
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold border transition-all ${styles[color]}`}
    >
      {active && <Check className="h-3 w-3 flex-shrink-0" />}
      {label}
    </button>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  pathway: JssPathway | null;
  studentId: string;
  studentName: string;
  grade: string;
}

export function JssPathwayPanel({
  pathway,
  studentId,
  studentName,
  grade,
}: Props) {
  const [interests, setInterests] = useState<string[]>(
    pathway?.interest_areas ?? [],
  );
  const [subjects, setSubjects] = useState<string[]>(
    pathway?.strong_subjects ?? [],
  );
  const [careers, setCareers] = useState<string[]>(
    pathway?.career_interests ?? [],
  );
  const [style, setStyle] = useState<string>(pathway?.learning_style ?? "");
  const [cluster, setCluster] = useState<string>(
    pathway?.pathway_cluster ?? "",
  );
  const [guidance, setGuidance] = useState<string>(pathway?.ai_guidance ?? "");
  const [isPending, startTransition] = useTransition();
  const [customCareer, setCustomCareer] = useState("");

  // Determine if this student is JSS level
  const isJss =
    grade.includes("JSS") ||
    grade.includes("Grade 7") ||
    grade.includes("Grade 8") ||
    grade.includes("Grade 9");

  const toggle = (
    arr: string[],
    item: string,
    setter: (v: string[]) => void,
  ) => {
    setter(arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item]);
  };

  const addCustomCareer = () => {
    if (!customCareer.trim()) return;
    if (!careers.includes(customCareer.trim())) {
      setCareers((prev) => [...prev, customCareer.trim()]);
    }
    setCustomCareer("");
  };

  const handleSave = () => {
    startTransition(async () => {
      const fd = new FormData();
      fd.append("student_id", studentId);
      fd.append("student_name", studentName);
      fd.append("grade", grade);
      fd.append("interest_areas", interests.join(","));
      fd.append("strong_subjects", subjects.join(","));
      fd.append("career_interests", careers.join(","));
      fd.append("learning_style", style);
      fd.append("pathway_cluster", cluster);

      const res = await saveJssPathwayAction(fd);
      if (res.success) {
        if (res.guidance) setGuidance(res.guidance);
        toast.success("Pathway saved & AI guidance generated ✨");
      } else {
        toast.error(res.message);
      }
    });
  };

  // All CBC subjects by level
  const jssSubjects = [
    "English & Literature",
    "Kiswahili & Kenya Sign Language",
    "Mathematics",
    "Integrated Science",
    "Social Studies",
    "Business Studies",
    "Agriculture",
    "Pre-Technical Studies",
    "Creative Arts & Sports",
    "Religious Education",
  ];

  if (!isJss) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center">
        <p className="text-3xl mb-2">🎓</p>
        <p className="text-sm text-white/40">JSS Pathway Guidance</p>
        <p className="text-xs text-white/25 mt-1 max-w-xs mx-auto">
          Career pathway guidance is available for Grade 7–9 (Junior Secondary)
          students.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {/* AI Guidance display */}
      {guidance && (
        <div className="rounded-2xl border border-purple-400/25 bg-purple-400/[0.06] p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-purple-400" />
            <p className="text-xs font-bold uppercase tracking-widest text-purple-400">
              AI Career Guidance
            </p>
            <span className="text-[10px] text-purple-400/50 border border-purple-400/20 px-2 py-0.5 rounded-full">
              {pathway?.guidance_date
                ? `Updated ${new Date(pathway.guidance_date + "T00:00:00").toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}`
                : "Latest"}
            </span>
          </div>
          <p className="text-sm text-white/70 leading-relaxed">{guidance}</p>
        </div>
      )}

      {/* Pathway cluster recommendation */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-white/40">
          Recommended Pathway Cluster
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {Object.entries(JSS_PATHWAY_CLUSTERS).map(([name, info]) => (
            <button
              key={name}
              onClick={() => setCluster(cluster === name ? "" : name)}
              className={[
                "rounded-xl border p-4 text-left transition-all",
                cluster === name
                  ? "border-emerald-400/40 bg-emerald-400/10"
                  : "border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04]",
              ].join(" ")}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{info.icon}</span>
                <p
                  className={`text-xs font-bold ${cluster === name ? "text-emerald-400" : "text-white"}`}
                >
                  {name}
                </p>
                {cluster === name && (
                  <Check className="h-3.5 w-3.5 text-emerald-400 ml-auto" />
                )}
              </div>
              <p className="text-[10px] text-white/35 line-clamp-2">
                Careers: {info.careers.slice(0, 3).join(", ")}…
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* Interest areas */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-white/40">
          Interest Areas
        </h3>
        <div className="flex flex-wrap gap-2">
          {JSS_INTEREST_AREAS.map((area) => (
            <ToggleChip
              key={area}
              label={area}
              active={interests.includes(area)}
              onToggle={() => toggle(interests, area, setInterests)}
              color="sky"
            />
          ))}
        </div>
      </section>

      {/* Strong subjects */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-white/40">
          Strong Subjects
        </h3>
        <div className="flex flex-wrap gap-2">
          {jssSubjects.map((subj) => (
            <ToggleChip
              key={subj}
              label={subj}
              active={subjects.includes(subj)}
              onToggle={() => toggle(subjects, subj, setSubjects)}
              color="emerald"
            />
          ))}
        </div>
      </section>

      {/* Career interests */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-white/40">
          Career Interests
        </h3>
        <div className="flex flex-wrap gap-2">
          {/* Suggest from selected cluster */}
          {cluster &&
            JSS_PATHWAY_CLUSTERS[cluster]?.careers.map((career) => (
              <ToggleChip
                key={career}
                label={career}
                active={careers.includes(career)}
                onToggle={() => toggle(careers, career, setCareers)}
                color="amber"
              />
            ))}
          {/* Custom careers */}
          {careers
            .filter((c) => !JSS_PATHWAY_CLUSTERS[cluster]?.careers.includes(c))
            .map((career) => (
              <button
                key={career}
                onClick={() =>
                  setCareers((prev) => prev.filter((x) => x !== career))
                }
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold border bg-amber-400/15 border-amber-400/40 text-amber-400"
              >
                {career}{" "}
                <span className="opacity-50 text-base leading-none">×</span>
              </button>
            ))}
        </div>
        {/* Add custom */}
        <div className="flex gap-2">
          <input
            value={customCareer}
            onChange={(e) => setCustomCareer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustomCareer();
              }
            }}
            placeholder="Add a career interest…"
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-white/20 text-xs"
          />
          <button
            onClick={addCustomCareer}
            className="rounded-xl border border-amber-400/30 bg-amber-400/5 hover:bg-amber-400/15 px-3 py-2 text-xs font-bold text-amber-400 transition-all"
          >
            Add
          </button>
        </div>
      </section>

      {/* Learning style */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-white/40">
          Learning Style
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { value: "visual", label: "Visual", icon: "👁️" },
            { value: "auditory", label: "Auditory", icon: "👂" },
            { value: "kinaesthetic", label: "Kinaesthetic", icon: "🤲" },
            { value: "reading_writing", label: "Reading/Writing", icon: "📖" },
          ].map(({ value, label, icon }) => (
            <button
              key={value}
              onClick={() => setStyle(style === value ? "" : value)}
              className={[
                "rounded-xl border p-3 text-center transition-all",
                style === value
                  ? "border-purple-400/40 bg-purple-400/10"
                  : "border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04]",
              ].join(" ")}
            >
              <span className="text-2xl block mb-1">{icon}</span>
              <p
                className={`text-xs font-semibold ${style === value ? "text-purple-400" : "text-white/60"}`}
              >
                {label}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-500 to-sky-500 hover:from-purple-400 hover:to-sky-400 disabled:opacity-50 py-3.5 text-sm font-bold text-white transition-all active:scale-[0.98] shadow-lg shadow-purple-500/20"
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating AI Guidance…
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Save & Generate AI Career Guidance
          </>
        )}
      </button>
    </div>
  );
}
