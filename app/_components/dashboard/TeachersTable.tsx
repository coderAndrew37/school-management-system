import { Teacher } from "@/lib/types/dashboard";

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

interface TeachersTableProps {
  teachers: Teacher[];
}

export function TeachersTable({ teachers }: TeachersTableProps) {
  if (teachers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-5xl mb-4">📋</p>
        <p className="text-white/50 font-medium">No teachers on record</p>
        <p className="text-white/25 text-sm mt-1">
          Teacher records will appear here once added.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-white/[0.07]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.07] bg-white/[0.03]">
            <th className="text-left px-5 py-3.5 text-[10px] font-semibold uppercase tracking-widest text-white/35">
              Teacher
            </th>
            <th className="text-left px-5 py-3.5 text-[10px] font-semibold uppercase tracking-widest text-white/35">
              TSC Number
            </th>
            <th className="text-left px-5 py-3.5 text-[10px] font-semibold uppercase tracking-widest text-white/35 hidden md:table-cell">
              Email
            </th>
            <th className="text-left px-5 py-3.5 text-[10px] font-semibold uppercase tracking-widest text-white/35 hidden lg:table-cell">
              Phone
            </th>
            <th className="text-left px-5 py-3.5 text-[10px] font-semibold uppercase tracking-widest text-white/35 hidden xl:table-cell">
              Joined
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {teachers.map((teacher) => (
            <tr
              key={teacher.id}
              className="group hover:bg-white/[0.04] transition-colors duration-150"
            >
              {/* Name + initials avatar */}
              <td className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center text-[10px] font-bold text-emerald-400">
                    {getInitials(teacher.full_name)}
                  </div>
                  <span className="font-medium text-white">
                    {teacher.full_name}
                  </span>
                </div>
              </td>

              {/* TSC Number */}
              <td className="px-5 py-4">
                {teacher.tsc_number ? (
                  <span className="font-mono text-xs bg-amber-400/10 text-amber-400 border border-amber-400/20 rounded-md px-2 py-1">
                    {teacher.tsc_number}
                  </span>
                ) : (
                  <span className="text-white/25 text-xs italic">Not set</span>
                )}
              </td>

              {/* Email */}
              <td className="px-5 py-4 hidden md:table-cell">
                <a
                  href={`mailto:${teacher.email}`}
                  className="text-white/60 hover:text-sky-400 transition-colors duration-150 text-xs"
                >
                  {teacher.email}
                </a>
              </td>

              {/* Phone */}
              <td className="px-5 py-4 hidden lg:table-cell">
                {teacher.phone_number ? (
                  <span className="font-mono text-xs text-white/60">
                    {teacher.phone_number}
                  </span>
                ) : (
                  <span className="text-white/25 text-xs italic">—</span>
                )}
              </td>

              {/* Joined date */}
              <td className="px-5 py-4 hidden xl:table-cell">
                <span className="text-xs text-white/35">
                  {formatDate(teacher.created_at)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
