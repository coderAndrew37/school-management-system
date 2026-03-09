"use client";

import type { GalleryItem, GalleryCategory } from "@/lib/types/parent";
import {
  GALLERY_CAT_STYLE,
  GALLERY_CAT_DEFAULT,
  GALLERY_AUDIENCE_STYLE,
} from "@/lib/types/parent";
import { ExternalLink, FileText, Music, Play, X } from "lucide-react";
import { useState } from "react";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns the best renderable URL.
 * signedUrl is preferred (1-hour signed URL from storage).
 * Falls back to media_url for legacy rows that stored public URLs there.
 */
function displayUrl(item: GalleryItem): string {
  return item.signedUrl || item.media_url || "";
}

/**
 * Resolve category badge style.
 * Checks against the fixed GalleryCategory values first;
 * free-text CBC categories get GALLERY_CAT_DEFAULT.
 */
function resolveCatStyle(category: string | null) {
  if (!category) return GALLERY_CAT_DEFAULT;
  return GALLERY_CAT_STYLE[category as GalleryCategory] ?? GALLERY_CAT_DEFAULT;
}

function audienceLabel(item: GalleryItem): string {
  if (item.audience === "class" && item.target_grade) return item.target_grade;
  return GALLERY_AUDIENCE_STYLE[item.audience].label;
}

function formatDate(iso: string): string {
  const d = iso.includes("T") ? new Date(iso) : new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ── Lightbox ──────────────────────────────────────────────────────────────────

function Lightbox({
  item,
  onClose,
}: {
  item: GalleryItem;
  onClose: () => void;
}) {
  const cs = resolveCatStyle(item.category);
  const aud = GALLERY_AUDIENCE_STYLE[item.audience];
  const src = displayUrl(item);
  const isImg =
    item.media_type === "image" || !["video"].includes(item.media_type);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-w-2xl w-full rounded-3xl border border-white/15 bg-[#0f1421] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Media */}
        <div className="aspect-video bg-black/50 flex items-center justify-center overflow-hidden">
          {isImg && src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={item.title}
              className="w-full h-full object-contain"
            />
          ) : item.media_type === "video" && src ? (
            <video src={src} controls className="w-full h-full" />
          ) : (
            <div className="flex flex-col items-center gap-3 text-white/30">
              <FileText className="h-10 w-10" />
              {src && (
                <a
                  href={src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-sky-400 hover:text-sky-300"
                >
                  <ExternalLink className="h-4 w-4" /> Open file
                </a>
              )}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-5 space-y-3">
          <div className="flex items-start gap-3">
            <span className={`text-xl ${cs.text}`}>{cs.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white">{item.title}</p>
              {/* Show caption, falling back to description for legacy rows */}
              {(item.caption || item.description) && (
                <p className="text-sm text-white/55 mt-1 leading-relaxed">
                  {item.caption ?? item.description}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {item.category && (
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border ${cs.bg} ${cs.text} ${cs.border}`}
              >
                {cs.icon} {item.category}
              </span>
            )}
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border border-current/20 ${aud.bg} ${aud.text}`}
            >
              {audienceLabel(item)}
            </span>
            {item.term && (
              <span className="text-[10px] px-2.5 py-1 rounded-lg border border-white/10 bg-white/5 text-white/50">
                Term {item.term}
              </span>
            )}
            {/* Legacy tags */}
            {(item.tags ?? []).map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-2.5 py-1 rounded-lg border border-white/10 bg-white/5 text-white/50"
              >
                {tag}
              </span>
            ))}
          </div>

          <p className="text-xs text-white/30">{formatDate(item.created_at)}</p>
        </div>

        <button
          aria-label="Close"
          onClick={onClose}
          className="absolute top-3 right-3 p-2 rounded-xl bg-black/50 hover:bg-black/70 text-white/60 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

// ── Filter ────────────────────────────────────────────────────────────────────

type AudienceFilter = "all" | "student" | "class" | "school";

const AUDIENCE_FILTERS: { id: AudienceFilter; label: string; icon: string }[] =
  [
    { id: "all", label: "All", icon: "✨" },
    { id: "student", label: "Your child", icon: "👤" },
    { id: "class", label: "Class", icon: "🏫" },
    { id: "school", label: "School", icon: "🌍" },
  ];

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  items: GalleryItem[];
  studentName: string;
}

export function TalentGallery({ items, studentName }: Props) {
  const [audienceFilter, setAudienceFilter] = useState<AudienceFilter>("all");
  const [lightbox, setLightbox] = useState<GalleryItem | null>(null);

  const counts: Record<AudienceFilter, number> = {
    all: items.length,
    student: items.filter((i) => i.audience === "student").length,
    class: items.filter((i) => i.audience === "class").length,
    school: items.filter((i) => i.audience === "school").length,
  };

  const filtered =
    audienceFilter === "all"
      ? items
      : items.filter((i) => i.audience === audienceFilter);

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 py-16 text-center bg-white">
        <p className="text-3xl mb-2">🎨</p>
        <p className="text-sm text-slate-500 font-semibold">
          No gallery items yet
        </p>
        <p className="text-xs text-slate-400 mt-1">
          {studentName}'s learning moments will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {AUDIENCE_FILTERS.map(({ id, label, icon }) => {
          const count = counts[id];
          if (id !== "all" && count === 0) return null;
          const isActive = audienceFilter === id;
          const aud =
            id !== "all"
              ? GALLERY_AUDIENCE_STYLE[id as "student" | "class" | "school"]
              : null;

          return (
            <button
              key={id}
              onClick={() => setAudienceFilter(id)}
              className={[
                "rounded-xl px-3.5 py-2 text-xs font-semibold border transition-all",
                isActive
                  ? aud
                    ? `${aud.bg} ${aud.text} border-current/20`
                    : "bg-slate-800 border-slate-700 text-white"
                  : "border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300 bg-white",
              ].join(" ")}
            >
              {icon} {label}
              {count > 0 && <span className="ml-1 opacity-60">({count})</span>}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center bg-white">
          <p className="text-sm text-slate-400">No images in this category.</p>
        </div>
      )}

      {/* Grid */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {filtered.map((item) => {
            const cs = resolveCatStyle(item.category);
            const aud = GALLERY_AUDIENCE_STYLE[item.audience];
            const src = displayUrl(item);
            const isImg = src && item.media_type !== "video";

            return (
              <button
                key={item.id}
                onClick={() => setLightbox(item)}
                className="group rounded-2xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-md overflow-hidden transition-all text-left"
              >
                {/* Thumbnail */}
                <div className="aspect-square bg-slate-100 flex items-center justify-center overflow-hidden relative">
                  {isImg ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={src}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : item.media_type === "video" ? (
                    <div
                      className={`flex flex-col items-center gap-2 ${cs.text}`}
                    >
                      <Play className="h-8 w-8" />
                      <span className="text-xs opacity-60">Video</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <FileText className="h-8 w-8" />
                    </div>
                  )}

                  {/* Category badge */}
                  {item.category && (
                    <div
                      className={`absolute top-2 left-2 text-[9px] font-bold px-2 py-0.5 rounded-md border backdrop-blur-sm ${cs.bg} ${cs.text} ${cs.border}`}
                    >
                      {cs.icon}
                    </div>
                  )}

                  {/* Audience badge */}
                  <div
                    className={`absolute top-2 right-2 text-[9px] font-bold px-2 py-0.5 rounded-md border border-current/20 backdrop-blur-sm ${aud.bg} ${aud.text}`}
                  >
                    {audienceLabel(item)}
                  </div>
                </div>

                {/* Card info */}
                <div className="p-2.5 space-y-0.5">
                  <p className="text-xs font-bold text-slate-700 line-clamp-1">
                    {item.title}
                  </p>
                  {(item.caption || item.description) && (
                    <p className="text-[10px] text-slate-400 line-clamp-1">
                      {item.caption ?? item.description}
                    </p>
                  )}
                  <p className="text-[9px] text-slate-300">
                    {formatDate(item.created_at)}
                    {item.term ? ` · Term ${item.term}` : ""}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {lightbox && (
        <Lightbox item={lightbox} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}

export default TalentGallery;
