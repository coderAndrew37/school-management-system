/** Returns the age in full years from a date-of-birth ISO string. */
export function calcAge(dob: string): number {
  const b = new Date(dob);
  const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (
    n.getMonth() - b.getMonth() < 0 ||
    (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())
  )
    a--;
  return a;
}

/** Returns up to two initials from a full name. */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

/** Formats an ISO date string as "3 Apr". */
export function formatShort(iso: string): string {
  const d = new Date(iso + (iso.includes("T") ? "" : "T00:00:00"));
  return d.toLocaleDateString("en-KE", { day: "numeric", month: "short" });
}

/**
 * Returns a human-readable badge for how far away a date is.
 * Returns null if the date is in the past or more than 7 days away.
 */
export function daysFromNow(iso: string): string | null {
  const diff =
    new Date(iso + "T00:00:00").getTime() - new Date().setHours(0, 0, 0, 0);
  const days = Math.ceil(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 0) return null;
  if (days <= 7) return `In ${days} days`;
  return null;
}