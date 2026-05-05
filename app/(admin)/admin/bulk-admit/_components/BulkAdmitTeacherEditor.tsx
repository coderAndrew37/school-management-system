"use client";

import { useState } from "react";
import { Plus, Trash2, UserCheck, Save, ClipboardList } from "lucide-react";
import type { BulkTeacherRow } from "@/lib/actions/bulk-teacher";

interface Props {
  isPending: boolean;
  onSubmit: (rows: BulkTeacherRow[]) => void;
}

export function BulkAdmitTeacherEditor({ isPending, onSubmit }: Props) {
  const [rows, setRows] = useState<BulkTeacherRow[]>([
    { fullName: "", email: "", phone: "", tscNumber: "" },
  ]);

  const addRow = () => {
    setRows(prev => [...prev, { fullName: "", email: "", phone: "", tscNumber: "" }]);
  };

  const removeRow = (index: number) => {
    setRows(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, field: keyof BulkTeacherRow, value: string) => {
    setRows(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
  };

  return (
    <div className="relative space-y-6">
      {/* Staff Ambient Glow (Emerald) */}
      <div className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full bg-emerald-500/[0.03] blur-[100px] -z-10" />
      
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/10 border border-emerald-400/20">
            <UserCheck className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Staff Batch Entry 
              <span className="text-emerald-400 font-mono text-sm">({rows.length})</span>
            </h2>
            <p className="text-xs text-white/35 mt-0.5">Registering new teaching staff for Kibali Academy</p>
          </div>
        </div>
        
        <button 
          onClick={addRow} 
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-white/70 hover:text-emerald-400 hover:border-emerald-400/30 transition-all text-xs font-bold uppercase tracking-wider"
        >
          <Plus className="h-4 w-4" /> Add Teacher
        </button>
      </div>

      {/* Table Container */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr className="border-b border-white/[0.07] bg-white/[0.03]">
                <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-white/30 w-12">#</th>
                <th className="px-4 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-white/30">Personal Details</th>
                <th className="px-4 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-white/30">Contact Information</th>
                <th className="px-4 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-white/30">Professional ID</th>
                <th className="w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {rows.map((row, i) => (
                <tr key={i} className="group hover:bg-white/[0.01] transition-colors">
                  <td className="px-6 py-4 text-white/20 font-mono text-xs">{i + 1}</td>
                  
                  {/* Full Name */}
                  <td className="px-4 py-4">
                    <input
                      type="text"
                      placeholder="Full Name"
                      value={row.fullName}
                      onChange={(e) => updateRow(i, "fullName", e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-400/40 transition-colors"
                    />
                  </td>

                  {/* Email & Phone */}
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-2">
                      <input
                        type="email"
                        placeholder="Email Address"
                        value={row.email}
                        onChange={(e) => updateRow(i, "email", e.target.value)}
                        className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/70 focus:outline-none focus:border-emerald-400/30"
                      />
                      <input
                        type="tel"
                        placeholder="Phone Number"
                        value={row.phone}
                        onChange={(e) => updateRow(i, "phone", e.target.value)}
                        className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/70 focus:outline-none focus:border-emerald-400/30"
                      />
                    </div>
                  </td>

                  {/* TSC Number */}
                  <td className="px-4 py-4">
                    <div className="relative group/input">
                      <ClipboardList className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/20 group-focus-within/input:text-emerald-400/50" />
                      <input
                        type="text"
                        placeholder="TSC/XXXXX"
                        value={row.tscNumber || ""}
                        onChange={(e) => updateRow(i, "tscNumber", e.target.value)}
                        className="w-full bg-white/[0.03] border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-400/40 transition-colors"
                      />
                    </div>
                  </td>

                  {/* Remove Action */}
                  <td className="px-6 py-4 text-right">
                    <button
                      aria-label="remove row"
                      onClick={() => removeRow(i)}
                      className="p-2 rounded-lg text-white/10 hover:text-rose-400 hover:bg-rose-400/10 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Action Footer */}
        <div className="p-6 bg-white/[0.03] border-t border-white/[0.07] flex items-center justify-between">
          <div className="flex items-center gap-2">
             <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
             <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">
               Ready for school deployment
             </p>
          </div>
          
          <button
            onClick={() => onSubmit(rows)}
            disabled={isPending}
            className="group flex items-center gap-2 bg-emerald-400 disabled:bg-white/10 text-[#0c0f1a] font-bold px-8 py-3 rounded-xl hover:bg-emerald-300 active:scale-95 transition-all shadow-lg shadow-emerald-400/10 disabled:text-white/20"
          >
            <Save className="h-4 w-4" />
            {isPending ? "Processing..." : "Register Staff"}
          </button>
        </div>
      </div>
    </div>
  );
}