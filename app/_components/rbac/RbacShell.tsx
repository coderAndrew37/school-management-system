'use client';

import React, { useState } from 'react';
import type { RoleWithPermissions, StaffAccessProfile, SystemPermission, AuditLogEntry } from '@/lib/data/rbac-fetchers';
import { AmbientGlow } from './ui-primitives';
import { StaffAccessMatrix } from './StaffAccessMatrix';
import { RoleConfigurator } from './RoleConfigurator';
import { SecurityAuditLedger } from './SecurityAuditLedger';
import { usePermissions } from '@/hooks/use-permissions';

// ============================================================================
// TYPES
// ============================================================================

interface RbacShellProps {
  staff: StaffAccessProfile[];
  roles: RoleWithPermissions[];
  permissions: SystemPermission[];
  auditLogs: AuditLogEntry[];
}

type TabId = 'staff' | 'roles' | 'audit';

interface TabConfig {
  id: TabId;
  label: string;
  accentColor: string;
  icon: React.ReactElement;
  badge?: number | string;
}

// ============================================================================
// SHELL
// ============================================================================

export function RbacShell({ staff, roles, permissions, auditLogs }: RbacShellProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState<TabId>('staff');
  const { isSuperAdmin, isLoading } = usePermissions();

  const activeStaff = staff.filter((s) => s.status === 'active').length;

  const tabs: TabConfig[] = [
    {
      id: 'staff',
      label: 'Staff Access Matrix',
      accentColor: 'emerald',
      badge: activeStaff,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      id: 'roles',
      label: 'Role Configurator',
      accentColor: 'amber',
      badge: roles.length,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
    {
      id: 'audit',
      label: 'Security Audit Ledger',
      accentColor: 'sky',
      badge: auditLogs.length,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
    },
  ];

  const tabAccentClasses: Record<string, { active: string; text: string }> = {
    emerald: { active: 'border-b-2 border-emerald-400 text-emerald-400', text: 'text-emerald-400' },
    amber: { active: 'border-b-2 border-amber-400 text-amber-400', text: 'text-amber-400' },
    sky: { active: 'border-b-2 border-sky-400 text-sky-400', text: 'text-sky-400' },
  };

  const badgeAccent: Record<string, string> = {
    emerald: 'bg-emerald-500/10 text-emerald-400',
    amber: 'bg-amber-400/10 text-amber-400',
    sky: 'bg-sky-500/10 text-sky-400',
  };

  return (
    <div className="min-h-screen bg-[#0c0f1a]">
      <AmbientGlow />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-amber-400/10 border border-amber-400/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white/25 text-xs font-mono">Kibali Academy</span>
                <span className="text-white/15 text-xs">›</span>
                <span className="text-white/25 text-xs font-mono">Security</span>
              </div>
            </div>
          </div>

          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-white font-bold text-2xl tracking-tight">
                Access Control
                <span className="text-amber-400"> & </span>
                Security Engine
              </h1>
              <p className="text-white/35 text-sm mt-1">
                Multi-tenant role management, permission overrides, and staff lifecycle tracking
              </p>
            </div>

            {/* Super Admin Indicator */}
            {!isLoading && isSuperAdmin && (
              <div className="flex items-center gap-2 bg-amber-400/8 border border-amber-400/15 rounded-xl px-3 py-2 hidden sm:flex">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-amber-400/80 text-xs font-medium">Super Admin</span>
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-white/[0.07] mb-6">
          <div className="flex items-center gap-0 overflow-x-auto scrollbar-none">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const accent = tabAccentClasses[tab.accentColor];

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2.5 px-5 py-3.5 text-sm font-medium transition-all whitespace-nowrap -mb-px ${
                    isActive
                      ? `${accent.active} ${accent.text}`
                      : 'text-white/35 hover:text-white/60 border-b-2 border-transparent'
                  }`}
                >
                  <span className={isActive ? accent.text : 'text-white/25'}>{tab.icon}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                  {tab.badge !== undefined && (
                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-medium ${
                      isActive ? badgeAccent[tab.accentColor] : 'bg-white/[0.04] text-white/25'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'staff' && (
            <StaffAccessMatrix
              staff={staff}
              roles={roles}
              permissions={permissions}
            />
          )}

          {activeTab === 'roles' && (
            <RoleConfigurator
              roles={roles}
              permissions={permissions}
            />
          )}

          {activeTab === 'audit' && (
            <SecurityAuditLedger logs={auditLogs} />
          )}
        </div>
      </div>
    </div>
  );
}