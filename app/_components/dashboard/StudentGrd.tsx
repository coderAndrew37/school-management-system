import { Student } from "@/lib/types/dashboard";

interface StudentCardProps {
  student: Student;
}

function getGenderBadgeStyle(gender: Student["gender"]) {
  if (gender === "Male") return "bg-sky-400/10 text-sky-400 border-sky-400/20";
  if (gender === "Female")
    return "bg-rose-400/10 text-rose-400 border-rose-400/20";
  return "bg-white/5 text-white/40 border-white/10";
}

function formatDOB(dob: string): string {
  const date = new Date(dob);
  return date.toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function calcAge(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

// Deterministic avatar color from name
const avatarColors = [
  "from-amber-400 to-orange-500",
  "from-sky-400 to-blue-500",
  "from-emerald-400 to-teal-500",
  "from-rose-400 to-pink-500",
  "from-violet-400 to-purple-500",
  "from-cyan-400 to-blue-400",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length]!;
}

function StudentCard({ student }: StudentCardProps) {
  const initials = getInitials(student.full_name);
  const avatarColor = getAvatarColor(student.full_name);

  return (
    <div className="group rounded-2xl border border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.13] transition-all duration-300 p-5 flex flex-col gap-4">
      {/* Top: avatar + name */}
      <div className="flex items-center gap-3">
        <div
          className={`flex-shrink-0 h-11 w-11 rounded-xl bg-gradient-to-br ${avatarColor} flex items-center justify-center text-sm font-bold text-white shadow-lg`}
        >
          {initials}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-white text-sm leading-tight truncate">
            {student.full_name}
          </p>
          <p className="text-xs text-amber-400/80 font-mono mt-0.5">
            {student.readable_id ?? "ID pending…"}
          </p>
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-white/[0.04] px-3 py-2">
          <p className="text-white/35 uppercase tracking-wider text-[10px] font-semibold mb-0.5">
            Grade
          </p>
          <p className="text-white font-medium truncate">
            {student.current_grade}
          </p>
        </div>
        <div className="rounded-lg bg-white/[0.04] px-3 py-2">
          <p className="text-white/35 uppercase tracking-wider text-[10px] font-semibold mb-0.5">
            Age
          </p>
          <p className="text-white font-medium">
            {calcAge(student.date_of_birth)} yrs
          </p>
        </div>
        <div className="rounded-lg bg-white/[0.04] px-3 py-2">
          <p className="text-white/35 uppercase tracking-wider text-[10px] font-semibold mb-0.5">
            DOB
          </p>
          <p className="text-white font-medium">
            {formatDOB(student.date_of_birth)}
          </p>
        </div>
        <div className="rounded-lg bg-white/[0.04] px-3 py-2 flex flex-col justify-between">
          <p className="text-white/35 uppercase tracking-wider text-[10px] font-semibold mb-0.5">
            Gender
          </p>
          <span
            className={`inline-block w-fit rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${getGenderBadgeStyle(student.gender)}`}
          >
            {student.gender ?? "N/A"}
          </span>
        </div>
      </div>

      {/* Parent info */}
      {student.parents && (
        <div className="border-t border-white/[0.06] pt-3 flex items-center gap-2">
          <span className="text-white/25 text-xs">👤</span>
          <div className="min-w-0">
            <p className="text-[11px] text-white/50 truncate">
              {student.parents.full_name !== "To be updated"
                ? student.parents.full_name
                : "Parent"}{" "}
              ·{" "}
              <span className="font-mono">{student.parents.phone_number}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

interface StudentGridProps {
  students: Student[];
}

export function StudentGrid({ students }: StudentGridProps) {
  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-5xl mb-4">🎒</p>
        <p className="text-white/50 font-medium">No students admitted yet</p>
        <p className="text-white/25 text-sm mt-1">
          Use the admission form to add the first student.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {students.map((student) => (
        <StudentCard key={student.id} student={student} />
      ))}
    </div>
  );
}
