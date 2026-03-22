// app/teacher/class/attendance/ContactPopover.tsx

import type { ParentContact } from "./attendance-types";
import { Mail, MessageSquare, Phone } from "lucide-react";

interface Props {
  studentName: string;
  grade: string;
  parents: ParentContact[];
  onClose: () => void;
}

export function ContactPopover({
  studentName,
  grade,
  parents,
  onClose,
}: Props) {
  return (
    <div className="absolute right-0 top-full mt-1 z-50 w-72 rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
        <p className="text-xs font-black text-slate-700">Contact Parent</p>
        <p className="text-[10px] text-slate-400">
          {studentName} · {grade}
        </p>
      </div>

      {parents.length === 0 ? (
        <div className="px-4 py-6 text-center space-y-1">
          <p className="text-xs text-slate-500 font-semibold">
            No parent contacts on file.
          </p>
          <p className="text-[10px] text-slate-400">
            Add parents via Admin → Students → this student&apos;s record.
          </p>
        </div>
      ) : (
        <div className="p-3 space-y-3 max-h-72 overflow-y-auto">
          {parents.map((p, i) => (
            <div
              key={i}
              className="rounded-xl border border-slate-100 p-3 space-y-2.5"
            >
              <div>
                <p className="text-xs font-bold text-slate-800">
                  {p.full_name}
                </p>
                {p.email && (
                  <p className="text-[10px] text-slate-400 truncate">
                    {p.email}
                  </p>
                )}
                {p.phone_number && (
                  <p className="text-[10px] text-slate-400 font-mono">
                    {p.phone_number}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {p.phone_number && (
                  <a
                    href={`tel:${p.phone_number}`}
                    className="flex flex-col items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 py-2 hover:bg-emerald-100 transition-colors"
                  >
                    <Phone className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-[9px] font-bold text-emerald-700">
                      Call
                    </span>
                  </a>
                )}
                {p.phone_number && (
                  <a
                    href={`sms:${p.phone_number}?body=${encodeURIComponent(`Dear Parent, this is a follow-up regarding ${studentName}'s attendance at Kibali Academy. Please contact us at your earliest convenience. Thank you.`)}`}
                    className="flex flex-col items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 py-2 hover:bg-sky-100 transition-colors"
                  >
                    <MessageSquare className="h-3.5 w-3.5 text-sky-600" />
                    <span className="text-[9px] font-bold text-sky-700">
                      SMS
                    </span>
                  </a>
                )}
                {p.email && (
                  <a
                    href={`mailto:${p.email}?subject=${encodeURIComponent(`Attendance Follow-up — ${studentName}`)}&body=${encodeURIComponent(`Dear ${p.full_name},\n\nWe are writing regarding ${studentName}'s attendance in ${grade}. We would appreciate your assistance in ensuring regular attendance.\n\nPlease contact the school office if you have any concerns.\n\nKind regards,\nKibali Academy`)}`}
                    className="flex flex-col items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 py-2 hover:bg-violet-100 transition-colors"
                  >
                    <Mail className="h-3.5 w-3.5 text-violet-600" />
                    <span className="text-[9px] font-bold text-violet-700">
                      Email
                    </span>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="px-4 pb-3 pt-1 border-t border-slate-100">
        <button
          onClick={onClose}
          className="w-full text-[10px] text-slate-400 hover:text-slate-600 py-1 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
