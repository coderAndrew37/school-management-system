"use client";

// app/(admin)/settings/_components/IdentityPanel.tsx

import Image from "next/image";
import { Building2, Upload, Loader2 } from "lucide-react";
import type { SchoolSettings } from "@/lib/actions/settings";
import { SectionHeading, Field } from "./UI";

interface IdentityPanelProps {
  settings: SchoolSettings;
  previewUrl: string | null;
  logoUploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onLogoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function IdentityPanel({
  settings,
  previewUrl,
  logoUploading,
  fileInputRef,
  onLogoChange,
}: IdentityPanelProps) {
  return (
    <div className="space-y-5">
      {/* Logo */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
        <SectionHeading
          icon={<Upload className="h-4 w-4" />}
          title="School Logo"
        />
        <div className="flex items-center gap-6 mt-4">
          <div className="relative w-20 h-20 rounded-2xl border border-white/10 bg-white/[0.04] overflow-hidden flex items-center justify-center flex-shrink-0">
            {previewUrl ? (
              <Image
                src={previewUrl}
                alt="School logo"
                fill
                unoptimized
                className="object-contain p-2"
              />
            ) : (
              <Building2 className="h-8 w-8 text-white/20" />
            )}
            {logoUploading && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <Loader2 className="h-5 w-5 text-amber-400 animate-spin" />
              </div>
            )}
          </div>
          <div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2 text-xs font-semibold text-white/70 hover:text-white hover:bg-white/[0.08] transition-all"
            >
              <Upload className="h-3.5 w-3.5" />
              {previewUrl ? "Replace Logo" : "Upload Logo"}
            </button>
            <p className="text-[10px] text-white/25 mt-1.5">
              PNG, JPEG, WEBP or SVG · Max 2 MB
            </p>
          </div>
          <input
            disabled={logoUploading}
            aria-label="upload logo"
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={onLogoChange}
          />
        </div>
      </div>

      {/* Details */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-4">
        <SectionHeading
          icon={<Building2 className="h-4 w-4" />}
          title="School Details"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <Field
            label="School Name *"
            name="school_name"
            defaultValue={settings.school_name}
            placeholder="e.g. Kibali Academy"
            required
          />
          <Field
            label="School Motto"
            name="school_motto"
            defaultValue={settings.school_motto ?? ""}
            placeholder="e.g. Preserving Excellence"
          />
          <Field
            label="Phone Number"
            name="school_phone"
            defaultValue={settings.school_phone ?? ""}
            placeholder="+254 712 345 678"
          />
          <Field
            label="Email Address"
            name="school_email"
            type="email"
            defaultValue={settings.school_email ?? ""}
            placeholder="info@school.ac.ke"
          />
        </div>

        <Field
          label="Physical Address"
          name="school_address"
          defaultValue={settings.school_address ?? ""}
          placeholder="Lang'ata Road, Karen South, Nairobi"
          textarea
        />
      </div>
    </div>
  );
}