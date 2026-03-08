"use client";

// app/teacher/gallery/GalleryClient.tsx

import { useState, useRef, useTransition, useCallback } from "react";
import {
  uploadGalleryImageAction,
  deleteGalleryItemAction,
} from "@/lib/actions/gallery";
import type { GalleryItemFull } from "@/lib/actions/gallery";
import type { ClassStudent } from "@/lib/data/assessment";

// ── Types ─────────────────────────────────────────────────────────────────────

type Audience = "student" | "class" | "school";

interface Props {
  teacherName: string;
  teacherId: string;
  grades: string[];
  studentsByGrade: Record<string, ClassStudent[]>;
  studentNameMap: Record<string, string>;
  initialItems: (GalleryItemFull & { signedUrl: string })[];
}

interface PendingFile {
  id: string;
  file: File;
  preview: string;
  title: string;
  status: "pending" | "uploading" | "done" | "error";
  errorMsg?: string;
}

// ── CBC Category options ──────────────────────────────────────────────────────

const CATEGORIES = [
  "Mathematics Activity",
  "Science Experiment",
  "Creative Arts",
  "Language & Literacy",
  "Environmental Activity",
  "Physical Education",
  "Social Studies",
  "Agriculture Activity",
  "Music Performance",
  "Drama & Performing Arts",
  "Home Science",
  "School Event",
  "Field Trip",
  "Achievement",
  "Other",
];

const AUDIENCE_CONFIG: Record<
  Audience,
  { label: string; desc: string; color: string; bg: string; border: string }
> = {
  student: {
    label: "Specific Student",
    desc: "Only this student's parent sees it",
    color: "text-sky-700",
    bg: "bg-sky-50",
    border: "border-sky-400",
  },
  class: {
    label: "Entire Class",
    desc: "All parents in this grade see it",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-400",
  },
  school: {
    label: "Whole School",
    desc: "All parents at Kibali Academy see it",
    color: "text-purple-700",
    bg: "bg-purple-50",
    border: "border-purple-400",
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function audienceBadge(
  item: GalleryItemFull,
  studentNameMap: Record<string, string>,
) {
  if (item.audience === "student" && item.student_id) {
    return studentNameMap[item.student_id] ?? "Unknown student";
  }
  if (item.audience === "class") return item.target_grade ?? "Class";
  return "All parents";
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function GalleryClient({
  teacherName,
  grades,
  studentsByGrade,
  studentNameMap,
  initialItems,
}: Props) {
  // ── Form state ──
  const [audience, setAudience] = useState<Audience>("class");
  const [selectedGrade, setSelectedGrade] = useState<string>(grades[0] ?? "");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [term, setTerm] = useState<string>("");
  const [caption, setCaption] = useState<string>("");

  // ── File queue ──
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Gallery display ──
  const [items, setItems] = useState(initialItems);
  const [lightbox, setLightbox] = useState<string | null>(null); // signedUrl
  const [filterAudience, setFilterAudience] = useState<string>("all");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();

  const students = studentsByGrade[selectedGrade] ?? [];

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  // ── File handling ──────────────────────────────────────────────────────────

  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files);
    const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    const MAX = 10 * 1024 * 1024;
    const valid = arr.filter((f) => ALLOWED.includes(f.type) && f.size <= MAX);
    const invalid = arr.filter(
      (f) => !ALLOWED.includes(f.type) || f.size > MAX,
    );

    if (invalid.length > 0) {
      showToast(
        `${invalid.length} file(s) skipped (must be JPEG/PNG/WebP/GIF under 10 MB)`,
        false,
      );
    }

    const newPending: PendingFile[] = valid.map((file) => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
      title: file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
      status: "pending",
    }));
    setPendingFiles((prev) => [...prev, ...newPending]);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const removePending = (id: string) => {
    setPendingFiles((prev) => {
      const item = prev.find((f) => f.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return prev.filter((f) => f.id !== id);
    });
  };

  const updateTitle = (id: string, title: string) => {
    setPendingFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, title } : f)),
    );
  };

  // ── Upload ────────────────────────────────────────────────────────────────

  async function handleUpload() {
    if (pendingFiles.length === 0) {
      showToast("Please add at least one image.", false);
      return;
    }
    if (audience === "student" && !selectedStudentId) {
      showToast("Please select a student.", false);
      return;
    }
    if (audience === "class" && !selectedGrade) {
      showToast("Please select a grade.", false);
      return;
    }

    // Upload each file one by one, updating status as we go
    for (const pf of pendingFiles) {
      if (pf.status !== "pending") continue;

      setPendingFiles((prev) =>
        prev.map((f) => (f.id === pf.id ? { ...f, status: "uploading" } : f)),
      );

      const fd = new FormData();
      fd.set("audience", audience);
      fd.set("studentId", audience === "student" ? selectedStudentId : "");
      fd.set("targetGrade", audience === "class" ? selectedGrade : "");
      fd.set("title", pf.title || "Untitled");
      fd.set("caption", caption);
      fd.set("category", category);
      fd.set("term", term);
      fd.set("academicYear", "2026");
      fd.set("image", pf.file);

      const result = await uploadGalleryImageAction(fd);

      if (result.success) {
        setPendingFiles((prev) =>
          prev.map((f) => (f.id === pf.id ? { ...f, status: "done" } : f)),
        );
      } else {
        setPendingFiles((prev) =>
          prev.map((f) =>
            f.id === pf.id
              ? { ...f, status: "error", errorMsg: result.message }
              : f,
          ),
        );
      }
    }

    // Count results
    const done = pendingFiles.filter((f) => f.status === "pending").length; // those just attempted
    showToast("Images uploaded. Refresh to see updated gallery.", true);

    // Clear done files after a moment
    setTimeout(() => {
      setPendingFiles((prev) =>
        prev.filter((f) => f.status !== "done" && f.status !== "pending"),
      );
      // Reload page to get fresh signed URLs
      window.location.reload();
    }, 1500);
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteGalleryItemAction(id);
      if (result.success) {
        setItems((prev) => prev.filter((i) => i.id !== id));
        showToast("Image deleted.", true);
      } else {
        showToast(result.message, false);
      }
      setConfirmDelete(null);
    });
  }

  // ── Filtered gallery ───────────────────────────────────────────────────────

  const filtered = items.filter((i) => {
    if (filterAudience !== "all" && i.audience !== filterAudience) return false;
    return true;
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#F8F7F2]">
      {/* ── Header ── */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-800 tracking-tight">
              Learning Gallery
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {teacherName} · CBC Evidence & Activities
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
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg transition-all ${toast.ok ? "bg-emerald-600 text-white" : "bg-red-500 text-white"}`}
        >
          {toast.msg}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            aria-label="close lightbox"
            className="absolute top-4 right-4 text-white/60 hover:text-white p-2"
            onClick={() => setLightbox(null)}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          <img
            src={lightbox}
            alt=""
            className="max-w-full max-h-[90vh] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-base font-semibold text-slate-800 mb-2">
              Delete image?
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              This will remove the image from the parent portal permanently.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={isPending}
                className="flex-1 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50"
              >
                {isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
        {/* ── LEFT: Upload panel ── */}
        <div className="space-y-4">
          {/* Audience selector */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <label className="block text-xs font-medium text-slate-500 mb-3 uppercase tracking-wide">
              Who can see these images?
            </label>
            <div className="space-y-2">
              {(["student", "class", "school"] as Audience[]).map((a) => {
                const cfg = AUDIENCE_CONFIG[a];
                const isActive = audience === a;
                return (
                  <button
                    key={a}
                    onClick={() => setAudience(a)}
                    className={`w-full p-3 rounded-xl border-2 text-left transition-all ${isActive ? `${cfg.border} ${cfg.bg}` : "border-slate-100 hover:border-slate-200"}`}
                  >
                    <div
                      className={`text-sm font-semibold ${isActive ? cfg.color : "text-slate-700"}`}
                    >
                      {cfg.label}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {cfg.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Context selectors (grade / student) */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            {(audience === "class" || audience === "student") && (
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">
                  Grade
                </label>
                <div className="flex flex-wrap gap-2">
                  {grades.map((g) => (
                    <button
                      key={g}
                      onClick={() => {
                        setSelectedGrade(g);
                        setSelectedStudentId("");
                      }}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${selectedGrade === g ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"}`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {audience === "student" && (
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">
                  Student
                </label>
                <select
                  aria-label="select student"
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                >
                  <option value="">— Select student —</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">
                Category
              </label>
              <select
                aria-label="select category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                <option value="">— Select category —</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Term */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">
                Term
              </label>
              <div className="flex gap-2">
                {["1", "2", "3"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTerm(term === t ? "" : t)}
                    className={`px-4 py-1.5 rounded-lg border text-xs font-medium transition-all ${term === t ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"}`}
                  >
                    Term {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Caption */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">
                Caption{" "}
                <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Describe the activity or learning objective…"
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none placeholder-slate-300"
              />
            </div>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${isDragging ? "border-emerald-400 bg-emerald-50" : "border-slate-200 hover:border-emerald-300 hover:bg-slate-50"}`}
          >
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-50 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-emerald-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-700">
              Drop images here or click to browse
            </p>
            <p className="text-xs text-slate-400 mt-1">
              JPEG, PNG, WebP, GIF · Max 10 MB each · Multiple allowed
            </p>
            <input
              id="file-input"
              aria-label="file input"
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && addFiles(e.target.files)}
            />
          </div>

          {/* Pending file list */}
          {pendingFiles.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                  {pendingFiles.length} image
                  {pendingFiles.length !== 1 ? "s" : ""} queued
                </p>
                <button
                  onClick={() => setPendingFiles([])}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Clear all
                </button>
              </div>
              <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
                {pendingFiles.map((pf) => (
                  <div
                    key={pf.id}
                    className="flex items-center gap-3 px-4 py-2.5"
                  >
                    <img
                      src={pf.preview}
                      alt=""
                      className="w-10 h-10 rounded-lg object-cover shrink-0 bg-slate-100"
                    />
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={pf.title}
                        onChange={(e) => updateTitle(pf.id, e.target.value)}
                        placeholder="Image title"
                        className="w-full text-xs text-slate-700 bg-transparent border-none focus:outline-none placeholder-slate-300"
                      />
                      {pf.status === "uploading" && (
                        <p className="text-xs text-amber-500 mt-0.5">
                          Uploading…
                        </p>
                      )}
                      {pf.status === "done" && (
                        <p className="text-xs text-emerald-500 mt-0.5">
                          ✓ Done
                        </p>
                      )}
                      {pf.status === "error" && (
                        <p className="text-xs text-red-500 mt-0.5">
                          {pf.errorMsg}
                        </p>
                      )}
                    </div>
                    <button
                      aria-label="remove from queue"
                      onClick={() => removePending(pf.id)}
                      className="shrink-0 p-1 text-slate-300 hover:text-red-400 transition-colors"
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
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
              <div className="px-4 py-3 bg-slate-50 border-t border-slate-100">
                <button
                  onClick={handleUpload}
                  disabled={
                    isPending ||
                    pendingFiles.every((f) => f.status !== "pending")
                  }
                  className="w-full py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  Upload{" "}
                  {pendingFiles.filter((f) => f.status === "pending").length}{" "}
                  image
                  {pendingFiles.filter((f) => f.status === "pending").length !==
                  1
                    ? "s"
                    : ""}
                </button>
              </div>
            </div>
          )}

          {/* Info box */}
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
            <p className="text-xs text-amber-700 leading-relaxed">
              <strong>CBC Evidence:</strong> Images go live on the parent portal
              immediately after upload. Use categories to link photos to
              specific CBC learning areas.
            </p>
          </div>
        </div>

        {/* ── RIGHT: Gallery grid ── */}
        <div className="space-y-4">
          {/* Filter bar */}
          <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3 flex-wrap">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
              Show:
            </span>
            {["all", "student", "class", "school"].map((f) => (
              <button
                key={f}
                onClick={() => setFilterAudience(f)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all capitalize ${filterAudience === f ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`}
              >
                {f === "all"
                  ? "All"
                  : (AUDIENCE_CONFIG[f as Audience]?.label ?? f)}
              </button>
            ))}
            <span className="ml-auto text-xs text-slate-400">
              {filtered.length} images
            </span>
          </div>

          {/* Grid */}
          {filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-slate-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
                  />
                </svg>
              </div>
              <p className="text-slate-400 text-sm">No images uploaded yet.</p>
              <p className="text-slate-300 text-xs mt-1">
                Drop images on the left to get started.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {filtered.map((item) => {
                const audCfg = AUDIENCE_CONFIG[item.audience as Audience];
                return (
                  <div
                    key={item.id}
                    className="group relative bg-white rounded-xl border border-slate-200 overflow-hidden hover:border-slate-300 hover:shadow-sm transition-all"
                  >
                    {/* Image */}
                    <div
                      className="aspect-square bg-slate-100 cursor-pointer overflow-hidden"
                      onClick={() =>
                        item.signedUrl && setLightbox(item.signedUrl)
                      }
                    >
                      {item.signedUrl ? (
                        <img
                          src={item.signedUrl}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg
                            className="w-8 h-8 text-slate-300"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1}
                              d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Z"
                            />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Audience badge */}
                    <div
                      className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-medium ${audCfg.bg} ${audCfg.color} border ${audCfg.border} border-opacity-30`}
                    >
                      {item.audience === "school"
                        ? "All"
                        : item.audience === "class"
                          ? (item.target_grade ?? "Class")
                          : "Student"}
                    </div>

                    {/* Delete button (appears on hover) */}
                    <button
                      aria-label="delete image"
                      onClick={() => setConfirmDelete(item.id)}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-white/90 text-slate-400 hover:text-red-500 hover:bg-white opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>

                    {/* Info */}
                    <div className="px-3 py-2">
                      <p className="text-xs font-medium text-slate-700 truncate">
                        {item.title}
                      </p>
                      {item.category && (
                        <p className="text-xs text-slate-400 truncate">
                          {item.category}
                        </p>
                      )}
                      <p className="text-xs text-slate-300 mt-0.5">
                        {audienceBadge(item, studentNameMap)} ·{" "}
                        {formatDate(item.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
