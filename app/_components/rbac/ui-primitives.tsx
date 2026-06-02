'use client';

import React from 'react';
import type { TeacherStatus } from '@/lib/data/rbac-fetcher';

// ============================================================================
// AMBIENT GLOW
// ============================================================================

export function AmbientGlow(): React.ReactElement {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
      <div className="absolute -top-60 left-1/4 w-[700px] h-[700px] rounded-full bg-amber-500/[0.04] blur-[140px]" />
      <div className="absolute top-1/2 right-0 w-96 h-96 rounded-full bg-emerald-500/[0.04] blur-[120px]" />
      <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-sky-500/[0.04] blur-[100px]" />
    </div>
  );
}

// ============================================================================
// BADGE
// ============================================================================

export type BadgeVariant = 'amber' | 'emerald' | 'rose' | 'sky' | 'slate' | 'purple';

interface BadgeProps {
  variant:    BadgeVariant;
  children:   React.ReactNode;
  className?: string;
}

const badgeStyles: Record<BadgeVariant, string> = {
  amber:  'bg-amber-400/10 text-amber-400 border border-amber-400/20',
  emerald:'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  rose:   'bg-rose-500/10 text-rose-400 border border-rose-500/20',
  sky:    'bg-sky-500/10 text-sky-400 border border-sky-500/20',
  slate:  'bg-white/[0.06] text-white/50 border border-white/[0.08]',
  purple: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
};

export function Badge({ variant, children, className = '' }: BadgeProps): React.ReactElement {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium tracking-wide ${badgeStyles[variant]} ${className}`}>
      {children}
    </span>
  );
}

// ============================================================================
// STATUS BADGE
// Handles all teacher statuses from the existing teachers table:
//   active | on_leave | transferred | terminated | resigned | deceased | retired | suspended
// ============================================================================

const statusBadgeMap: Record<TeacherStatus, { variant: BadgeVariant; label: string }> = {
  active:      { variant: 'emerald', label: 'Active'      },
  on_leave:    { variant: 'amber',   label: 'On Leave'    },
  transferred: { variant: 'rose',    label: 'Transferred' },
  terminated:  { variant: 'rose',    label: 'Terminated'  },
  resigned:    { variant: 'slate',   label: 'Resigned'    },
  deceased:    { variant: 'slate',   label: 'Deceased'    },
  retired:     { variant: 'sky',     label: 'Retired'     },
};

interface StatusBadgeProps {
  status: TeacherStatus;
}

export function StatusBadge({ status }: StatusBadgeProps): React.ReactElement {
  const config = statusBadgeMap[status] ?? { variant: 'slate' as BadgeVariant, label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

// ============================================================================
// PERMISSION CATEGORY ICON
// Categories are now domain names from permission_catalog.domain:
//   finance | academics | people | comms | security | system | knec
// ============================================================================

const domainIcons: Record<string, React.ReactElement> = {
  finance: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  academics: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  people: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  comms: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  security: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  system: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  knec: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
};

const fallbackIcon = (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
  </svg>
);

export function getCategoryIcon(category: string): React.ReactElement {
  return domainIcons[category.toLowerCase()] ?? fallbackIcon;
}

// ============================================================================
// SKELETON
// ============================================================================

export function Skeleton({ className = '' }: { className?: string }): React.ReactElement {
  return <div className={`animate-pulse rounded-lg bg-white/[0.04] ${className}`} />;
}

export function TableSkeleton({ rows = 5 }: { rows?: number }): React.ReactElement {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

// ============================================================================
// EMPTY STATE
// ============================================================================

interface EmptyStateProps {
  icon:        React.ReactNode;
  title:       string;
  description: string;
  action?:     React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="mb-4 text-white/20">{icon}</div>
      <h3 className="text-white/60 font-medium text-sm mb-1">{title}</h3>
      <p className="text-white/30 text-xs max-w-xs mb-4">{description}</p>
      {action}
    </div>
  );
}

// ============================================================================
// CARD
// ============================================================================

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }): React.ReactElement {
  return (
    <div className={`bg-white/[0.03] border border-white/[0.07] rounded-2xl ${className}`}>
      {children}
    </div>
  );
}

// ============================================================================
// SECTION HEADER
// ============================================================================

interface SectionHeaderProps {
  icon:          React.ReactNode;
  title:         string;
  subtitle?:     string;
  accentColor?:  'amber' | 'emerald' | 'rose' | 'sky';
  action?:       React.ReactNode;
}

const accentMap: Record<string, string> = {
  amber:   'text-amber-400',
  emerald: 'text-emerald-400',
  rose:    'text-rose-400',
  sky:     'text-sky-400',
};

export function SectionHeader({ icon, title, subtitle, accentColor = 'amber', action }: SectionHeaderProps): React.ReactElement {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <span className={accentMap[accentColor]}>{icon}</span>
        <div>
          <h2 className="text-white font-semibold text-base leading-tight">{title}</h2>
          {subtitle && <p className="text-white/35 text-xs mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// ============================================================================
// MODAL
// ============================================================================

interface ModalProps {
  isOpen:    boolean;
  onClose:   () => void;
  title:     string;
  children:  React.ReactNode;
  width?:    string;
}

export function Modal({ isOpen, onClose, title, children, width = 'max-w-xl' }: ModalProps): React.ReactElement | null {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className={`relative w-full ${width} bg-[#0e1220] border border-white/[0.09] rounded-2xl shadow-2xl`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07]">
          <h3 className="text-white font-semibold text-sm">{title}</h3>
          <button aria-label="Close"   onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-4 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// ============================================================================
// SLIDE-OVER
// ============================================================================

interface SlideOverProps {
  isOpen:    boolean;
  onClose:   () => void;
  title:     string;
  subtitle?: string;
  children:  React.ReactNode;
}

export function SlideOver({ isOpen, onClose, title, subtitle, children }: SlideOverProps): React.ReactElement {
  return (
    <>
      {isOpen && <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />}
      <div className={`fixed right-0 top-0 h-full z-50 w-full max-w-lg bg-[#0e1220] border-l border-white/[0.08] shadow-2xl transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07] flex-shrink-0">
          <div>
            <h3 className="text-white font-semibold text-sm">{title}</h3>
            {subtitle && <p className="text-white/35 text-xs mt-0.5">{subtitle}</p>}
          </div>
          <button aria-label="Close" onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors p-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </>
  );
}

// ============================================================================
// FORM FIELD
// ============================================================================

export function FormField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="space-y-1.5">
      <label className="block text-white/60 text-xs font-medium tracking-wide uppercase">{label}</label>
      {children}
      {hint && <p className="text-white/25 text-xs">{hint}</p>}
    </div>
  );
}

// ============================================================================
// TEXT INPUT
// ============================================================================

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> { error?: string; }

export function TextInput({ error, className = '', ...props }: TextInputProps): React.ReactElement {
  return (
    <div>
      <input {...props} className={`w-full bg-white/[0.04] border ${error ? 'border-rose-500/50' : 'border-white/[0.08]'} rounded-xl px-3.5 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-amber-400/40 focus:ring-1 focus:ring-amber-400/20 transition-colors ${className}`} />
      {error && <p className="mt-1 text-rose-400 text-xs">{error}</p>}
    </div>
  );
}

// ============================================================================
// TEXTAREA
// ============================================================================

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> { error?: string; }

export function TextArea({ error, className = '', ...props }: TextAreaProps): React.ReactElement {
  return (
    <div>
      <textarea {...props} className={`w-full bg-white/[0.04] border ${error ? 'border-rose-500/50' : 'border-white/[0.08]'} rounded-xl px-3.5 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-amber-400/40 focus:ring-1 focus:ring-amber-400/20 transition-colors resize-none ${className}`} />
      {error && <p className="mt-1 text-rose-400 text-xs">{error}</p>}
    </div>
  );
}

// ============================================================================
// BUTTON
// ============================================================================

type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'success';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:   ButtonVariant;
  isLoading?: boolean;
  size?:      'sm' | 'md';
}

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-amber-400/15 text-amber-400 border border-amber-400/25 hover:bg-amber-400/20 hover:border-amber-400/40',
  ghost:   'bg-white/[0.04] text-white/60 border border-white/[0.08] hover:bg-white/[0.07] hover:text-white/80',
  danger:  'bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20',
  success: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20',
};

const sizeStyles: Record<'sm' | 'md', string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
};

export function Button({ variant = 'primary', isLoading = false, size = 'md', children, className = '', disabled, ...props }: ButtonProps): React.ReactElement {
  return (
    <button {...props} disabled={disabled || isLoading} className={`inline-flex items-center gap-2 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${buttonVariants[variant]} ${sizeStyles[size]} ${className}`}>
      {isLoading && (
        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}

// ============================================================================
// CHECKBOX
// ============================================================================

interface CheckboxProps {
  checked:       boolean;
  onChange:      (checked: boolean) => void;
  label:         string;
  description?:  string;
  accentColor?:  'amber' | 'emerald' | 'rose';
}

const checkboxAccent: Record<string, string> = {
  amber:   'bg-amber-400 border-amber-400',
  emerald: 'bg-emerald-400 border-emerald-400',
  rose:    'bg-rose-400 border-rose-400',
};

export function Checkbox({ checked, onChange, label, description, accentColor = 'amber' }: CheckboxProps): React.ReactElement {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div className="flex-shrink-0 mt-0.5">
        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${checked ? checkboxAccent[accentColor] : 'border-white/20 bg-white/[0.04] group-hover:border-white/40'}`} onClick={() => onChange(!checked)}>
          {checked && (
            <svg className="w-2.5 h-2.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </div>
      <div onClick={() => onChange(!checked)}>
        <p className="text-white/70 text-sm font-medium leading-tight">{label}</p>
        {description && <p className="text-white/30 text-xs mt-0.5">{description}</p>}
      </div>
    </label>
  );
}

// ============================================================================
// STAT CARD
// ============================================================================

interface StatCardProps {
  label:        string;
  value:        string | number;
  accentColor?: 'amber' | 'emerald' | 'rose' | 'sky';
  icon:         React.ReactNode;
}

const statAccentMap: Record<string, string> = {
  amber:   'text-amber-400 bg-amber-400/10',
  emerald: 'text-emerald-400 bg-emerald-500/10',
  rose:    'text-rose-400 bg-rose-500/10',
  sky:     'text-sky-400 bg-sky-500/10',
};

export function StatCard({ label, value, accentColor = 'amber', icon }: StatCardProps): React.ReactElement {
  return (
    <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4 flex items-center gap-4">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${statAccentMap[accentColor]}`}>
        {icon}
      </div>
      <div>
        <p className="text-white/35 text-xs font-medium">{label}</p>
        <p className="text-white font-semibold text-xl font-mono mt-0.5">{value}</p>
      </div>
    </div>
  );
}