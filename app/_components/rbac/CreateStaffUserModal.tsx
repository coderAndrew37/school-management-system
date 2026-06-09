'use client';

// @/app/_components/rbac/CreateStaffUserModal.tsx
//
// Full staff provisioning workflow with:
//   • Step-by-step assignment flow (3 stages: identity → role → review)
//   • Teacher / non-teaching admin toggle
//   • Role assignment with live permission preview
//   • Confirmation stage with explicit rollback warning
//   • Real-time error surface with per-step rollback indicators

import React, { useCallback, useMemo, useState, useTransition } from 'react';
import type { RoleWithPermissions, SystemPermission } from '@/lib/data/rbac-fetcher';
import type { BaseRole } from '@/lib/types/auth';
import { createStaffUserAction } from '@/lib/actions/role-management';
import {
  Badge,
  Button,
  FormField,
  Modal,
  TextInput,
} from './ui-primitives';

// ============================================================================
// TYPES
// ============================================================================

interface CreateStaffUserModalProps {
  isOpen:      boolean;
  onClose:     () => void;
  onCreated:   () => void;
  roles:       RoleWithPermissions[];
  permissions: SystemPermission[];
}

type WizardStep = 'identity' | 'role' | 'review';

interface IdentityForm {
  full_name:    string;
  email:        string;
  phone_number: string;
  is_teacher:   boolean;   // teacher vs non-teaching admin
}

interface RoleForm {
  base_role:  BaseRole;
  admin_role: string | null;
}

interface FormErrors {
  full_name?:    string;
  email?:        string;
  phone_number?: string;
  base_role?:    string;
  admin_role?:   string;
}

// ============================================================================
// STEP INDICATOR
// ============================================================================

interface StepDotProps {
  step:    WizardStep;
  current: WizardStep;
  label:   string;
  index:   number;
}

const STEP_ORDER: WizardStep[] = ['identity', 'role', 'review'];

function StepDot({ step, current, label, index }: StepDotProps): React.ReactElement {
  const currentIndex = STEP_ORDER.indexOf(current);
  const thisIndex    = STEP_ORDER.indexOf(step);
  const isDone       = thisIndex < currentIndex;
  const isActive     = step === current;

  return (
    <div className="flex flex-col items-center gap-1.5 flex-1">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-semibold transition-all border ${
        isDone
          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
          : isActive
            ? 'bg-amber-400/15 border-amber-400/30 text-amber-400'
            : 'bg-white/[0.04] border-white/[0.08] text-white/25'
      }`}>
        {isDone
          ? <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
          : index + 1
        }
      </div>
      <span className={`text-[10px] font-medium tracking-wide ${isActive ? 'text-white/60' : isDone ? 'text-emerald-400/60' : 'text-white/20'}`}>
        {label}
      </span>
    </div>
  );
}

// ============================================================================
// ROLE SELECTOR — shows permission preview inline
// ============================================================================

interface RoleSelectorProps {
  roles:         RoleWithPermissions[];
  selectedRoleId: string | null;
  onSelect:       (id: string) => void;
}

function RoleSelector({ roles, selectedRoleId, onSelect }: RoleSelectorProps): React.ReactElement {
  if (roles.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-8 text-center">
        <p className="text-white/30 text-xs">No role definitions configured yet.</p>
        <p className="text-white/20 text-[10px] mt-1">Create roles in the Role Configurator first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {roles.map((role) => {
        const isSelected = selectedRoleId === role.id;
        const domains    = [...new Set(role.permissions.map((p) => p.category))];

        return (
          <button
            key={role.id}
            onClick={() => onSelect(role.id)}
            className={`w-full text-left rounded-xl border px-4 py-3.5 transition-all group ${
              isSelected
                ? 'bg-amber-400/[0.07] border-amber-400/25'
                : 'bg-white/[0.02] border-white/[0.07] hover:border-white/[0.12] hover:bg-white/[0.04]'
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Radio indicator */}
              <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                isSelected ? 'border-amber-400 bg-amber-400/20' : 'border-white/20'
              }`}>
                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm font-medium ${isSelected ? 'text-amber-400' : 'text-white/70'}`}>
                    {role.role_name}
                  </span>
                  <Badge variant="amber">{role.permissions.length} permissions</Badge>
                </div>

                {role.description && (
                  <p className="text-white/30 text-xs mt-1">{role.description}</p>
                )}

                {/* Domain chips */}
                {domains.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {domains.slice(0, 4).map((d) => (
                      <span key={d} className="text-[10px] text-white/30 bg-white/[0.03] border border-white/[0.05] px-1.5 py-0.5 rounded font-mono capitalize">
                        {d}
                      </span>
                    ))}
                    {domains.length > 4 && (
                      <span className="text-[10px] text-white/20 px-1">+{domains.length - 4}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// REVIEW PANEL — what will be created
// ============================================================================

interface ReviewPanelProps {
  identity:    IdentityForm;
  roleForm:    RoleForm;
  selectedRole: RoleWithPermissions | null;
}

function ReviewPanel({ identity, roleForm, selectedRole }: ReviewPanelProps): React.ReactElement {
  return (
    <div className="space-y-4">
      {/* Rollback warning */}
      <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-4 py-3.5">
        <div className="flex gap-3">
          <svg className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-amber-400 text-xs font-semibold">Before you confirm</p>
            <p className="text-amber-400/70 text-[11px] mt-0.5 leading-relaxed">
              This will create an auth account, a teachers directory entry, and a profile record.
              If any step fails, all three are automatically rolled back — no orphan records will be left.
            </p>
          </div>
        </div>
      </div>

      {/* Identity summary */}
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] divide-y divide-white/[0.05]">
        <div className="px-4 py-2.5 flex items-center justify-between">
          <span className="text-white/35 text-xs font-mono uppercase tracking-wider">Identity</span>
        </div>
        {[
          { label: 'Name',   value: identity.full_name },
          { label: 'Email',  value: identity.email },
          { label: 'Phone',  value: identity.phone_number || '—' },
          { label: 'Type',   value: identity.is_teacher ? 'Teaching staff' : 'Non-teaching admin' },
        ].map(({ label, value }) => (
          <div key={label} className="px-4 py-2.5 flex items-center justify-between gap-4">
            <span className="text-white/35 text-xs">{label}</span>
            <span className="text-white/70 text-xs font-medium text-right truncate max-w-[200px]">{value}</span>
          </div>
        ))}
      </div>

      {/* Role summary */}
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] divide-y divide-white/[0.05]">
        <div className="px-4 py-2.5 flex items-center justify-between">
          <span className="text-white/35 text-xs font-mono uppercase tracking-wider">Access</span>
        </div>
        <div className="px-4 py-2.5 flex items-center justify-between gap-4">
          <span className="text-white/35 text-xs">System role</span>
          <Badge variant="amber">{roleForm.base_role}</Badge>
        </div>
        {selectedRole && (
          <>
            <div className="px-4 py-2.5 flex items-center justify-between gap-4">
              <span className="text-white/35 text-xs">Admin title</span>
              <span className="text-white/70 text-xs font-medium">{selectedRole.role_name}</span>
            </div>
            <div className="px-4 py-2.5 flex items-start gap-4">
              <span className="text-white/35 text-xs mt-0.5 flex-shrink-0">Permissions</span>
              <div className="flex flex-wrap gap-1 justify-end">
                {selectedRole.permissions.slice(0, 6).map((p) => (
                  <span key={p.permission_id} className="text-[10px] text-white/35 bg-white/[0.03] border border-white/[0.05] px-1.5 py-0.5 rounded font-mono">
                    {p.permission_name}
                  </span>
                ))}
                {selectedRole.permissions.length > 6 && (
                  <span className="text-[10px] text-white/20">+{selectedRole.permissions.length - 6} more</span>
                )}
              </div>
            </div>
          </>
        )}
        {!selectedRole && roleForm.base_role !== 'admin' && (
          <div className="px-4 py-2.5">
            <span className="text-white/25 text-xs italic">No admin title assigned</span>
          </div>
        )}
      </div>

      {/* What will happen */}
      <div className="space-y-1.5">
        <p className="text-white/30 text-[10px] uppercase tracking-wider font-mono px-0.5">
          Provisioning steps
        </p>
        {[
          { icon: '①', label: 'Create teachers directory entry',      detail: 'teachers table anchor row' },
          { icon: '②', label: 'Create auth account',                   detail: 'temp password + email confirm' },
          { icon: '③', label: 'Bind profile with teacher_id pointer',  detail: 'profiles table update' },
        ].map(({ icon, label, detail }) => (
          <div key={icon} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
            <span className="text-white/20 text-xs font-mono">{icon}</span>
            <div>
              <p className="text-white/55 text-xs font-medium">{label}</p>
              <p className="text-white/25 text-[10px]">{detail}</p>
            </div>
          </div>
        ))}
        <div className="flex items-start gap-3 px-3 py-2 rounded-lg bg-rose-500/[0.04] border border-rose-500/10">
          <svg className="w-3 h-3 text-rose-400/60 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <p className="text-rose-400/60 text-[10px]">
            On any failure: auth user deleted + teachers row deleted atomically.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN MODAL
// ============================================================================

export function CreateStaffUserModal({
  isOpen,
  onClose,
  onCreated,
  roles,
}: CreateStaffUserModalProps): React.ReactElement {
  const [step,       setStep]       = useState<WizardStep>('identity');
  const [identity,   setIdentity]   = useState<IdentityForm>({
    full_name: '', email: '', phone_number: '', is_teacher: true,
  });
  const [roleForm,   setRoleForm]   = useState<RoleForm>({
    base_role: 'staff', admin_role: null,
  });
  const [errors,     setErrors]     = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending,  startTransition] = useTransition();

  const adminRoles = useMemo(
    () => roles.filter((r) => r.id !== 'super_admin'),
    [roles]
  );

  const selectedRole = useMemo(
    () => adminRoles.find((r) => r.id === roleForm.admin_role) ?? null,
    [adminRoles, roleForm.admin_role]
  );

  const resetAndClose = useCallback((): void => {
    setStep('identity');
    setIdentity({ full_name: '', email: '', phone_number: '', is_teacher: true });
    setRoleForm({ base_role: 'staff', admin_role: null });
    setErrors({});
    setSubmitError(null);
    onClose();
  }, [onClose]);

  // ── Validation ────────────────────────────────────────────────────────────

  const validateIdentity = (): boolean => {
    const e: FormErrors = {};
    if (!identity.full_name.trim()) e.full_name = 'Full name is required.';
    if (!identity.email.trim())     e.email     = 'Email address is required.';
    if (identity.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity.email)) {
      e.email = 'Enter a valid email address.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateRole = (): boolean => {
    const e: FormErrors = {};
    if (!roleForm.base_role) e.base_role = 'System role is required.';
    if (roleForm.base_role === 'admin' && !roleForm.admin_role) {
      e.admin_role = 'An administrative title is required for admin accounts.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Navigation ────────────────────────────────────────────────────────────

  const goNext = (): void => {
    setErrors({});
    if (step === 'identity' && validateIdentity()) setStep('role');
    if (step === 'role'     && validateRole())     setStep('review');
  };

  const goBack = (): void => {
    setSubmitError(null);
    if (step === 'role')   setStep('identity');
    if (step === 'review') setStep('role');
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = (): void => {
    setSubmitError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('full_name',    identity.full_name.trim());
      fd.set('email',        identity.email.trim());
      fd.set('phone_number', identity.phone_number.trim());
      fd.set('is_teacher',   String(identity.is_teacher));
      fd.set('base_role',    roleForm.base_role);
      if (roleForm.admin_role) fd.set('admin_role', roleForm.admin_role);

      const result = await createStaffUserAction(fd);

      if (result.success) {
        onCreated();
        resetAndClose();
      } else {
        setSubmitError(result.message);
      }
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Modal
      isOpen={isOpen}
      onClose={resetAndClose}
      title="Add Staff Member"
      width="max-w-lg"
    >
      <div className="space-y-5">

        {/* Step indicator */}
        <div className="flex items-start gap-0 relative">
          {/* Connector line */}
          <div className="absolute top-3.5 left-[calc(16.67%)] right-[calc(16.67%)] h-px bg-white/[0.07]" />
          {(
            [
              { step: 'identity', label: 'Identity'  },
              { step: 'role',     label: 'Role'       },
              { step: 'review',   label: 'Confirm'    },
            ] as { step: WizardStep; label: string }[]
          ).map(({ step: s, label }, i) => (
            <StepDot key={s} step={s} current={step} label={label} index={i} />
          ))}
        </div>

        <div className="h-px bg-white/[0.05]" />

        {/* ── Step 1: Identity ──────────────────────────────────────────── */}
        {step === 'identity' && (
          <div className="space-y-4">
            <FormField label="Full Name">
              <TextInput
                placeholder="e.g. Margaret Achieng"
                value={identity.full_name}
                onChange={(e) => {
                  setIdentity((p) => ({ ...p, full_name: e.target.value }));
                  setErrors((p) => ({ ...p, full_name: undefined }));
                }}
                error={errors.full_name}
              />
            </FormField>

            <FormField label="Email Address">
              <TextInput
                type="email"
                placeholder="e.g. m.achieng@school.ac.ke"
                value={identity.email}
                onChange={(e) => {
                  setIdentity((p) => ({ ...p, email: e.target.value }));
                  setErrors((p) => ({ ...p, email: undefined }));
                }}
                error={errors.email}
              />
            </FormField>

            <FormField label="Phone Number" hint="Optional — used for school-scoped uniqueness check">
              <TextInput
                type="tel"
                placeholder="e.g. +254 712 345 678"
                value={identity.phone_number}
                onChange={(e) => setIdentity((p) => ({ ...p, phone_number: e.target.value }))}
                error={errors.phone_number}
              />
            </FormField>

            {/* Teacher / non-teaching toggle */}
            <div>
              <p className="text-white/50 text-xs font-medium uppercase tracking-wide mb-2">Staff type</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    value: true,
                    label: 'Teaching staff',
                    detail: 'TSC-registered teacher',
                    icon: (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    ),
                  },
                  {
                    value: false,
                    label: 'Non-teaching',
                    detail: 'Admin or support role',
                    icon: (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    ),
                  },
                ].map(({ value, label, detail, icon }) => {
                  const isActive = identity.is_teacher === value;
                  return (
                    <button
                      key={String(value)}
                      onClick={() => setIdentity((p) => ({ ...p, is_teacher: value }))}
                      className={`flex items-start gap-3 px-3.5 py-3 rounded-xl border text-left transition-all ${
                        isActive
                          ? 'bg-amber-400/[0.07] border-amber-400/25'
                          : 'bg-white/[0.02] border-white/[0.07] hover:border-white/[0.12]'
                      }`}
                    >
                      <span className={`mt-0.5 ${isActive ? 'text-amber-400' : 'text-white/25'}`}>{icon}</span>
                      <div>
                        <p className={`text-xs font-medium ${isActive ? 'text-amber-400' : 'text-white/55'}`}>{label}</p>
                        <p className="text-white/25 text-[10px]">{detail}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Role ──────────────────────────────────────────────── */}
        {step === 'role' && (
          <div className="space-y-4">
            {/* System role selector */}
            <div>
              <p className="text-white/50 text-xs font-medium uppercase tracking-wide mb-2">System role</p>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { value: 'staff', label: 'Staff',     detail: 'Standard staff access' },
                    { value: 'admin', label: 'Admin',     detail: 'Requires admin title'  },
                    { value: 'parent', label: 'Parent',   detail: 'Guardian access only'  },
                  ] as { value: BaseRole; label: string; detail: string }[]
                ).map(({ value, label, detail }) => {
                  const isActive = roleForm.base_role === value;
                  return (
                    <button
                      key={value}
                      onClick={() => {
                        setRoleForm((p) => ({
                          ...p,
                          base_role:  value,
                          admin_role: value !== 'admin' ? null : p.admin_role,
                        }));
                        setErrors((p) => ({ ...p, base_role: undefined, admin_role: undefined }));
                      }}
                      className={`flex flex-col gap-0.5 px-3.5 py-3 rounded-xl border text-left transition-all ${
                        isActive
                          ? 'bg-amber-400/[0.07] border-amber-400/25'
                          : 'bg-white/[0.02] border-white/[0.07] hover:border-white/[0.12]'
                      }`}
                    >
                      <span className={`text-xs font-semibold font-mono ${isActive ? 'text-amber-400' : 'text-white/55'}`}>{label}</span>
                      <span className="text-white/25 text-[10px]">{detail}</span>
                    </button>
                  );
                })}
              </div>
              {errors.base_role && (
                <p className="text-rose-400 text-xs mt-1.5">{errors.base_role}</p>
              )}
            </div>

            {/* Admin title — only when base_role is admin */}
            {roleForm.base_role === 'admin' && (
              <div>
                <p className="text-white/50 text-xs font-medium uppercase tracking-wide mb-2">
                  Administrative title
                  <span className="text-rose-400 ml-1">*</span>
                </p>
                {errors.admin_role && (
                  <p className="text-rose-400 text-xs mb-2">{errors.admin_role}</p>
                )}
                <RoleSelector
                  roles={adminRoles}
                  selectedRoleId={roleForm.admin_role}
                  onSelect={(id) => {
                    setRoleForm((p) => ({ ...p, admin_role: id }));
                    setErrors((p) => ({ ...p, admin_role: undefined }));
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Review ───────────────────────────────────────────── */}
        {step === 'review' && (
          <ReviewPanel
            identity={identity}
            roleForm={roleForm}
            selectedRole={selectedRole}
          />
        )}

        {/* Submit error */}
        {submitError && (
          <div className="rounded-xl border border-rose-500/25 bg-rose-500/[0.06] px-4 py-3">
            <div className="flex gap-2.5">
              <svg className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-rose-400 text-xs font-semibold">Account creation failed</p>
                <p className="text-rose-400/70 text-[11px] mt-0.5">{submitError}</p>
                <p className="text-rose-400/50 text-[10px] mt-1">All partial records have been rolled back automatically.</p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-2 pt-1 border-t border-white/[0.06]">
          <Button
            variant="ghost"
            onClick={step === 'identity' ? resetAndClose : goBack}
            disabled={isPending}
            className="flex-shrink-0"
          >
            {step === 'identity' ? 'Cancel' : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </>
            )}
          </Button>

          <div className="flex-1" />

          {step !== 'review' ? (
            <Button variant="primary" onClick={goNext} disabled={isPending}>
              Continue
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={handleSubmit}
              isLoading={isPending}
              className="min-w-[140px] justify-center"
            >
              {isPending ? 'Provisioning…' : 'Create Account'}
            </Button>
          )}
        </div>

      </div>
    </Modal>
  );
}