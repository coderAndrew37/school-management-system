"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Sparkles, Save, Loader2, Compass, Check } from "lucide-react";
import { saveJssPathwayAction } from "@/lib/actions/parent";
import type { JssPathway } from "@/lib/types/parent";
import { JSS_INTEREST_AREAS, JSS_PATHWAY_CLUSTERS } from "@/lib/types/parent";

// ── Toggle chip — matches .docket-tab pill style ──────────────────────────────
function ToggleChip({
  label,
  active,
  onToggle,
  color = "blue",
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
  color?: "blue" | "emerald" | "amber" | "purple";
}) {
  const styles: Record<string, string> = {
    blue: active
      ? "border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-200"
      : "border-slate-200 bg-white text-slate-500 hover:border-blue-400 hover:text-blue-600",
    emerald: active
      ? "border-emerald-600 bg-emerald-600 text-white shadow-md shadow-emerald-100"
      : "border-slate-200 bg-white text-slate-500 hover:border-emerald-400 hover:text-emerald-600",
    amber: active
      ? "border-amber-500 bg-amber-500 text-white shadow-md shadow-amber-100"
      : "border-slate-200 bg-white text-slate-500 hover:border-amber-400 hover:text-amber-600",
    purple: active
      ? "border-purple-600 bg-purple-600 text-white shadow-md shadow-purple-100"
      : "border-slate-200 bg-white text-slate-500 hover:border-purple-400 hover:text-purple-600",
  };
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all active:scale-95 ${styles[color]}`}
    >
      {active && <Check className="h-3 w-3 flex-shrink-0" />}
      {label}
    </button>
  );
}

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
    if (!careers.includes(customCareer.trim()))
      setCareers((prev) => [...prev, customCareer.trim()]);
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
      } else toast.error(res.message);
    });
  };

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
      <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-16 text-center">
        <p className="text-3xl mb-2">🎓</p>
        <p className="font-bold text-slate-600">JSS Pathway Guidance</p>
        <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
          Career pathway guidance is available for Grade 7–9 (Junior Secondary)
          students.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── AI Guidance — .alert .al-blue style ────────────────────────────── */}
      {guidance && (
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-5 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-100">
              <Compass className="h-4 w-4 text-purple-700" />
            </div>
            <p className="text-xs font-black uppercase tracking-widest text-purple-700">
              AI Career Guidance
            </p>
            <span className="text-[10px] font-bold text-purple-500 border border-purple-200 bg-white px-2 py-0.5 rounded-full">
              {pathway?.guidance_date
                ? `Updated ${new Date(pathway.guidance_date + "T00:00:00").toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}`
                : "Latest"}
            </span>
          </div>
          <p className="text-sm text-purple-800 leading-relaxed">{guidance}</p>
        </div>
      )}

      {/* ── Pathway cluster — .profile-card hover style ─────────────────────── */}
      <section className="space-y-3">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Recommended Pathway Cluster
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {Object.entries(JSS_PATHWAY_CLUSTERS).map(([name, info]) => (
            <button
              key={name}
              onClick={() => setCluster(cluster === name ? "" : name)}
              className={[
                "rounded-2xl border p-4 text-left transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5",
                cluster === name
                  ? "border-emerald-300 bg-emerald-50 ring-1 ring-emerald-300"
                  : "border-slate-200 bg-white hover:border-emerald-200",
              ].join(" ")}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{info.icon}</span>
                <p
                  className={`text-xs font-black ${cluster === name ? "text-emerald-700" : "text-slate-800"}`}
                >
                  {name}
                </p>
                {cluster === name && (
                  <Check className="h-3.5 w-3.5 text-emerald-600 ml-auto" />
                )}
              </div>
              <p className="text-[10px] font-semibold text-slate-400 line-clamp-2">
                Careers: {info.careers.slice(0, 3).join(", ")}…
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* ── Interest areas ─────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Interest Areas
        </h3>
        <div className="flex flex-wrap gap-2">
          {JSS_INTEREST_AREAS.map((area) => (
            <ToggleChip
              key={area}
              label={area}
              active={interests.includes(area)}
              onToggle={() => toggle(interests, area, setInterests)}
              color="blue"
            />
          ))}
        </div>
      </section>

      {/* ── Strong subjects ────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
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

      {/* ── Career interests ───────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Career Interests
        </h3>
        <div className="flex flex-wrap gap-2">
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
          {careers
            .filter((c) => !JSS_PATHWAY_CLUSTERS[cluster]?.careers.includes(c))
            .map((career) => (
              <button
                key={career}
                onClick={() =>
                  setCareers((prev) => prev.filter((x) => x !== career))
                }
                className="flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100 px-3.5 py-1.5 text-xs font-bold text-amber-700 transition-all"
              >
                {career}{" "}
                <span className="opacity-50 text-sm leading-none">×</span>
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
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 placeholder-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:bg-white"
          />
          <button
            onClick={addCustomCareer}
            className="rounded-xl border border-amber-300 bg-amber-100 hover:bg-amber-200 px-4 py-2 text-xs font-black text-amber-700 transition-all active:scale-95"
          >
            Add
          </button>
        </div>
      </section>

      {/* ── Learning style ─────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Learning Style
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
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
                "rounded-2xl border p-3.5 text-center transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5",
                style === value
                  ? "border-purple-300 bg-purple-50 ring-1 ring-purple-300"
                  : "border-slate-200 bg-white hover:border-purple-200",
              ].join(" ")}
            >
              <span className="text-2xl block mb-1.5">{icon}</span>
              <p
                className={`text-xs font-black ${style === value ? "text-purple-700" : "text-slate-600"}`}
              >
                {label}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* ── Save CTA ───────────────────────────────────────────────────────── */}
      <button
        onClick={handleSave}
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 py-3.5 text-sm font-black text-white transition-all active:scale-[0.98] shadow-lg shadow-blue-200"
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
