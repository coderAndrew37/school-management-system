"use client";

// app/teacher/pathway/PathwayClient.tsx

import { useState, useTransition } from "react";
import { saveJssPathwayAction } from "@/lib/actions/teacher";
import type { ClassStudent } from "@/lib/data/assessment";
import type { JssPathwayRecord } from "./page";

// ── Constants ─────────────────────────────────────────────────────────────────

const PATHWAYS = [
  {
    id: "STEM",
    label: "STEM",
    cluster: "Science, Technology, Engineering & Mathematics",
    description: "Mathematics, Sciences, Computer Science, Engineering",
    color: "sky",
    icon: "🔬",
    bg: "bg-sky-50",
    border: "border-sky-200",
    activeBg: "bg-sky-600",
    activeBorder: "border-sky-600",
    text: "text-sky-700",
  },
  {
    id: "Arts & Sports Science",
    label: "Arts & Sports",
    cluster: "Arts, Sports Science & Creative Industries",
    description: "Visual Arts, Music, PE, Drama, Creative Design",
    color: "purple",
    icon: "🎨",
    bg: "bg-purple-50",
    border: "border-purple-200",
    activeBg: "bg-purple-600",
    activeBorder: "border-purple-600",
    text: "text-purple-700",
  },
  {
    id: "Social Sciences",
    label: "Social Sciences",
    cluster: "Humanities & Social Sciences",
    description: "History, Geography, CRE/IRE, Social Studies, Languages",
    color: "amber",
    icon: "🌍",
    bg: "bg-amber-50",
    border: "border-amber-200",
    activeBg: "bg-amber-500",
    activeBorder: "border-amber-500",
    text: "text-amber-700",
  },
  {
    id: "Technical & Applied",
    label: "Technical & Applied",
    cluster: "Technical & Applied Sciences",
    description: "Business, Agriculture, Home Science, Technical Drawing",
    color: "emerald",
    icon: "⚙️",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    activeBg: "bg-emerald-600",
    activeBorder: "border-emerald-600",
    text: "text-emerald-700",
  },
];

const STRENGTHS_OPTIONS = [
  "Critical thinking",
  "Creativity",
  "Leadership",
  "Teamwork",
  "Communication",
  "Problem solving",
  "Research skills",
  "Numeracy",
  "Literacy",
  "Practical skills",
  "Artistic ability",
  "Athletic ability",
];

const SUBJECTS_OPTIONS = [
  "Mathematics",
  "English",
  "Kiswahili",
  "Science & Technology",
  "Social Studies",
  "CRE / IRE",
  "Creative Arts",
  "Agriculture",
  "Home Science",
  "Computer Science",
  "Music",
  "Physical Education",
];

const LEARNING_STYLES = [
  "Visual",
  "Auditory",
  "Kinesthetic",
  "Reading/Writing",
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  teacherName: string;
  jssGrades: string[];
  studentsByGrade: Record<string, ClassStudent[]>;
  existingPathways: JssPathwayRecord[];
}

interface FormState {
  studentId: string;
  recommendedPathway: string;
  strengths: string[];
  interests: string[];
  strongSubjects: string[];
  careerInterests: string;
  learningStyle: string;
  teacherNotes: string;
}

const EMPTY_FORM: FormState = {
  studentId: "",
  recommendedPathway: "",
  strengths: [],
  interests: [],
  strongSubjects: [],
  careerInterests: "",
  learningStyle: "",
  teacherNotes: "",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function toggleItem(arr: string[], item: string): string[] {
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getPathwayConfig(id: string) {
  return PATHWAYS.find((p) => p.id === id) ?? PATHWAYS[0];
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PathwayClient({
  teacherName,
  jssGrades,
  studentsByGrade,
  existingPathways,
}: Props) {
  const [selectedGrade, setSelectedGrade] = useState(jssGrades[0] ?? "");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [pathways, setPathways] =
    useState<JssPathwayRecord[]>(existingPathways);
  const [viewTab, setViewTab] = useState<"form" | "records">("form");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();

  const students = studentsByGrade[selectedGrade] ?? [];
  const allStudents = Object.values(studentsByGrade).flat();

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  function loadExisting(studentId: string) {
    const existing = pathways.find((p) => p.student_id === studentId);
    if (existing) {
      setForm({
        studentId,
        recommendedPathway: existing.recommended_pathway,
        strengths: existing.strengths ?? [],
        interests: existing.interests ?? [],
        strongSubjects: existing.strong_subjects ?? [],
        careerInterests: (existing.career_interests ?? []).join(", "),
        learningStyle: existing.learning_style ?? "",
        teacherNotes: existing.teacher_notes ?? "",
      });
      setEditingStudentId(studentId);
    } else {
      setForm({ ...EMPTY_FORM, studentId });
      setEditingStudentId(null);
    }
  }

  function handleStudentChange(studentId: string) {
    loadExisting(studentId);
  }

  function handleGradeChange(grade: string) {
    setSelectedGrade(grade);
    setForm(EMPTY_FORM);
    setEditingStudentId(null);
  }

  function handleSave() {
    if (!form.studentId) {
      showToast("Please select a student.", false);
      return;
    }
    if (!form.recommendedPathway) {
      showToast("Please select a pathway.", false);
      return;
    }

    startTransition(async () => {
      const result = await saveJssPathwayAction({
        studentId: form.studentId,
        recommendedPathway: form.recommendedPathway,
        pathwayCluster: getPathwayConfig(form.recommendedPathway).cluster,
        strengths: form.strengths,
        interests: form.interests,
        strongSubjects: form.strongSubjects,
        careerInterests: form.careerInterests
          ? form.careerInterests
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        learningStyle: form.learningStyle || null,
        teacherNotes: form.teacherNotes || null,
      });

      if (result.success) {
        showToast("Pathway saved.", true);

        // Update local state
        const student = allStudents.find((s) => s.id === form.studentId);
        const updated: JssPathwayRecord = {
          id:
            pathways.find((p) => p.student_id === form.studentId)?.id ??
            `temp-${Date.now()}`,
          student_id: form.studentId,
          recommended_pathway: form.recommendedPathway,
          pathway_cluster: getPathwayConfig(form.recommendedPathway).cluster,
          strengths: form.strengths,
          interests: form.interests,
          strong_subjects: form.strongSubjects,
          career_interests: form.careerInterests
            ? form.careerInterests.split(",").map((s) => s.trim())
            : [],
          learning_style: form.learningStyle || null,
          teacher_notes: form.teacherNotes || null,
          updated_at: new Date().toISOString(),
        };

        setPathways((prev) => {
          const exists = prev.findIndex((p) => p.student_id === form.studentId);
          if (exists >= 0) {
            const next = [...prev];
            next[exists] = updated;
            return next;
          }
          return [updated, ...prev];
        });

        setEditingStudentId(form.studentId);
      } else {
        showToast(result.message, false);
      }
    });
  }

  const pathwayConfig = form.recommendedPathway
    ? getPathwayConfig(form.recommendedPathway)
    : null;

  // Stats
  const totalJssStudents = allStudents.length;
  const completedPathways = new Set(pathways.map((p) => p.student_id)).size;
  const completionPct =
    totalJssStudents > 0
      ? Math.round((completedPathways / totalJssStudents) * 100)
      : 0;

  if (jssGrades.length === 0) {
    return (
      <div className="min-h-screen bg-[#F8F7F2] flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">🎓</div>
          <h2 className="text-lg font-semibold text-slate-700">
            No JSS Classes Allocated
          </h2>
          <p className="text-slate-400 text-sm mt-2">
            JSS Pathways are for Grades 7–9. You don't currently teach any JSS
            classes.
          </p>
          <a
            href="/teacher"
            className="mt-4 inline-block text-sm text-emerald-600 hover:underline"
          >
            Back to dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F7F2]">
      {/* ── Header ── */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-800 tracking-tight">
              JSS Pathway Planner
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {teacherName} · Grade 7–9 Career Guidance
            </p>
          </div>
          <a
            href="/teacher"
            className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1.5"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
              />
            </svg>
            Dashboard
          </a>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg ${
            toast.ok ? "bg-emerald-600 text-white" : "bg-red-500 text-white"
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
        {/* ── Progress banner ── */}
        <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">
              Pathway completion
            </span>
            <span className="text-sm text-slate-500">
              {completedPathways} / {totalJssStudents} students
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2">
            <div
              className="bg-emerald-500 h-2 rounded-full transition-all"
              style={{ width: `${completionPct}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-1.5">
            {completionPct}% of JSS students have a recommended pathway
          </p>
        </div>

        {/* ── Tab bar ── */}
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 w-fit">
          {(["form", "records"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setViewTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                viewTab === tab
                  ? "bg-slate-800 text-white"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab === "form"
                ? "Assign Pathway"
                : `View Records (${pathways.length})`}
            </button>
          ))}
        </div>

        {/* ── FORM TAB ── */}
        {viewTab === "form" && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
            {/* Main form */}
            <div className="space-y-4">
              {/* Grade + Student */}
              <div className="bg-white rounded-xl border border-slate-200 px-5 py-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">
                    Class
                  </label>
                  <div className="flex gap-2">
                    {jssGrades.map((g) => (
                      <button
                        key={g}
                        onClick={() => handleGradeChange(g)}
                        className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                          selectedGrade === g
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">
                    Student
                  </label>
                  <select
                    aria-label="select student for career assessment"
                    value={form.studentId}
                    onChange={(e) => handleStudentChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    <option value="">— Select student —</option>
                    {students.map((s) => {
                      const hasPathway = pathways.some(
                        (p) => p.student_id === s.id,
                      );
                      return (
                        <option key={s.id} value={s.id}>
                          {s.full_name} {hasPathway ? "✓" : ""}
                        </option>
                      );
                    })}
                  </select>
                  {editingStudentId && (
                    <p className="text-xs text-emerald-600 mt-1">
                      ✓ Editing existing pathway
                    </p>
                  )}
                </div>
              </div>

              {/* Pathway selector */}
              <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
                <label className="block text-xs font-medium text-slate-500 mb-3 uppercase tracking-wide">
                  Recommended Pathway
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PATHWAYS.map((p) => {
                    const isSelected = form.recommendedPathway === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() =>
                          setForm((f) => ({ ...f, recommendedPathway: p.id }))
                        }
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                          isSelected
                            ? `${p.activeBorder} ${p.bg}`
                            : `border-slate-200 hover:${p.border} hover:${p.bg}`
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xl">{p.icon}</span>
                          <span
                            className={`text-sm font-semibold ${isSelected ? p.text : "text-slate-700"}`}
                          >
                            {p.label}
                          </span>
                          {isSelected && (
                            <span className="ml-auto">
                              <svg
                                className={`w-4 h-4 ${p.text}`}
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          {p.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Strengths */}
              <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
                <label className="block text-xs font-medium text-slate-500 mb-3 uppercase tracking-wide">
                  Key Strengths
                </label>
                <div className="flex flex-wrap gap-2">
                  {STRENGTHS_OPTIONS.map((s) => {
                    const selected = form.strengths.includes(s);
                    return (
                      <button
                        key={s}
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            strengths: toggleItem(f.strengths, s),
                          }))
                        }
                        className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                          selected
                            ? "bg-slate-800 text-white border-slate-800"
                            : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Strong subjects */}
              <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
                <label className="block text-xs font-medium text-slate-500 mb-3 uppercase tracking-wide">
                  Strong Subjects
                </label>
                <div className="flex flex-wrap gap-2">
                  {SUBJECTS_OPTIONS.map((s) => {
                    const selected = form.strongSubjects.includes(s);
                    return (
                      <button
                        key={s}
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            strongSubjects: toggleItem(f.strongSubjects, s),
                          }))
                        }
                        className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                          selected
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Learning style + career interests */}
              <div className="bg-white rounded-xl border border-slate-200 px-5 py-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">
                    Learning Style
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {LEARNING_STYLES.map((ls) => {
                      const selected = form.learningStyle === ls;
                      return (
                        <button
                          key={ls}
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              learningStyle: selected ? "" : ls,
                            }))
                          }
                          className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                            selected
                              ? "bg-indigo-600 text-white border-indigo-600"
                              : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          {ls}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">
                    Career Interests{" "}
                    <span className="font-normal text-slate-400">
                      (comma-separated)
                    </span>
                  </label>
                  <input
                    type="text"
                    value={form.careerInterests}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        careerInterests: e.target.value,
                      }))
                    }
                    placeholder="e.g. Medicine, Software Engineering, Architecture"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 placeholder-slate-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">
                    Teacher Notes
                  </label>
                  <textarea
                    value={form.teacherNotes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, teacherNotes: e.target.value }))
                    }
                    placeholder="Any additional observations about this student's potential and direction…"
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none placeholder-slate-300"
                  />
                </div>
              </div>

              {/* Save */}
              <button
                onClick={handleSave}
                disabled={isPending}
                className="w-full py-3 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {isPending
                  ? "Saving…"
                  : editingStudentId
                    ? "Update Pathway"
                    : "Save Pathway"}
              </button>
            </div>

            {/* Right sidebar — preview */}
            <div className="space-y-4">
              {pathwayConfig && form.studentId ? (
                <div
                  className={`rounded-xl border-2 ${pathwayConfig.activeBorder} ${pathwayConfig.bg} p-5 sticky top-4`}
                >
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
                    Preview
                  </p>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">{pathwayConfig.icon}</span>
                    <div>
                      <p
                        className={`text-base font-bold ${pathwayConfig.text}`}
                      >
                        {pathwayConfig.label}
                      </p>
                      <p className="text-xs text-slate-400">
                        {pathwayConfig.cluster}
                      </p>
                    </div>
                  </div>
                  {form.strengths.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-slate-500 mb-1">
                        Strengths
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {form.strengths.map((s) => (
                          <span
                            key={s}
                            className="text-xs bg-white/60 text-slate-600 px-2 py-0.5 rounded-full"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {form.strongSubjects.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1">
                        Strong in
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {form.strongSubjects.map((s) => (
                          <span
                            key={s}
                            className="text-xs bg-white/60 text-slate-600 px-2 py-0.5 rounded-full"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {form.teacherNotes && (
                    <p className="text-xs text-slate-500 mt-3 italic">
                      "{form.teacherNotes}"
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 p-5 text-center">
                  <p className="text-slate-400 text-sm">
                    Select a student and pathway to preview the recommendation
                    card.
                  </p>
                </div>
              )}

              {/* Students without pathways */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Pending (
                    {
                      students.filter(
                        (s) => !pathways.some((p) => p.student_id === s.id),
                      ).length
                    }
                    )
                  </p>
                </div>
                <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
                  {students
                    .filter((s) => !pathways.some((p) => p.student_id === s.id))
                    .map((s) => (
                      <button
                        key={s.id}
                        onClick={() => handleStudentChange(s.id)}
                        className="w-full px-4 py-2.5 text-left text-sm text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-between"
                      >
                        <span>{s.full_name}</span>
                        <svg
                          className="w-3.5 h-3.5 text-slate-300"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </button>
                    ))}
                  {students.filter(
                    (s) => !pathways.some((p) => p.student_id === s.id),
                  ).length === 0 && (
                    <div className="px-4 py-4 text-center text-xs text-emerald-600">
                      ✓ All students in {selectedGrade} have pathways
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── RECORDS TAB ── */}
        {viewTab === "records" && (
          <div className="space-y-3">
            {pathways.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
                <p className="text-slate-400">No pathways saved yet.</p>
              </div>
            ) : (
              pathways.map((record) => {
                const student = allStudents.find(
                  (s) => s.id === record.student_id,
                );
                const cfg = getPathwayConfig(record.recommended_pathway);
                return (
                  <div
                    key={record.id}
                    className="bg-white rounded-xl border border-slate-200 px-5 py-4 hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center text-lg shrink-0`}
                      >
                        {cfg.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              {student?.full_name ?? "Unknown Student"}
                            </p>
                            <p
                              className={`text-xs font-medium ${cfg.text} mt-0.5`}
                            >
                              {record.recommended_pathway}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-slate-400">
                              {formatDate(record.updated_at)}
                            </span>
                            <button
                              onClick={() => {
                                // Switch to form tab and load this student
                                const grade = Object.entries(
                                  studentsByGrade,
                                ).find(([, students]) =>
                                  students.some(
                                    (s) => s.id === record.student_id,
                                  ),
                                )?.[0];
                                if (grade) {
                                  setSelectedGrade(grade);
                                  setViewTab("form");
                                  setTimeout(
                                    () =>
                                      handleStudentChange(record.student_id),
                                    50,
                                  );
                                }
                              }}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
                            >
                              Edit
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1 mt-2">
                          {(record.strengths ?? []).slice(0, 4).map((s) => (
                            <span
                              key={s}
                              className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full"
                            >
                              {s}
                            </span>
                          ))}
                          {(record.strengths ?? []).length > 4 && (
                            <span className="text-xs text-slate-400">
                              +{(record.strengths ?? []).length - 4} more
                            </span>
                          )}
                        </div>

                        {record.teacher_notes && (
                          <p className="text-xs text-slate-400 mt-1.5 italic line-clamp-1">
                            "{record.teacher_notes}"
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
