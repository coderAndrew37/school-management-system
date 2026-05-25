// app/(admin)/admin/access-denied/page.tsx
// Rendered when the server layout detects a domain-action permission failure.

import Link from 'next/link';

export default function AccessDeniedPage() {
  return (
    <div className="min-h-screen bg-[#0c0f1a] flex items-center justify-center px-4">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-rose-500/[0.04] blur-[140px]" />
      </div>

      <div className="max-w-md w-full text-center space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2
                   2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
        </div>

        {/* Copy */}
        <div>
          <h1 className="text-white font-bold text-2xl tracking-tight mb-2">
            Access Denied
          </h1>
          <p className="text-white/40 text-sm leading-relaxed">
            You don&apos;t have permission to view this page.
            If you believe this is an error, please contact your school administrator
            to review your role assignments.
          </p>
        </div>

        {/* Permission context hint */}
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4 text-left">
          <p className="text-white/30 text-xs font-mono uppercase tracking-widest mb-2">What happened?</p>
          <ul className="space-y-1.5 text-white/40 text-xs">
            <li className="flex items-start gap-2">
              <span className="text-rose-400 mt-0.5 flex-shrink-0">→</span>
              Your current role doesn&apos;t include the permission required for this route.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-rose-400 mt-0.5 flex-shrink-0">→</span>
              The super admin may have revoked your access to this area.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-rose-400 mt-0.5 flex-shrink-0">→</span>
              Permission changes take effect immediately — no re-login required.
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-amber-400/15 text-amber-400 border border-amber-400/25 hover:bg-amber-400/20 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Go to Dashboard
          </Link>
          <Link
            href="/admin/settings"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-white/[0.04] text-white/60 border border-white/[0.08] hover:bg-white/[0.07] transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </Link>
        </div>
      </div>
    </div>
  );
}

export const metadata = {
  title: 'Access Denied — Kibali Academy',
};