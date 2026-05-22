'use client';

import React, { useState, useTransition, useCallback } from 'react';
import type { RoleWithPermissions, SystemPermission } from '@/lib/data/rbac-fetcher';
import {
  Badge,
  Card,
  SectionHeader,
  Modal,
  FormField,
  TextInput,
  TextArea,
  Button,
  Checkbox,
  EmptyState,
  StatCard,
  getCategoryIcon,
} from './ui-primitives';
import { saveRoleAction, deleteRoleAction } from '@/lib/actions/rbac';
import { usePermissions } from '@/hooks/use-permissions';

// ============================================================================
// TYPES
// ============================================================================

interface RoleConfiguratorProps {
  roles: RoleWithPermissions[];
  permissions: SystemPermission[];
}

interface RoleCardProps {
  role: RoleWithPermissions;
  onEdit: (role: RoleWithPermissions) => void;
  onDelete: (roleId: string) => void;
  canManage: boolean;
}

interface RoleFormProps {
  role?: RoleWithPermissions;
  permissions: SystemPermission[];
  onClose: () => void;
  onSaved: () => void;
}

interface FormErrors {
  roleName?: string;
}

// ============================================================================
// ROLE CARD
// ============================================================================

function RoleCard({ role, onEdit, onDelete, canManage }: RoleCardProps): React.ReactElement {
  const [isDeleting, startDeleteTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Group permissions by category
  const categoryMap = role.permissions.reduce<Record<string, number>>((acc, p) => {
    acc[p.category] = (acc[p.category] ?? 0) + 1;
    return acc;
  }, {});

  const handleDelete = (): void => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    startDeleteTransition(async () => {
      await deleteRoleAction(role.id);
      setConfirmDelete(false);
    });
  };

  return (
    <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 flex flex-col gap-4 hover:border-white/[0.11] transition-colors group">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-400/10 border border-amber-400/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm leading-tight">{role.role_name}</h3>
            <p className="text-white/35 text-xs mt-0.5 line-clamp-1">{role.description || 'No description'}</p>
          </div>
        </div>
        <Badge variant="amber" className="flex-shrink-0">
          {role.permissions.length}
        </Badge>
      </div>

      {/* Category Breakdown */}
      {Object.keys(categoryMap).length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(categoryMap).map(([cat, count]) => (
            <div
              key={cat}
              className="flex items-center gap-1.5 bg-white/[0.03] border border-white/[0.06] rounded-lg px-2 py-1"
            >
              <span className="text-white/35">{getCategoryIcon(cat)}</span>
              <span className="text-white/45 text-[10px] font-mono">{cat}</span>
              <span className="text-white/25 text-[10px]">×{count}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-white/20 text-xs">No permissions assigned</p>
      )}

      {/* Permission Tags (first 4) */}
      {role.permissions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {role.permissions.slice(0, 4).map((p) => (
            <span key={p.permission_id} className="text-[10px] text-white/30 bg-white/[0.03] border border-white/[0.05] px-2 py-0.5 rounded-md font-mono">
              {p.permission_name}
            </span>
          ))}
          {role.permissions.length > 4 && (
            <span className="text-[10px] text-white/20 px-1">+{role.permissions.length - 4} more</span>
          )}
        </div>
      )}

      {/* Created at */}
      <p className="text-white/20 text-[10px] font-mono mt-auto">
        Created {new Date(role.created_at).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })}
      </p>

      {/* Actions */}
      {canManage && (
        <div className="flex items-center gap-2 pt-2 border-t border-white/[0.05]">
          <Button variant="ghost" size="sm" onClick={() => onEdit(role)} className="flex-1 justify-center">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleDelete}
            isLoading={isDeleting}
            className="flex-1 justify-center"
          >
            {confirmDelete ? (
              <>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Confirm?
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ROLE FORM (Create / Edit Modal)
// ============================================================================

function RoleForm({ role, permissions, onClose, onSaved }: RoleFormProps): React.ReactElement {
  const [roleName, setRoleName] = useState(role?.role_name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [selectedPermIds, setSelectedPermIds] = useState<Set<string>>(
    new Set(role?.permissions.map((p) => p.permission_id) ?? [])
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [permSearch, setPermSearch] = useState('');

  const togglePerm = useCallback((permId: string) => {
    setSelectedPermIds((prev) => {
      const next = new Set(prev);
      if (next.has(permId)) next.delete(permId);
      else next.add(permId);
      return next;
    });
  }, []);

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!roleName.trim()) e.roleName = 'Role name is required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = (): void => {
    if (!validate()) return;
    startTransition(async () => {
      const result = await saveRoleAction({
        roleId: role?.id,
        roleName: roleName.trim(),
        description: description.trim(),
        permissionIds: Array.from(selectedPermIds),
      });
      if (result.success) {
        onSaved();
        onClose();
      } else {
        setSaveError(result.error ?? 'Failed to save role.');
      }
    });
  };

  // Group & filter permissions
  const filteredPerms = permissions.filter(
    (p) =>
      permSearch === '' ||
      p.permission_name.toLowerCase().includes(permSearch.toLowerCase()) ||
      p.category.toLowerCase().includes(permSearch.toLowerCase())
  );

  const grouped = filteredPerms.reduce<Record<string, SystemPermission[]>>((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      {/* Role Details */}
      <FormField label="Role Name">
        <TextInput
          placeholder="e.g. Exam Coordinator"
          value={roleName}
          onChange={(e) => { setRoleName(e.target.value); setErrors((prev) => ({ ...prev, roleName: undefined })); }}
          error={errors.roleName}
        />
      </FormField>

      <FormField label="Description" hint="Optional — helps staff understand the role's scope">
        <TextArea
          placeholder="Brief description of responsibilities..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
      </FormField>

      {/* Permission Selector */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-white/60 text-xs font-medium tracking-wide uppercase">
            Permissions
            <span className="ml-2 text-amber-400 font-mono">{selectedPermIds.size} selected</span>
          </label>
          {selectedPermIds.size > 0 && (
            <button
              onClick={() => setSelectedPermIds(new Set())}
              className="text-white/30 hover:text-white/60 text-xs transition-colors"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Filter permissions..."
            value={permSearch}
            onChange={(e) => setPermSearch(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl pl-9 pr-4 py-2 text-white text-xs placeholder:text-white/20 focus:outline-none focus:border-amber-400/30 transition-colors"
          />
        </div>

        <div className="max-h-64 overflow-y-auto space-y-4 pr-1">
          {Object.entries(grouped).map(([category, perms]) => (
            <div key={category}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-white/35">{getCategoryIcon(category)}</span>
                <span className="text-white/30 text-[10px] uppercase tracking-widest font-mono">{category}</span>
              </div>
              <div className="space-y-1.5 pl-4">
                {perms.map((perm) => (
                  <Checkbox
                    key={perm.id}
                    checked={selectedPermIds.has(perm.id)}
                    onChange={() => togglePerm(perm.id)}
                    label={perm.permission_name}
                    description={perm.description || undefined}
                    accentColor="amber"
                  />
                ))}
              </div>
            </div>
          ))}
          {Object.keys(grouped).length === 0 && (
            <p className="text-white/25 text-xs text-center py-4">No permissions match your search.</p>
          )}
        </div>
      </div>

      {/* Error */}
      {saveError && (
        <div className="bg-rose-500/[0.06] border border-rose-500/20 rounded-xl p-3">
          <p className="text-rose-400 text-xs">{saveError}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-white/[0.06]">
        <Button variant="ghost" onClick={onClose} className="flex-1 justify-center" disabled={isPending}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave} isLoading={isPending} className="flex-1 justify-center">
          {role ? 'Update Role' : 'Create Role'}
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// PERMISSIONS CATALOG PANEL
// ============================================================================

interface PermCatalogProps {
  permissions: SystemPermission[];
}

function PermissionsCatalog({ permissions }: PermCatalogProps): React.ReactElement {
  const grouped = permissions.reduce<Record<string, SystemPermission[]>>((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {});

  return (
    <Card className="p-5">
      <SectionHeader
        icon={
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        }
        title="System Permissions Catalog"
        subtitle={`${permissions.length} total permissions across ${Object.keys(grouped).length} categories`}
        accentColor="sky"
      />

      <div className="space-y-4">
        {Object.entries(grouped).map(([category, perms]) => (
          <div key={category}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sky-400/70">{getCategoryIcon(category)}</span>
              <span className="text-white/40 text-[10px] uppercase tracking-widest font-mono">{category}</span>
              <span className="text-white/20 text-[10px] font-mono ml-auto">{perms.length}</span>
            </div>
            <div className="grid grid-cols-1 gap-1 pl-5">
              {perms.map((perm) => (
                <div key={perm.id} className="flex items-start gap-2 py-1">
                  <div className="w-1 h-1 rounded-full bg-white/20 mt-1.5 flex-shrink-0" />
                  <div>
                    <span className="text-white/55 text-xs font-mono">{perm.permission_name}</span>
                    {perm.description && (
                      <p className="text-white/25 text-[10px] mt-0.5">{perm.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ============================================================================
// MAIN: ROLE CONFIGURATOR
// ============================================================================

export function RoleConfigurator({ roles, permissions }: RoleConfiguratorProps): React.ReactElement {
  const { isSuperAdmin, isLoading: permLoading } = usePermissions();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleWithPermissions | undefined>(undefined);
  const [showCatalog, setShowCatalog] = useState(false);

  const openCreate = (): void => {
    setEditingRole(undefined);
    setIsModalOpen(true);
  };

  const openEdit = (role: RoleWithPermissions): void => {
    setEditingRole(role);
    setIsModalOpen(true);
  };

  const handleDelete = async (roleId: string): Promise<void> => {
    await deleteRoleAction(roleId);
  };

  return (
    <div className="space-y-5">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold text-base">Custom Role Engine</h2>
          <p className="text-white/35 text-xs mt-0.5">{roles.length} roles configured for this institution</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowCatalog((v) => !v)}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            {showCatalog ? 'Hide' : 'View'} Catalog
          </Button>
          {(isSuperAdmin || !permLoading) && (
            <Button variant="primary" size="sm" onClick={openCreate} disabled={permLoading && !isSuperAdmin}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Role
            </Button>
          )}
        </div>
      </div>

      {/* Two-column layout when catalog is open */}
      <div className={`grid gap-5 ${showCatalog ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
        {/* Roles Grid */}
        <div>
          {roles.length === 0 ? (
            <Card className="p-5">
              <EmptyState
                icon={
                  <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                }
                title="No custom roles yet"
                description="Create your first role to begin defining permission boundaries for your staff."
                action={
                  isSuperAdmin && (
                    <Button variant="primary" size="sm" onClick={openCreate}>
                      Create First Role
                    </Button>
                  )
                }
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {roles.map((role) => (
                <RoleCard
                  key={role.id}
                  role={role}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  canManage={isSuperAdmin}
                />
              ))}
            </div>
          )}
        </div>

        {/* Permissions Catalog */}
        {showCatalog && <PermissionsCatalog permissions={permissions} />}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingRole ? `Edit Role: ${editingRole.role_name}` : 'Create Custom Role'}
        width="max-w-2xl"
      >
        <RoleForm
          role={editingRole}
          permissions={permissions}
          onClose={() => setIsModalOpen(false)}
          onSaved={() => setIsModalOpen(false)}
        />
      </Modal>
    </div>
  );
}