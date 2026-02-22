"use client";

import type { GalleryCategory, GalleryItem } from "@/lib/types/parent";
import { GALLERY_CAT_STYLE } from "@/lib/types/parent";
import {
  ExternalLink,
  FileText,
  Image as ImgIcon,
  Music,
  Play,
  X,
} from "lucide-react";
import { useState } from "react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function mediaIcon(type: string) {
  switch (type) {
    case "video":
      return <Play className="h-5 w-5" />;
    case "document":
      return <FileText className="h-5 w-5" />;
    case "audio":
      return <Music className="h-5 w-5" />;
    default:
      return <ImgIcon className="h-5 w-5" />;
  }
}

function isImage(url: string): boolean {
  return /\.(png|jpe?g|webp|gif|avif|svg)(\?.*)?$/i.test(url);
}

// ── Lightbox ──────────────────────────────────────────────────────────────────

function Lightbox({
  item,
  onClose,
}: {
  item: GalleryItem;
  onClose: () => void;
}) {
  const catStyle = GALLERY_CAT_STYLE[item.category as GalleryCategory];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-w-2xl w-full rounded-3xl border border-white/15 bg-[#0f1421] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Media area */}
        <div className="aspect-video bg-black/50 flex items-center justify-center overflow-hidden">
          {item.media_type === "image" && isImage(item.media_url) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.media_url}
              alt={item.title}
              className="w-full h-full object-contain"
            />
          ) : item.media_type === "video" ? (
            <video src={item.media_url} controls className="w-full h-full" />
          ) : (
            <div className="flex flex-col items-center gap-3 text-white/30">
              {mediaIcon(item.media_type)}
              <a
                href={item.media_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-sky-400 hover:text-sky-300"
              >
                <ExternalLink className="h-4 w-4" /> Open {item.media_type}
              </a>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-5 space-y-3">
          <div className="flex items-start gap-3">
            <span className={`text-xl ${catStyle.text}`}>{catStyle.icon}</span>
            <div>
              <p className="font-bold text-white">{item.title}</p>
              {item.description && (
                <p className="text-sm text-white/55 mt-1 leading-relaxed">
                  {item.description}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
            >
              {catStyle.icon} {item.category}
            </span>
            {item.skills_tagged.map((skill) => (
              <span
                key={skill}
                className="text-[10px] px-2.5 py-1 rounded-lg border border-white/10 bg-white/5 text-white/50"
              >
                {skill}
              </span>
            ))}
          </div>

          <p className="text-xs text-white/30">
            Captured on{" "}
            {new Date(item.captured_on + "T00:00:00").toLocaleDateString(
              "en-KE",
              { day: "numeric", month: "long", year: "numeric" },
            )}
          </p>
        </div>

        <button
          aria-label="close"
          onClick={onClose}
          className="absolute top-3 right-3 p-2 rounded-xl bg-black/50 hover:bg-black/70 text-white/60 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  items: GalleryItem[];
  studentName: string;
}

export function TalentGallery({ items, studentName }: Props) {
  const [activeCategory, setActiveCategory] = useState<GalleryCategory | "all">(
    "all",
  );
  const [lightbox, setLightbox] = useState<GalleryItem | null>(null);

  const categories: (GalleryCategory | "all")[] = [
    "all",
    ...Array.from(new Set(items.map((i) => i.category as GalleryCategory))),
  ];

  const filtered =
    activeCategory === "all"
      ? items
      : items.filter((i) => i.category === activeCategory);

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center">
        <p className="text-3xl mb-2">🎨</p>
        <p className="text-sm text-white/40">No gallery items yet</p>
        <p className="text-xs text-white/25 mt-1">
          {studentName}'s achievements and talents will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Category filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {categories.map((cat) => {
          const style = cat === "all" ? null : GALLERY_CAT_STYLE[cat];
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={[
                "rounded-xl px-3.5 py-2 text-xs font-semibold border transition-all",
                isActive
                  ? cat === "all"
                    ? "bg-white/10 border-white/20 text-white"
                    : `${style!.bg} ${style!.text} ${style!.border}`
                  : "border-white/[0.08] text-white/40 hover:text-white hover:border-white/15",
              ].join(" ")}
            >
              {cat === "all"
                ? `✨ All (${items.length})`
                : `${style!.icon} ${cat}`}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {filtered.map((item) => {
          const catStyle = GALLERY_CAT_STYLE[item.category as GalleryCategory];
          const showImg =
            item.media_type === "image" && isImage(item.media_url);

          return (
            <button
              key={item.id}
              onClick={() => setLightbox(item)}
              className="group rounded-2xl border border-white/[0.07] bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06] overflow-hidden transition-all text-left"
            >
              {/* Media thumbnail */}
              <div className="aspect-video bg-black/30 flex items-center justify-center overflow-hidden relative">
                {showImg ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.media_url}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div
                    className={`flex flex-col items-center gap-2 ${catStyle.text}`}
                  >
                    <span className="text-2xl">{catStyle.icon}</span>
                    <span className="text-xs opacity-60">
                      {item.media_type}
                    </span>
                  </div>
                )}
                {/* Category badge overlay */}
                <div
                  className={`absolute top-2 left-2 text-[9px] font-bold px-2 py-0.5 rounded-md ${catStyle.bg} ${catStyle.text} ${catStyle.border} border backdrop-blur-sm`}
                >
                  {catStyle.icon} {item.category}
                </div>
              </div>

              {/* Info */}
              <div className="p-3 space-y-1">
                <p className="text-xs font-semibold text-white line-clamp-1">
                  {item.title}
                </p>
                {item.skills_tagged.length > 0 && (
                  <p className="text-[10px] text-white/35 line-clamp-1">
                    {item.skills_tagged.join(" · ")}
                  </p>
                )}
                <p className="text-[9px] text-white/25">
                  {new Date(item.captured_on + "T00:00:00").toLocaleDateString(
                    "en-KE",
                    { day: "numeric", month: "short", year: "numeric" },
                  )}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <Lightbox item={lightbox} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}
