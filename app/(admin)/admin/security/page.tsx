import React from 'react';
import { Suspense } from 'react';
import {
  getSchoolRoles,
  getSystemPermissionsCatalog,
  getStaffAccessDirectory,
  getSecurityAuditLogs,
  type RoleWithPermissions,
  type StaffAccessProfile,
  type SystemPermission,
  type AuditLogEntry,
} from '@/lib/data/rbac-fetchers';
import { RbacShell } from '@/app/_components/rbac/RbacShell';
import { AmbientGlow } from '@/app/_components/rbac/ui-primitives';

// ============================================================================
// LOADING FALLBACK
// ============================================================================

function SecurityPageSkeleton(): React.ReactElement {
  return (
    <div className="min-h-screen bg-[#0c0f1a]">
      <AmbientGlow />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header skeleton */}
        <div className="space-y-2">
          <div className="h-4 w-48 bg-white/[0.04] rounded-lg animate-pulse" />
          <div className="h-8 w-96 bg-white/[0.04] rounded-xl animate-pulse" />
          <div className="h-4 w-72 bg-white/[0.04] rounded-lg animate-pulse" />
        </div>
        {/* Tab bar skeleton */}
        <div className="h-12 bg-white/[0.02] rounded-xl animate-pulse border border-white/[0.04]" />
        {/* Stats skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-white/[0.03] rounded-xl border border-white/[0.06] animate-pulse" />
          ))}
        </div>
        {/* Table skeleton */}
        <div className="h-96 bg-white/[0.02] rounded-2xl border border-white/[0.06] animate-pulse" />
      </div>
    </div>
  );
}

// ============================================================================
// DATA LOADER (async Server Component boundary)
// ============================================================================

async function SecurityDataLoader(): Promise<React.ReactElement> {
  const [staff, roles, permissions, auditLogs] = await Promise.all([
    getStaffAccessDirectory('all').catch((): StaffAccessProfile[] => []),
    getSchoolRoles().catch((): RoleWithPermissions[] => []),
    getSystemPermissionsCatalog().catch((): SystemPermission[] => []),
    getSecurityAuditLogs(100).catch((): AuditLogEntry[] => []),
  ]);

  return (
    <RbacShell
      staff={staff}
      roles={roles}
      permissions={permissions}
      auditLogs={auditLogs}
    />
  );
}

// ============================================================================
// PAGE
// ============================================================================

export default function SecurityPage(): React.ReactElement {
  return (
    <Suspense fallback={<SecurityPageSkeleton />}>
      <SecurityDataLoader />
    </Suspense>
  );
}

export const metadata = {
  title: 'Security & Access Control — Kibali Academy',
  description: 'Role-based access control, permission overrides, and staff lifecycle management.',
};