import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ── Image domains ─────────────────────────────────────────────────────────
  // Allows Next.js <Image> to serve optimised images from Supabase Storage
  // without needing the `unoptimized` prop on every image.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  // ── Role-root redirects ───────────────────────────────────────────────────
  // These handle the address-bar UX when an authenticated user navigates to
  // a role prefix root (e.g. types "/admin" into the browser).
  // Middleware handles the actual role enforcement — these just ensure the
  // URL resolves to a real page rather than a 404.
  //
  //  /admin   → /admin/dashboard   (admin & superadmin landing)
  //  /teacher → /teacher           (teacher homepage IS /teacher, no stub needed)
  //  /parent  → /parent            (parent homepage IS /parent, no stub needed)
  //
  // ROLE_ROUTES in lib/types/auth must match these destinations exactly.
  async redirects() {
    return [
      {
        source: "/admin",
        destination: "/admin/dashboard",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
