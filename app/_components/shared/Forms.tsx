import React from "react";

// ============================================================================
// KBUTTON COMPONENT
// ============================================================================

interface KButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost";
}

export const KButton = ({
  children,
  variant = "primary",
  className = "",
  ...props
}: KButtonProps) => {
  const styles = {
    primary:
      "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/10",
    ghost:
      "bg-transparent hover:bg-white/5 text-slate-400 hover:text-white border border-transparent",
  };

  return (
    <button
      {...props}
      className={`px-4 py-2 rounded-xl font-medium transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

// ============================================================================
// KINPUT COMPONENT
// ============================================================================

interface KInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const KInput = ({ label, error, className = "", ...props }: KInputProps) => (
  <div className="space-y-1.5 w-full">
    {label && (
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
        {label}
      </label>
    )}
    <input
      {...props}
      className={`w-full bg-[#1A1A1C] border ${
        error ? "border-rose-500/50" : "border-white/10"
      } focus:border-emerald-500/50 rounded-xl px-4 py-2.5 text-sm text-white outline-none transition-all placeholder:text-slate-600 ${className}`}
    />
    {error && <p className="text-[10px] text-rose-500 ml-1">{error}</p>}
  </div>
);