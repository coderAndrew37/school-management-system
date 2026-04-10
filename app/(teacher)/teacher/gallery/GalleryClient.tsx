"use client";

import {
  bulkUploadGalleryAction,
  deleteGalleryItemAction,
  uploadGalleryImageAction,
} from "@/lib/actions/gallery";
import { useCallback, useMemo, useState, useTransition } from "react";

import { DeleteConfirmModal } from "./DeleteConfirmModal";
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from "./gallery.config";
import { Audience, GalleryClientProps, GalleryItem, PendingFile } from "./gallery.types";
import { GalleryGrid } from "./GalleryGrid";
import { GalleryLightbox } from "./GalleryLightbox";
import { GalleryToast } from "./GalleryToast";
import { UploadPanel } from "./UploadPanel";

export default function GalleryClient({
  teacherName,
  classes, // Updated from grades
  studentsByClass, // Updated from studentsByGrade
  studentNameMap,
  initialItems,
  academicYear,
}: GalleryClientProps) {
  // ── Upload form state ──────────────────────────────────────────────────────
  const [audience, setAudience] = useState<Audience>("class");
  
  // We now track the Class ID (UUID) instead of the grade string
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id ?? "");
  
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [term, setTerm] = useState<string>("");
  const [caption, setCaption] = useState<string>("");
  const [sharedTitle, setSharedTitle] = useState<string>("");

  // ── File queue state ───────────────────────────────────────────────────────
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // ── Gallery display state ──────────────────────────────────────────────────
  const [items, setItems] = useState<GalleryItem[]>(initialItems);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const [isPending, startTransition] = useTransition();

  // Memoize students based on the selected Class UUID
  const students = useMemo(() => 
    studentsByClass[selectedClassId] ?? [], 
  [selectedClassId, studentsByClass]);

 

  // ── Toast ──────────────────────────────────────────────────────────────────

  function showToast(msg: string, ok: boolean): void {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  // ── File queue handlers ────────────────────────────────────────────────────

  const addFiles = useCallback((files: FileList | File[]): void => {
    const arr = Array.from(files);
    const valid = arr.filter(
      (f) => ALLOWED_MIME_TYPES.includes(f.type) && f.size <= MAX_FILE_SIZE_BYTES,
    );
    const invalid = arr.length - valid.length;
    
    if (invalid > 0)
      showToast(
        `${invalid} file(s) skipped — must be JPEG/PNG/WebP/GIF under 10 MB`,
        false,
      );

    setPendingFiles((prev) => [
      ...prev,
      ...valid.map((file) => ({
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
        title: file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
        status: "pending" as const,
      })),
    ]);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>): void => {
      e.preventDefault();
      setIsDragging(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const removePending = (id: string): void => {
    setPendingFiles((prev) => {
      const item = prev.find((f) => f.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return prev.filter((f) => f.id !== id);
    });
  };

  const updateTitle = (id: string, title: string): void =>
    setPendingFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, title } : f)),
    );

  // ── Upload ─────────────────────────────────────────────────────────────────

  async function handleUpload(): Promise<void> {
    const toUpload = pendingFiles.filter((f) => f.status === "pending");
    if (toUpload.length === 0) { showToast("Please add at least one image.", false); return; }
    if (audience === "student" && !selectedStudentId) { showToast("Please select a student.", false); return; }
    if (audience === "class" && !selectedClassId) { showToast("Please select a class.", false); return; }

    setIsUploading(true);
    setPendingFiles((prev) =>
      prev.map((f) => (f.status === "pending" ? { ...f, status: "uploading" } : f)),
    );

    // Metadata now uses UUID for targetClassId
    const meta = {
      audience,
      studentId: audience === "student" ? selectedStudentId : null,
      targetClassId: audience === "class" ? selectedClassId : null,
      title: sharedTitle || toUpload[0]?.title || "Gallery",
      caption: caption || null,
      category: category || null,
      term: term ? parseInt(term, 10) : null,
      academicYear,
    };

    if (toUpload.length === 1) {
      const pf = toUpload[0]!;
      const fd = new FormData();
      fd.set("audience", meta.audience);
      fd.set("studentId", meta.studentId ?? "");
      fd.set("targetClassId", meta.targetClassId ?? ""); // Passing UUID
      fd.set("title", pf.title || meta.title);
      fd.set("caption", meta.caption ?? "");
      fd.set("category", meta.category ?? "");
      fd.set("term", meta.term != null ? String(meta.term) : "");
      fd.set("academicYear", String(meta.academicYear));
      fd.set("image", pf.file);

      const result = await uploadGalleryImageAction(fd);
      setPendingFiles((prev) =>
        prev.map((f) =>
          f.id === pf.id
            ? { ...f, status: result.success ? "done" : "error", errorMsg: result.success ? undefined : result.message }
            : f,
        ),
      );
      showToast(
        result.success ? "Image uploaded successfully." : result.message,
        result.success,
      );
    } else {
      const result = await bulkUploadGalleryAction(
        toUpload.map((pf) => pf.file),
        { ...meta, title: sharedTitle || "" },
      );
      setPendingFiles((prev) =>
        prev.map((f) => (f.status === "uploading" ? { ...f, status: "done" } : f)),
      );
      showToast(
        result.success
          ? `${result.uploaded} images uploaded successfully.`
          : `${result.uploaded} uploaded, ${result.failed} failed.`,
        result.success,
      );
    }

    setIsUploading(false);
    setTimeout(() => {
      setPendingFiles((prev) => prev.filter((f) => f.status !== "done"));
      window.location.reload();
    }, 1500);
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  function handleDelete(id: string): void {
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

  return (
    <div className="min-h-screen bg-[#F8F7F2]">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-800 tracking-tight">
              Learning Gallery
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {teacherName} · CBC Evidence & Activities · {academicYear}
            </p>
          </div>
          <a
            href="/teacher"
            className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Dashboard
          </a>
        </div>
      </div>

      {toast && <GalleryToast msg={toast.msg} ok={toast.ok} />}
      {lightbox && <GalleryLightbox src={lightbox} onClose={() => setLightbox(null)} />}
      {confirmDelete && (
        <DeleteConfirmModal
          isPending={isPending}
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      <div className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
        <UploadPanel
          audience={audience}
          onAudienceChange={(a: Audience) => { setAudience(a); setSelectedStudentId(""); }}
          // Passing class objects now
          classes={classes} 
          selectedClassId={selectedClassId}
          onClassChange={(id: string) => { setSelectedClassId(id); setSelectedStudentId(""); }}
          students={students}
          selectedStudentId={selectedStudentId}
          onStudentChange={setSelectedStudentId}
          sharedTitle={sharedTitle}
          onSharedTitleChange={setSharedTitle}
          category={category}
          onCategoryChange={setCategory}
          term={term}
          onTermChange={setTerm}
          caption={caption}
          onCaptionChange={setCaption}
          pendingFiles={pendingFiles}
          isDragging={isDragging}
          onDragOver={(e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onFilesAdded={addFiles}
          onRemovePending={removePending}
          onUpdateTitle={updateTitle}
          onClearAll={() => setPendingFiles([])}
          isUploading={isUploading}
          onUpload={handleUpload}
        />

        <GalleryGrid
          items={items}
          studentNameMap={studentNameMap}
          onLightbox={setLightbox}
          onDeleteRequest={setConfirmDelete}
        />
      </div>
    </div>
  );
}