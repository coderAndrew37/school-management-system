import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ── Server Actions Config ──────────────────────────────────────────────────
  // Fixes the "Body exceeded 1 MB limit" error.
  // Set to 4mb to comfortably handle 2mb student photo limit + metadata.
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },

  // ── Image domains ─────────────────────────────────────────────────────────
  // Allows Next.js <Image> to serve optimised images from Supabase Storage
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  // ── Security & Optimization ────────────────────────────────────────────────
  // Recommended for Supabase/Auth heavy apps to prevent middleware redirect loops
  skipTrailingSlashRedirect: true,

  // Clean console logs for server-side fetches (great for debugging FYP actions)
  logging: {
    fetches: {
      fullUrl: true,
    },
  },

  // ── Role-root redirects ───────────────────────────────────────────────────
  async redirects() {
    return [
      {
        source: "/admin",
        destination: "/admin/dashboard",
        permanent: false,
      },
      // If you eventually create a student dashboard, add it here:
      // { source: "/student", destination: "/student/portal", permanent: false },
    ];
  },
};

export default nextConfig;
