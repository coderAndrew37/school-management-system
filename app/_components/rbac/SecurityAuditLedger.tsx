'use client';

import React, { useState } from 'react';
import type { AuditLogEntry, AuditActionType } from '@/lib/data/rbac-fetcher';
import { Badge, Card, EmptyState, StatCard } from './ui-primitives';

// ============================================================================
// TYPES
// ============================================================================

interface AuditLedgerProps {
  logs: AuditLogEntry[];
}

// New enum values from audit_action_type — all values the DB can produce
type ActionFilter = 'ALL' | AuditActionType;

// ============================================================================
// DISPLAY HELPERS — aligned to new audit_action_type enum
// ============================================================================

function getActionBadge(actionType: AuditActionType): React.ReactElement {
  const map: Record<AuditActionType, { variant: 'amber' | 'emerald' | 'rose' | 'sky' | 'slate' | 'purple'; label: string }> = {
    ROLE_ASSIGN:               { variant: 'emerald', label: 'Role Assigned'    },
    ROLE_REVOKE:               { variant: 'rose',    label: 'Role Revoked'     },
    PERMISSION_OVERRIDE_SET:   { variant: 'amber',   label: 'Override Set'     },
    PERMISSION_OVERRIDE_CLEAR: { variant: 'slate',   label: 'Override Cleared' },
    TRANSFER_IN:               { variant: 'emerald', label: 'Transfer In'      },
    TRANSFER_OUT:              { variant: 'rose',    label: 'Transfer Out'     },
    PROFILE_UPDATE:            { variant: 'sky',     label: 'Profile Update'   },
    STUDENT_CREATE:            { variant: 'emerald', label: 'Student Created'  },
    STUDENT_UPDATE:            { variant: 'sky',     label: 'Student Updated'  },
    STUDENT_TRANSFER:          { variant: 'amber',   label: 'Student Transfer' },
    INSERT:                    { variant: 'sky',     label: 'Insert'           },
    UPDATE:                    { variant: 'amber',   label: 'Update'           },
    DELETE:                    { variant: 'rose',    label: 'Delete'           },
  };
  const config = map[actionType] ?? { variant: 'slate' as const, label: actionType };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

function getActionIcon(actionType: AuditActionType): React.ReactElement {
  const icons: Partial<Record<AuditActionType, React.ReactElement>> = {
    ROLE_ASSIGN: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
      </svg>
    ),
    ROLE_REVOKE: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
      </svg>
    ),
    PERMISSION_OVERRIDE_SET: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    PERMISSION_OVERRIDE_CLEAR: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
      </svg>
    ),
    TRANSFER_IN: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
      </svg>
    ),
    TRANSFER_OUT: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
    ),
    DELETE: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    ),
  };

  return icons[actionType] ?? (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function getRowAccentClass(actionType: AuditActionType): string {
  switch (actionType) {
    case 'ROLE_ASSIGN':
    case 'TRANSFER_IN':
    case 'STUDENT_CREATE':
    case 'INSERT':
      return 'border-l-emerald-400/30';
    case 'ROLE_REVOKE':
    case 'TRANSFER_OUT':
    case 'DELETE':
      return 'border-l-rose-400/30';
    case 'PERMISSION_OVERRIDE_SET':
    case 'UPDATE':
    case 'PROFILE_UPDATE':
    case 'STUDENT_UPDATE':
    case 'STUDENT_TRANSFER':
      return 'border-l-amber-400/30';
    default:
      return 'border-l-white/10';
  }
}

function getIconAccentClass(actionType: AuditActionType): string {
  switch (actionType) {
    case 'ROLE_ASSIGN':
    case 'TRANSFER_IN':
    case 'STUDENT_CREATE':
    case 'INSERT':
      return 'text-emerald-400 bg-emerald-500/10';
    case 'ROLE_REVOKE':
    case 'TRANSFER_OUT':
    case 'DELETE':
      return 'text-rose-400 bg-rose-500/10';
    case 'PERMISSION_OVERRIDE_SET':
    case 'UPDATE':
    case 'PROFILE_UPDATE':
      return 'text-amber-400 bg-amber-400/10';
    default:
      return 'text-white/40 bg-white/[0.05]';
  }
}

function formatRelativeTime(isoDate: string): string {
  const diffMs  = Date.now() - new Date(isoDate).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr  = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60)  return 'just now';
  if (diffMin < 60)  return `${diffMin}m ago`;
  if (diffHr  < 24)  return `${diffHr}h ago`;
  if (diffDay < 7)   return `${diffDay}d ago`;
  return new Date(isoDate).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Human-readable label for filter buttons
function filterLabel(type: ActionFilter): string {
  if (type === 'ALL') return 'All';
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ============================================================================
// LOG DETAIL — renders old/new JSONB diff + context panel
// ============================================================================

function LogDetail({ log }: { log: AuditLogEntry }): React.ReactElement {
  let oldVals: Record<string, unknown> | null = null;
  let newVals: Record<string, unknown> | null = null;

  try { oldVals = log.old_values ? JSON.parse(log.old_values) : null; } catch { /* ignore */ }
  try { newVals = log.new_values ? JSON.parse(log.new_values) : null; } catch { /* ignore */ }

  return (
    <div className="mt-3 pt-3 border-t border-white/[0.05] space-y-3">
      {/* Context — always shown when present */}
      {log.context && Object.keys(log.context).length > 0 && (
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-3">
          <p className="text-white/30 text-[10px] uppercase tracking-widest font-mono mb-2">Context</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {Object.entries(log.context).map(([k, v]) => (
              <span key={k} className="text-[10px] font-mono">
                <span className="text-white/30">{k}:</span>{' '}
                <span className="text-white/55">{String(v)}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Before / After diff */}
      {(oldVals || newVals) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {oldVals && (
            <div>
              <p className="text-white/30 text-[10px] uppercase tracking-widest font-mono mb-1.5">Before</p>
              <div className="bg-rose-500/[0.04] border border-rose-500/10 rounded-lg p-3 overflow-hidden">
                <pre className="text-rose-300/60 text-[10px] font-mono whitespace-pre-wrap break-all">
                  {JSON.stringify(oldVals, null, 2)}
                </pre>
              </div>
            </div>
          )}
          {newVals && (
            <div>
              <p className="text-white/30 text-[10px] uppercase tracking-widest font-mono mb-1.5">After</p>
              <div className="bg-emerald-500/[0.04] border border-emerald-500/10 rounded-lg p-3 overflow-hidden">
                <pre className="text-emerald-300/60 text-[10px] font-mono whitespace-pre-wrap break-all">
                  {JSON.stringify(newVals, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// LOG ROW
// ============================================================================

function LogRow({ log }: { log: AuditLogEntry }): React.ReactElement {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={`border-l-2 ${getRowAccentClass(log.action_type)} pl-4 py-3 hover:bg-white/[0.015] transition-colors rounded-r-xl cursor-pointer`}
      onClick={() => setIsExpanded((v) => !v)}
    >
      <div className="flex items-start gap-3">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${getIconAccentClass(log.action_type)}`}>
          {getActionIcon(log.action_type)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {getActionBadge(log.action_type)}
            <span className="text-white/40 text-xs font-mono">{log.target_table}</span>
            <span className="text-white/20 text-[10px] font-mono hidden sm:inline">
              #{String(log.record_id).slice(0, 8)}…
            </span>
          </div>

          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {log.actor_profile && (
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full bg-white/[0.08] flex items-center justify-center">
                  <span className="text-white/50 text-[8px] font-mono">
                    {log.actor_profile.full_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-white/45 text-xs">{log.actor_profile.full_name}</span>
              </div>
            )}
            <span className="text-white/25 text-xs font-mono">{formatRelativeTime(log.created_at)}</span>
            <span className="text-white/15 text-xs hidden lg:inline">
              {new Date(log.created_at).toLocaleString('en-KE')}
            </span>
          </div>

          {isExpanded && <LogDetail log={log} />}
        </div>

        <svg className={`w-3.5 h-3.5 text-white/20 flex-shrink-0 mt-1.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN: SECURITY AUDIT LEDGER
// ============================================================================

// Quick-filter groups shown as tabs — most useful subsets of the full enum
const FILTER_GROUPS: ActionFilter[] = [
  'ALL',
  'ROLE_ASSIGN',
  'ROLE_REVOKE',
  'PERMISSION_OVERRIDE_SET',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'INSERT',
  'UPDATE',
  'DELETE',
];

export function SecurityAuditLedger({ logs }: AuditLedgerProps): React.ReactElement {
  const [actionFilter, setActionFilter] = useState<ActionFilter>('ALL');
  const [searchActor, setSearchActor]   = useState('');

  const filtered = logs.filter((log) => {
    const matchesAction = actionFilter === 'ALL' || log.action_type === actionFilter;
    const matchesActor  = !searchActor ||
      (log.actor_profile?.full_name ?? '').toLowerCase().includes(searchActor.toLowerCase());
    return matchesAction && matchesActor;
  });

  // Stats — updated to use new enum values
  const roleAssignCount  = logs.filter((l) => l.action_type === 'ROLE_ASSIGN').length;
  const roleRevokeCount  = logs.filter((l) => l.action_type === 'ROLE_REVOKE').length;
  const transferInCount  = logs.filter((l) => l.action_type === 'TRANSFER_IN').length;
  const transferOutCount = logs.filter((l) => l.action_type === 'TRANSFER_OUT').length;

  // Group by calendar date
  const groupedByDate = filtered.reduce<Record<string, AuditLogEntry[]>>((acc, log) => {
    const date = new Date(log.created_at).toLocaleDateString('en-KE', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(log);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Events" value={logs.length} accentColor="sky"
          icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
        />
        <StatCard label="Roles Assigned" value={roleAssignCount} accentColor="emerald"
          icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>}
        />
        <StatCard label="Roles Revoked" value={roleRevokeCount} accentColor="rose"
          icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" /></svg>}
        />
        <StatCard label="Transfers" value={transferInCount + transferOutCount} accentColor="amber"
          icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>}
        />
      </div>

      {/* Log Feed */}
      <Card>
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
          <div className="relative flex-1 w-full">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <input
              type="text"
              placeholder="Filter by actor name..."
              value={searchActor}
              onChange={(e) => setSearchActor(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl pl-9 pr-4 py-2 text-white text-xs placeholder:text-white/20 focus:outline-none focus:border-amber-400/30 transition-colors"
            />
          </div>

          {/* Action filter pills */}
          <div className="flex items-center gap-1 flex-wrap">
            {FILTER_GROUPS.map((type) => (
              <button
                key={type}
                onClick={() => setActionFilter(type)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-medium font-mono uppercase tracking-wide transition-all whitespace-nowrap ${
                  actionFilter === type
                    ? 'bg-white/[0.08] text-white border border-white/10'
                    : 'text-white/30 hover:text-white/55'
                }`}
              >
                {filterLabel(type)}
              </button>
            ))}
          </div>
        </div>

        {/* Entries */}
        <div className="px-5 py-4 space-y-6 max-h-[600px] overflow-y-auto">
          {Object.keys(groupedByDate).length === 0 ? (
            <EmptyState
              icon={<svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
              title="No audit events found"
              description="Security events matching your filters will appear here."
            />
          ) : (
            Object.entries(groupedByDate).map(([date, dateLogs]) => (
              <div key={date}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-white/25 text-[10px] font-mono uppercase tracking-widest whitespace-nowrap">{date}</span>
                  <div className="flex-1 h-px bg-white/[0.05]" />
                  <span className="text-white/15 text-[10px] font-mono">{dateLogs.length} events</span>
                </div>
                <div className="space-y-1">
                  {dateLogs.map((log) => <LogRow key={log.id} log={log} />)}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="px-5 py-3 border-t border-white/[0.04]">
          <p className="text-white/20 text-xs font-mono">
            {filtered.length} of {logs.length} events · Click any entry to expand diff
          </p>
        </div>
      </Card>
    </div>
  );
}