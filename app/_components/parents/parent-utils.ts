// app/admin/parents/_components/parent-utils.ts
// Pure helpers — no React, no server imports.

export function fmt(dt: string) {
  return new Date(dt).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function kes(n: number) {
  return `KES ${Math.abs(n).toLocaleString("en-KE")}`;
}

const GRADIENTS = [
  "from-sky-400 to-blue-500",
  "from-amber-400 to-orange-500",
  "from-violet-400 to-purple-500",
  "from-emerald-400 to-teal-500",
  "from-rose-400 to-pink-500",
];

export function gradient(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return GRADIENTS[Math.abs(h) % GRADIENTS.length]!;
}

export function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export function exportParentsToCSV(
  rows: {
    full_name: string;
    email: string;
    phone_number: string | null;
    invite_accepted: boolean;
    children: string;
    created_at: string;
  }[],
) {
  const headers = [
    "Full Name",
    "Email",
    "Phone",
    "Portal Status",
    "Children",
    "Registered",
  ];
  const data = rows.map((p) => [
    p.full_name,
    p.email,
    p.phone_number ?? "",
    p.invite_accepted ? "Active" : "Pending",
    p.children,
    new Date(p.created_at).toLocaleDateString("en-KE"),
  ]);
  const csv = [headers, ...data]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `kibali-parents-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
