"use client";

import type { ClassStudent } from "@/lib/data/assessment";
import Image from "next/image";
import { useRef } from "react";
import { AUDIENCE_CONFIG, CATEGORIES } from "./gallery.config";
import type { Audience, PendingFile } from "./gallery.types";

interface Props {
  // Audience
  audience: Audience;
  onAudienceChange: (a: Audience) => void;

  // Grade / student
  grades: string[];
  selectedGrade: string;
  onGradeChange: (g: string) => void;
  students: ClassStudent[];
  selectedStudentId: string;
  onStudentChange: (id: string) => void;

  // Metadata fields
  sharedTitle: string;
  onSharedTitleChange: (v: string) => void;
  category: string;
  onCategoryChange: (v: string) => void;
  term: string;
  onTermChange: (v: string) => void;
  caption: string;
  onCaptionChange: (v: string) => void;

  // File queue
  pendingFiles: PendingFile[];
  isDragging: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onFilesAdded: (files: FileList | File[]) => void;
  onRemovePending: (id: string) => void;
  onUpdateTitle: (id: string, title: string) => void;
  onClearAll: () => void;

  // Upload action
  isUploading: boolean;
  onUpload: () => void;
}

export function UploadPanel({
  audience,
  onAudienceChange,
  grades,
  selectedGrade,
  onGradeChange,
  students,
  selectedStudentId,
  onStudentChange,
  sharedTitle,
  onSharedTitleChange,
  category,
  onCategoryChange,
  term,
  onTermChange,
  caption,
  onCaptionChange,
  pendingFiles,
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onFilesAdded,
  onRemovePending,
  onUpdateTitle,
  onClearAll,
  isUploading,
  onUpload,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingCount = pendingFiles.filter((f) => f.status === "pending").length;

  return (
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
                onClick={() => onAudienceChange(a)}
                className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                  isActive
                    ? `${cfg.border} ${cfg.bg}`
                    : "border-slate-100 hover:border-slate-200"
                }`}
              >
                <div className={`text-sm font-semibold ${isActive ? cfg.color : "text-slate-700"}`}>
                  {cfg.label}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">{cfg.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Metadata fields */}
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
                  onClick={() => onGradeChange(g)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
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
        )}

        {audience === "student" && (
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">
              Student
            </label>
            <select
              aria-label="select student"
              value={selectedStudentId}
              onChange={(e) => onStudentChange(e.target.value)}
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

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">
            Shared Title{" "}
            <span className="font-normal text-slate-400">(optional — overrides per-file names)</span>
          </label>
          <input
            type="text"
            value={sharedTitle}
            onChange={(e) => onSharedTitleChange(e.target.value)}
            placeholder="e.g. Science Fair 2026"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 placeholder-slate-300"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">
            Category
          </label>
          <select
            aria-label="select category"
            value={category}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            <option value="">— Select category —</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">
            Term
          </label>
          <div className="flex gap-2">
            {["1", "2", "3"].map((t) => (
              <button
                key={t}
                onClick={() => onTermChange(term === t ? "" : t)}
                className={`px-4 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  term === t
                    ? "bg-slate-800 text-white border-slate-800"
                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"
                }`}
              >
                Term {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">
            Caption <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea
            value={caption}
            onChange={(e) => onCaptionChange(e.target.value)}
            placeholder="Describe the activity or learning objective…"
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none placeholder-slate-300"
          />
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          isDragging
            ? "border-emerald-400 bg-emerald-50"
            : "border-slate-200 hover:border-emerald-300 hover:bg-slate-50"
        }`}
      >
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-50 flex items-center justify-center">
          <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
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
          onChange={(e) => e.target.files && onFilesAdded(e.target.files)}
        />
      </div>

      {/* Pending file queue */}
      {pendingFiles.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">
              {pendingFiles.length} image{pendingFiles.length !== 1 ? "s" : ""} queued
            </p>
            <button onClick={onClearAll} className="text-xs text-slate-400 hover:text-slate-600">
              Clear all
            </button>
          </div>

          <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
            {pendingFiles.map((pf) => (
              <div key={pf.id} className="flex items-center gap-3 px-4 py-2.5">
                <Image
                  src={pf.preview}
                  alt=""
                  className="w-10 h-10 rounded-lg object-cover shrink-0 bg-slate-100"
                />
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    value={pf.title}
                    onChange={(e) => onUpdateTitle(pf.id, e.target.value)}
                    placeholder="Image title"
                    className="w-full text-xs text-slate-700 bg-transparent border-none focus:outline-none placeholder-slate-300"
                  />
                  {pf.status === "uploading" && (
                    <p className="text-xs text-amber-500 mt-0.5">Uploading…</p>
                  )}
                  {pf.status === "done" && (
                    <p className="text-xs text-emerald-500 mt-0.5">✓ Done</p>
                  )}
                  {pf.status === "error" && (
                    <p className="text-xs text-red-500 mt-0.5">{pf.errorMsg}</p>
                  )}
                </div>
                <button
                  aria-label="remove from queue"
                  onClick={() => onRemovePending(pf.id)}
                  className="shrink-0 p-1 text-slate-300 hover:text-red-400 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          <div className="px-4 py-3 bg-slate-50 border-t border-slate-100">
            <button
              onClick={onUpload}
              disabled={isUploading || pendingCount === 0}
              className="w-full py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {isUploading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Uploading {pendingCount} image{pendingCount !== 1 ? "s" : ""}…
                </>
              ) : (
                <>Upload {pendingCount} image{pendingCount !== 1 ? "s" : ""}</>
              )}
            </button>
          </div>
        </div>
      )}

      <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
        <p className="text-xs text-amber-700 leading-relaxed">
          <strong>CBC Evidence:</strong> Images go live on the parent portal immediately after
          upload. Use categories to link photos to specific CBC learning areas.
        </p>
      </div>
    </div>
  );
}