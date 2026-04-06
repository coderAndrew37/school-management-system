import { StudentStatus, Student } from "@/lib/types/dashboard";

function calcAge(dob: string): number {
  const b = new Date(dob),
    n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  const m = n.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && n.getDate() < b.getDate())) a--;
  return a;
}

function fmt(dt: string) {
  return new Date(dt).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const GRADIENTS = [
  "from-amber-400 to-orange-500",
  "from-sky-400 to-blue-500",
  "from-emerald-400 to-teal-500",
  "from-rose-400 to-pink-500",
  "from-violet-400 to-purple-500",
  "from-cyan-400 to-blue-400",
];
function gradient(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return GRADIENTS[Math.abs(h) % GRADIENTS.length]!;
}

const STATUS_STYLES: Record<StudentStatus, string> = {
  active: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
  transferred: "bg-sky-400/10     text-sky-400     border-sky-400/20",
  graduated: "bg-amber-400/10   text-amber-400   border-amber-400/20",
  withdrawn: "bg-rose-400/10    text-rose-400    border-rose-400/20",
};

export type SortKey =
  | "full_name"
  | "readable_id"
  | "current_grade"
  | "date_of_birth"
  | "gender"
  | "created_at";
export type SortDir = "asc" | "desc";

// ── CSV/Excel export ──────────────────────────────────────────────────────────

export function exportToCSV(students: Student[], gradeLabel?: string) {
  const headers = [
    "ID",
    "Full Name",
    "Grade",
    "Gender",
    "Date of Birth",
    "Age",
    "UPI Number",
    "Status",
    "Parent Name",
    "Parent Phone",
    "Parent Email",
    "Admitted Date",
  ];

  const rows = students.map((s) => [
    s.readable_id ?? "",
    s.full_name,
    s.current_grade,
    s.gender ?? "",
    s.date_of_birth,
    String(calcAge(s.date_of_birth)),
    s.upi_number ?? "",
    s.status,
    s.parents?.full_name ?? "",
    s.parents?.phone_number ?? "",
    s.all_parents.find((p) => p.is_primary_contact)?.email ?? "",
    fmt(s.created_at),
  ]);

  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const slug = gradeLabel
    ? gradeLabel.replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-")
    : "all";
  a.download = `kibali-${slug}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Print class list ──────────────────────────────────────────────────────────

export function printClassList(students: Student[], grade: string) {
  const rows = students
    .filter((s) => s.current_grade === grade)
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  const male = rows.filter((s) => s.gender === "Male").length;
  const female = rows.filter((s) => s.gender === "Female").length;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${grade} — Class Register</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 24px; }
    h1 { font-size: 18px; font-weight: 800; margin-bottom: 2px; }
    .meta { font-size: 11px; color: #666; margin-bottom: 16px; }
    .stats { display: flex; gap: 24px; margin-bottom: 16px; padding: 10px 14px;
             background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; }
    .stat-label { font-size: 10px; text-transform: uppercase; color: #9ca3af; display: block; }
    .stat-value { font-size: 18px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #f3f4f6; padding: 7px 10px; text-align: left;
         font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em;
         color: #6b7280; border-bottom: 2px solid #e5e7eb; }
    td { padding: 7px 10px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
    tr:nth-child(even) td { background: #fafafa; }
    .no { font-weight: 700; color: #9ca3af; width: 32px; }
    .id { font-family: monospace; color: #d97706; font-size: 10px; }
    .male   { color: #0284c7; font-weight: 600; }
    .female { color: #db2777; font-weight: 600; }
    .parent { color: #6b7280; font-size: 10px; }
    .sig-row { margin-top: 40px; display: flex; gap: 60px; }
    .sig-line { border-top: 1px solid #000; width: 200px; padding-top: 4px;
                font-size: 10px; color: #6b7280; }
    @media print { @page { margin: 1.5cm; } }
  </style>
</head>
<body>
  <h1>Kibali Academy — ${grade}</h1>
  <p class="meta">Class Register · Printed ${new Date().toLocaleDateString(
    "en-KE",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    },
  )}</p>

  <div class="stats">
    <div><span class="stat-label">Total</span><span class="stat-value">${rows.length}</span></div>
    <div><span class="stat-label">Male</span><span class="stat-value" style="color:#0284c7">${male}</span></div>
    <div><span class="stat-label">Female</span><span class="stat-value" style="color:#db2777">${female}</span></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Student ID</th>
        <th>Full Name</th>
        <th>Gender</th>
        <th>Date of Birth</th>
        <th>UPI Number</th>
        <th>Parent / Guardian</th>
        <th>Phone</th>
      </tr>
    </thead>
    <tbody>
      ${rows
        .map(
          (s, i) => `
        <tr>
          <td class="no">${i + 1}</td>
          <td class="id">${s.readable_id ?? "—"}</td>
          <td><strong>${s.full_name}</strong></td>
          <td class="${s.gender === "Male" ? "male" : s.gender === "Female" ? "female" : ""}">${s.gender ?? "—"}</td>
          <td>${new Date(s.date_of_birth).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}</td>
          <td class="id">${s.upi_number ?? "—"}</td>
          <td class="parent">${s.parents?.full_name ?? "—"}</td>
          <td class="parent">${s.parents?.phone_number ?? "—"}</td>
        </tr>`,
        )
        .join("")}
    </tbody>
  </table>

  <div class="sig-row">
    <div class="sig-line">Class Teacher</div>
    <div class="sig-line">Head Teacher</div>
    <div class="sig-line">Date</div>
  </div>
</body>
</html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

// ── Toast ─────────────────────────────────────────────────────────────────────
