"use client";

import { useState } from "react";
import type { GalleryItemFull } from "@/lib/actions/gallery";
import type { Audience } from "./gallery.types";
import { AUDIENCE_CONFIG } from "./gallery.config";
import { audienceBadge, formatDate } from "./gallery.utils";

interface Props {
  items: (GalleryItemFull & { signedUrl: string })[];
  studentNameMap: Record<string, string>;
  onLightbox: (src: string) => void;
  onDeleteRequest: (id: string) => void;
}

export function GalleryGrid({
  items,
  studentNameMap,
  onLightbox,
  onDeleteRequest,
}: Props) {
  const [filterAudience, setFilterAudience] = useState<string>("all");

  const filtered = items.filter(
    (i) => filterAudience === "all" || i.audience === filterAudience,
  );

  return (
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
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all capitalize ${
              filterAudience === f
                ? "bg-slate-800 text-white border-slate-800"
                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
            }`}
          >
            {f === "all" ? "All" : (AUDIENCE_CONFIG[f as Audience]?.label ?? f)}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-400">{filtered.length} images</span>
      </div>

      {/* Grid / empty state */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
          </div>
          <p className="text-slate-400 text-sm">No images uploaded yet.</p>
          <p className="text-slate-300 text-xs mt-1">Drop images on the left to get started.</p>
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
                {/* Thumbnail */}
                <div
                  className="aspect-square bg-slate-100 cursor-pointer overflow-hidden"
                  onClick={() => item.signedUrl && onLightbox(item.signedUrl)}
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
                      <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Z" />
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

                {/* Delete button */}
                <button
                  aria-label="delete image"
                  onClick={() => onDeleteRequest(item.id)}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-white/90 text-slate-400 hover:text-red-500 hover:bg-white opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>

                {/* Caption */}
                <div className="px-3 py-2">
                  <p className="text-xs font-medium text-slate-700 truncate">{item.title}</p>
                  {item.category && (
                    <p className="text-xs text-slate-400 truncate">{item.category}</p>
                  )}
                  <p className="text-xs text-slate-300 mt-0.5">
                    {audienceBadge(item, studentNameMap)} · {formatDate(item.created_at)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}