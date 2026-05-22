'use client';

import React, { useState, useTransition, useCallback } from 'react';
import type { StaffAccessProfile, RoleWithPermissions, SystemPermission } from '@/lib/data/rbac-fetchers';
import {
  Badge,
  StatusBadge,
  Card,
  SectionHeader,
  SlideOver,
  FormField,
  Button,
  Checkbox,
  EmptyState,
  TableSkeleton,
  StatCard,
} from './ui-primitives';
import { updateStaffAccessAction, transferTeacherOutAction } from '@/lib/actions/rbac-actions';
import { usePermissions } from '@/hooks/use-permissions';

// ============================================================================
// TYPES
// ============================================================================

interface StaffAccessMatrixProps {
  staff: StaffAccessProfile[];
  roles: RoleWithPermissions[];
  permissions: SystemPermission[];
}

interface StaffRowProps {
  member: StaffAccessProfile;
  onSelect: (member: StaffAccessProfile) => void;
}

interface AccessEditorProps {
  member: StaffAccessProfile;
  roles: RoleWithPermissions[];
  permissions: SystemPermission[];
  onClose: () => void;
  onSaved: () => void;
}

interface TransferOutFormProps {
  member: StaffAccessProfile;
  onClose: () => void;
  onTransferred: () => void;
}

// ============================================================================
// STAFF ROW
// ============================================================================

function StaffRow({ member, onSelect }: StaffRowProps): React.ReactElement {
  const initials = member.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <tr
      className="border-b border-white/[0.04] hover:bg-white/[0.025] cursor-pointer transition-colors group"
      onClick={() => onSelect(member)}
    >
      {/* Name */}
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-400/10 border border-amber-400/20 flex items-center justify-center flex-shrink-0">
            <span className="text-amber-400 text-xs font-semibold font-mono">{initials}</span>
          </div>
          <div>
            <p className="text-white text-sm font-medium group-hover:text-white/90">{member.full_name}</p>
            <p className="text-white/30 text-xs font-mono">{member.tsc_number ?? 'No TSC'}</p>
          </div>
        </div>
      </td>

      {/* Email */}
      <td className="px-5 py-3.5 hidden md:table-cell">
        <span className="text-white/40 text-xs">{member.email}</span>
      </td>

      {/* Status */}
      <td className="px-5 py-3.5">
        <StatusBadge status={member.status} />
      </td>

      {/* Roles */}
      <td className="px-5 py-3.5">
        <div className="flex flex-wrap gap-1">
          {member.roles.length === 0 ? (
            <span className="text-white/20 text-xs">No roles</span>
          ) : (
            member.roles.map((role) => (
              <Badge key={role.id} variant="amber">
                {role.role_name}
              </Badge>
            ))
          )}
        </div>
      </td>

      {/* Overrides */}
      <td className="px-5 py-3.5 hidden lg:table-cell">
        <div className="flex flex-wrap gap-1">
          {member.overrides.filter((o) => o.has_access).slice(0, 2).map((o) => (
            <Badge key={o.permission_id} variant="emerald">
              +{o.permission_name.split('_').slice(-1)[0]}
            </Badge>
          ))}
          {member.overrides.filter((o) => !o.has_access).slice(0, 2).map((o) => (
            <Badge key={o.permission_id} variant="rose">
              -{o.permission_name.split('_').slice(-1)[0]}
            </Badge>
          ))}
          {member.overrides.length === 0 && (
            <span className="text-white/20 text-xs">None</span>
          )}
        </div>
      </td>

      {/* Chevron */}
      <td className="px-5 py-3.5">
        <svg className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 transition-colors ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </td>
    </tr>
  );
}

// ============================================================================
// TRANSFER OUT FORM
// ============================================================================

function TransferOutForm({ member, onClose, onTransferred }: TransferOutFormProps): React.ReactElement {
  const [destination, setDestination] = useState('');
  const [reason, setReason] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (): void => {
    if (!destination.trim()) {
      setError('Destination school is required.');
      return;
    }
    startTransition(async () => {
      const result = await transferTeacherOutAction({
        teacherId: member.id,
        destinationSchoolName: destination.trim(),
        reason: reason.trim() || undefined,
      });
      if (result.success) {
        onTransferred();
        onClose();
      } else {
        setError(result.error ?? 'Unknown error occurred.');
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="bg-rose-500/[0.06] border border-rose-500/20 rounded-xl p-3.5">
        <p className="text-rose-400 text-xs font-medium">
          ⚠ This will immediately revoke all access tokens and security clearances for {member.full_name}.
        </p>
      </div>

      <FormField label="Destination School" hint="Enter the full name of the receiving institution">
        <input
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-rose-400/40 transition-colors"
          placeholder="e.g. Maseno National School"
          value={destination}
          onChange={(e) => {
            setDestination(e.target.value);
            setError(null);
          }}
        />
        {error && <p className="mt-1 text-rose-400 text-xs">{error}</p>}
      </FormField>

      <FormField label="Transfer Reason" hint="Optional — will be stored in audit trail">
        <textarea
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-rose-400/40 transition-colors resize-none"
          placeholder="Professional redeployment, personal request..."
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </FormField>

      <div className="flex gap-2 pt-2">
        <Button variant="ghost" onClick={onClose} className="flex-1" disabled={isPending}>
          Cancel
        </Button>
        <Button variant="danger" onClick={handleSubmit} isLoading={isPending} className="flex-1">
          Confirm Transfer Out
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// ACCESS EDITOR (Slide-Over Body)
// ============================================================================

function AccessEditor({ member, roles, permissions, onClose, onSaved }: AccessEditorProps): React.ReactElement {
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(
    new Set(member.roles.map((r) => r.id))
  );

  // Build initial overrides map: permissionId → true (grant) | false (revoke) | undefined (no override)
  const [overrideMap, setOverrideMap] = useState<Map<string, boolean>>(
    new Map(member.overrides.map((o) => [o.permission_id, o.has_access]))
  );

  const [showTransferForm, setShowTransferForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);

  const toggleRole = useCallback((roleId: string) => {
    setSelectedRoleIds((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return next;
    });
  }, []);

  const toggleOverride = useCallback((permId: string, current: boolean | undefined) => {
    setOverrideMap((prev) => {
      const next = new Map(prev);
      if (current === undefined) {
        next.set(permId, true); // grant
      } else if (current === true) {
        next.set(permId, false); // revoke
      } else {
        next.delete(permId); // remove override
      }
      return next;
    });
  }, []);

  const handleSave = (): void => {
    startTransition(async () => {
      const overrides = Array.from(overrideMap.entries()).map(([permissionId, hasAccess]) => ({
        permissionId,
        hasAccess,
      }));
      const result = await updateStaffAccessAction(member.id, {
        roleIds: Array.from(selectedRoleIds),
        overrides,
      });
      if (result.success) {
        onSaved();
        onClose();
      } else {
        setSaveError(result.error ?? 'Failed to save.');
      }
    });
  };

  // Group permissions by category
  const grouped = permissions.reduce<Record<string, SystemPermission[]>>((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {});

  if (showTransferForm) {
    return (
      <TransferOutForm
        member={member}
        onClose={() => setShowTransferForm(false)}
        onTransferred={onClose}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Role Assignments */}
      <div>
        <h4 className="text-amber-400 text-xs font-semibold uppercase tracking-widest mb-3 flex items-center gap-2">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Role Assignments
        </h4>
        <div className="space-y-2">
          {roles.map((role) => (
            <Checkbox
              key={role.id}
              checked={selectedRoleIds.has(role.id)}
              onChange={() => toggleRole(role.id)}
              label={role.role_name}
              description={`${role.permissions.length} permission${role.permissions.length !== 1 ? 's' : ''} · ${role.description || 'No description'}`}
              accentColor="amber"
            />
          ))}
          {roles.length === 0 && (
            <p className="text-white/25 text-xs">No custom roles configured yet.</p>
          )}
        </div>
      </div>

      {/* Permission Overrides */}
      <div>
        <h4 className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-3 flex items-center gap-2">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Individual Permission Overrides
        </h4>
        <p className="text-white/25 text-xs mb-3">
          Click once to grant (+), twice to revoke (−), three times to remove override.
        </p>

        {Object.entries(grouped).map(([category, perms]) => (
          <div key={category} className="mb-4">
            <p className="text-white/30 text-[10px] uppercase tracking-widest font-mono mb-2">{category}</p>
            <div className="space-y-1.5">
              {perms.map((perm) => {
                const current = overrideMap.get(perm.id);
                return (
                  <div
                    key={perm.id}
                    className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] cursor-pointer transition-colors"
                    onClick={() => toggleOverride(perm.id, current)}
                  >
                    <span className="text-white/55 text-xs">{perm.permission_name}</span>
                    <span className="flex-shrink-0">
                      {current === undefined && (
                        <span className="text-white/20 text-xs">—</span>
                      )}
                      {current === true && (
                        <Badge variant="emerald">+ Granted</Badge>
                      )}
                      {current === false && (
                        <Badge variant="rose">− Revoked</Badge>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Error */}
      {saveError && (
        <div className="bg-rose-500/[0.06] border border-rose-500/20 rounded-xl p-3">
          <p className="text-rose-400 text-xs">{saveError}</p>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2 pt-2 border-t border-white/[0.06]">
        <Button variant="primary" onClick={handleSave} isLoading={isPending} className="w-full justify-center">
          Save Access Configuration
        </Button>
        {member.status === 'active' && (
          <Button
            variant="danger"
            onClick={() => setShowTransferForm(true)}
            className="w-full justify-center"
            disabled={isPending}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Transfer Out
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN: STAFF ACCESS MATRIX
// ============================================================================

export function StaffAccessMatrix({ staff, roles, permissions }: StaffAccessMatrixProps): React.ReactElement {
  const { isSuperAdmin, isLoading: permLoading } = usePermissions();
  const [selectedMember, setSelectedMember] = useState<StaffAccessProfile | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'transferred'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const filtered = staff.filter((s) => {
    const matchesFilter = filter === 'all' || s.status === filter;
    const matchesSearch =
      searchQuery === '' ||
      s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.tsc_number ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const activeCount = staff.filter((s) => s.status === 'active').length;
  const transferredCount = staff.filter((s) => s.status === 'transferred').length;
  const overriddenCount = staff.filter((s) => s.overrides.length > 0).length;

  return (
    <div className="space-y-5">
      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Active Staff"
          value={activeCount}
          accentColor="emerald"
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          }
        />
        <StatCard
          label="Transferred Out"
          value={transferredCount}
          accentColor="rose"
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7" />
            </svg>
          }
        />
        <StatCard
          label="With Overrides"
          value={overriddenCount}
          accentColor="amber"
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          }
        />
        <StatCard
          label="Total Roles"
          value={roles.length}
          accentColor="sky"
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }
        />
      </div>

      {/* Table Card */}
      <Card>
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
          {/* Search */}
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search staff by name, TSC, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl pl-9 pr-4 py-2 text-white text-xs placeholder:text-white/20 focus:outline-none focus:border-amber-400/30 transition-colors"
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 bg-white/[0.03] rounded-xl p-1 border border-white/[0.06]">
            {(['active', 'transferred', 'all'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                  filter === f
                    ? 'bg-white/[0.08] text-white'
                    : 'text-white/35 hover:text-white/60'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {filtered.length === 0 ? (
            <EmptyState
              icon={
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
              title="No staff found"
              description="No staff members match your current filter criteria."
            />
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {['Staff Member', 'Email', 'Status', 'Roles', 'Overrides', ''].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-white/30 text-[10px] uppercase tracking-widest font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((member) => (
                  <StaffRow
                    key={`${member.id}-${refreshKey}`}
                    member={member}
                    onSelect={setSelectedMember}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer count */}
        <div className="px-5 py-3 border-t border-white/[0.04]">
          <p className="text-white/25 text-xs font-mono">
            {filtered.length} of {staff.length} staff members
          </p>
        </div>
      </Card>

      {/* Access Editor Slide-Over */}
      {selectedMember && (
        <SlideOver
          isOpen={!!selectedMember}
          onClose={() => setSelectedMember(null)}
          title={selectedMember.full_name}
          subtitle={`TSC ${selectedMember.tsc_number ?? '—'} · ${selectedMember.email}`}
        >
          <AccessEditor
            member={selectedMember}
            roles={roles}
            permissions={permissions}
            onClose={() => setSelectedMember(null)}
            onSaved={() => {
              setRefreshKey((k) => k + 1);
              setSelectedMember(null);
            }}
          />
        </SlideOver>
      )}
    </div>
  );
}