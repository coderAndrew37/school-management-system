/**
 * bulk-admit/csvTemplate.ts
 *
 * Generates and parses the CSV template for bulk student admission.
 *
 * Changes vs. previous version:
 *   - Added optional `photo_url` column (publicly accessible URL to a photo).
 *   - Stream column: if a grade has no real streams, the cell should be left
 *     blank or contain "Main" — the importer will normalise it.
 *   - Added `academic_year` column (defaults to current year).
 *   - Added richer validation messages so the user gets actionable errors.
 */

export interface CsvRow {
  student_name: string;
  date_of_birth: string;        // YYYY-MM-DD
  gender: "Male" | "Female";
  grade: string;
  stream: string;               // "Main" when grade has no real streams
  academic_year: string;
  relationship_type: string;
  parent_name: string;
  parent_email: string;
  parent_phone: string;
  photo_url?: string;           // optional public URL; uploaded separately
}

// ── Column definitions (order matters — drives the CSV layout) ────────────
export const CSV_COLUMNS = [
  { key: "student_name",    label: "student_name",    required: true,  example: "Amani Wanjiku Otieno" },
  { key: "date_of_birth",   label: "date_of_birth",   required: true,  example: "2015-03-12" },
  { key: "gender",          label: "gender",          required: true,  example: "Female" },
  { key: "grade",           label: "grade",           required: true,  example: "Grade 4" },
  { key: "stream",          label: "stream",          required: false, example: "East" },
  { key: "academic_year",   label: "academic_year",   required: false, example: "2026" },
  { key: "relationship_type", label: "relationship_type", required: true, example: "mother" },
  { key: "parent_name",     label: "parent_name",     required: true,  example: "Jane Wanjiku Otieno" },
  { key: "parent_email",    label: "parent_email",    required: true,  example: "jane@email.com" },
  { key: "parent_phone",    label: "parent_phone",    required: true,  example: "+254712345678" },
  { key: "photo_url",       label: "photo_url",       required: false, example: "https://example.com/photo.jpg" },
] as const;

// ── Template generation ───────────────────────────────────────────────────

/**
 * Returns the raw CSV string for the import template.
 * Includes a header row + two example rows (one with stream, one without).
 */
export function generateCsvTemplate(): string {
  const header = CSV_COLUMNS.map((c) => c.label).join(",");

  // Example row 1: grade with a real stream
  const example1 = [
    "Amani Wanjiku Otieno",
    "2015-03-12",
    "Female",
    "Grade 4",
    "East",          // real stream
    "2026",
    "mother",
    "Jane Wanjiku Otieno",
    "jane@email.com",
    "+254712345678",
    "",              // no photo URL
  ].join(",");

  // Example row 2: grade without streams (leave stream blank or "Main")
  const example2 = [
    "Brian Otieno Kamau",
    "2016-07-22",
    "Male",
    "PP2",
    "",              // blank = "Main" — grade has no real streams
    "2026",
    "father",
    "Peter Kamau",
    "peter.kamau@email.com",
    "+254798765432",
    "",
  ].join(",");

  return [header, example1, example2].join("\n");
}

/** Triggers a browser download of the template CSV. */
export function downloadCsvTemplate(filename = "bulk_admit_template.csv"): void {
  const csv = generateCsvTemplate();
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── CSV parsing ───────────────────────────────────────────────────────────

export interface ParseResult {
  rows: CsvRow[];
  errors: { line: number; message: string }[];
}

const VALID_GENDERS = new Set(["male", "female"]);
const VALID_RELATIONSHIPS = new Set(["mother", "father", "guardian", "other"]);
const DOB_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CURRENT_YEAR = 2026;

export function parseCsv(content: string): ParseResult {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return { rows: [], errors: [{ line: 0, message: "File appears empty or has no data rows." }] };
  }

  // Parse header
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const colIndex = (key: string) => headers.indexOf(key);

  const errors: { line: number; message: string }[] = [];
  const rows: CsvRow[] = [];

  for (let i = 1; i < Math.min(lines.length, 501); i++) {
    const lineNum = i + 1; // 1-based for user-facing messages
    const cells = lines[i].split(",").map((c) => c.trim());
    const get = (key: string) => cells[colIndex(key)] ?? "";

    const studentName = get("student_name");
    const dateOfBirth = get("date_of_birth");
    const gender = get("gender");
    const grade = get("grade");
    const streamRaw = get("stream");
    const stream = streamRaw === "" ? "Main" : streamRaw; // normalise blank → Main
    const academicYearRaw = get("academic_year");
    const academicYear = academicYearRaw === "" ? String(CURRENT_YEAR) : academicYearRaw;
    const relationshipType = get("relationship_type");
    const parentName = get("parent_name");
    const parentEmail = get("parent_email");
    const parentPhone = get("parent_phone");
    const photoUrl = get("photo_url");

    // ── Validation ──────────────────────────────────────────────────────
    const rowErrors: string[] = [];

    if (!studentName) rowErrors.push("student_name is required");
    if (!dateOfBirth) {
      rowErrors.push("date_of_birth is required");
    } else if (!DOB_RE.test(dateOfBirth)) {
      rowErrors.push(`date_of_birth must be YYYY-MM-DD, got "${dateOfBirth}"`);
    }
    if (!VALID_GENDERS.has(gender.toLowerCase())) {
      rowErrors.push(`gender must be Male or Female, got "${gender}"`);
    }
    if (!grade) rowErrors.push("grade is required");
    if (!VALID_RELATIONSHIPS.has(relationshipType.toLowerCase())) {
      rowErrors.push(
        `relationship_type must be mother/father/guardian/other, got "${relationshipType}"`
      );
    }
    if (!parentName) rowErrors.push("parent_name is required");
    if (!parentEmail) {
      rowErrors.push("parent_email is required");
    } else if (!EMAIL_RE.test(parentEmail)) {
      rowErrors.push(`parent_email looks invalid: "${parentEmail}"`);
    }
    if (!parentPhone) rowErrors.push("parent_phone is required");

    if (rowErrors.length > 0) {
      errors.push({ line: lineNum, message: rowErrors.join("; ") });
      continue;
    }

    rows.push({
      student_name: studentName,
      date_of_birth: dateOfBirth,
      gender: gender.charAt(0).toUpperCase() + gender.slice(1).toLowerCase() as "Male" | "Female",
      grade,
      stream,
      academic_year: academicYear,
      relationship_type: relationshipType.toLowerCase(),
      parent_name: parentName,
      parent_email: parentEmail.toLowerCase(),
      parent_phone: parentPhone,
      ...(photoUrl ? { photo_url: photoUrl } : {}),
    });
  }

  return { rows, errors };
}