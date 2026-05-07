"use client";

/**
 * StudentPhotoCell
 *
 * Compact photo thumbnail + click-to-upload for each student row.
 * Mirrors the single-admit form behaviour: click to pick file,
 * shows preview, shows remove button when set.
 */

import { Camera, ImageOff, Loader2 } from "lucide-react";
import Image from "next/image";
import { useRef } from "react";

interface StudentPhotoCellProps {
  rowIndex: number;
  preview: string | null;
  uploading?: boolean;
  onChange: (file: File, preview: string) => void;
  onRemove: () => void;
  disabled?: boolean;
}

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

export function StudentPhotoCell({
  rowIndex,
  preview,
  uploading = false,
  onChange,
  onRemove,
  disabled = false,
}: StudentPhotoCellProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BYTES) {
      // Use a non-blocking toast if available; fall back to console
      console.warn("Photo exceeds 2 MB limit");
      return;
    }
    const url = URL.createObjectURL(file);
    onChange(file, url);
    // Reset so the same file can be re-selected
    e.target.value = "";
  }

  const inputId = `photo-upload-${rowIndex}`;

  return (
    <div className="flex flex-col items-center gap-1 shrink-0">
      {/* Thumbnail / trigger */}
      <button
        type="button"
        onClick={() => !disabled && inputRef.current?.click()}
        disabled={disabled}
        aria-label={
          preview
            ? `Change photo for student ${rowIndex + 1}`
            : `Add photo for student ${rowIndex + 1}`
        }
        className="relative w-10 h-10 rounded-xl border border-dashed border-white/20 bg-white/[0.03] hover:border-amber-400/50 hover:bg-amber-400/[0.04] transition-all overflow-hidden group disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {preview ? (
          <Image
            src={preview}
            alt={`Student ${rowIndex + 1} photo preview`}
            fill
            className="object-cover"
          />
        ) : (
          <Camera
            className="h-4 w-4 text-white/25 group-hover:text-amber-400/60 transition-colors mx-auto mt-3"
            aria-hidden="true"
          />
        )}

        {/* Uploading overlay */}
        {uploading && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-amber-400" aria-hidden="true" />
          </div>
        )}

        {/* Hover overlay when preview is set */}
        {preview && !uploading && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
            <Camera
              className="h-4 w-4 text-white/0 group-hover:text-white/80 transition-all"
              aria-hidden="true"
            />
          </div>
        )}
      </button>

      {/* Remove link */}
      {preview && !uploading && (
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Remove photo for student ${rowIndex + 1}`}
          className="text-[9px] text-white/20 hover:text-rose-400 transition-colors leading-none"
        >
          <ImageOff className="h-2.5 w-2.5" aria-hidden="true" />
        </button>
      )}

      {/* Hidden input */}
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        aria-label={`Photo upload for student ${rowIndex + 1}`}
        onChange={handleFile}
        disabled={disabled}
      />
    </div>
  );
}