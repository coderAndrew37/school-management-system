// app/admin/bulk-admit/_lib/bulk-utils.ts

import { BulkAdmitRow } from "@/lib/actions/bulk-admit";
import { BulkStaffRow } from "@/lib/actions/bulk-teacher";

// ── Grade → Level Mapping ──────────────────────────────────────────────────
// Must match the `level` check constraint on the `classes` table:
//   'lower_primary' | 'upper_primary' | 'junior_secondary'
export const GRADE_CONFIG: Record<
  string,
  "lower_primary" | "upper_primary" | "junior_secondary"
> = {
  "PP1":     "lower_primary",
  "PP2":     "lower_primary",
  "Grade 1": "lower_primary",
  "Grade 2": "lower_primary",
  "Grade 3": "lower_primary",
  "Grade 4": "upper_primary",
  "Grade 5": "upper_primary",
  "Grade 6": "upper_primary",
  "Grade 7": "junior_secondary",
  "Grade 8": "junior_secondary",
  "Grade 9": "junior_secondary",
} as const;

export const GRADES = Object.keys(GRADE_CONFIG);

/**
 * Derive the DB `level` value from a grade string.
 * Throws a descriptive error if the grade isn't in the config.
 */
export function gradeToLevel(
  grade: string
): "lower_primary" | "upper_primary" | "junior_secondary" {
  const level = GRADE_CONFIG[grade];
  if (!level)
    throw new Error(`Unknown grade "${grade}" — cannot determine class level`);
  return level;
}

// ── UI Styles ────────────────────────────────────────────────────────────────
export const inputCls =
  "w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 transition-all";

export const selectCls = `${inputCls} cursor-pointer`;

// ── Row Factories ────────────────────────────────────────────────────────────
export const EMPTY_STUDENT = (): BulkAdmitRow => ({
  studentName:      "",
  dateOfBirth:      "",
  gender:           "Male",
  currentGrade:     "Grade 1",
  stream:           "Main",
  academicYear:     2026,
  upiNumber:        "",
  parentName:       "",
  parentEmail:      "",
  parentPhone:      "",
  relationshipType: "guardian",
  parentMode:       "new",
  existingParentId: null,
});

// ── CSV Parsing ───────────────────────────────────────────────────────────────
// Expected column order:
//   Student Name | Date of Birth | Gender | Grade | Stream |
//   UPI Number   | Parent Name   | Parent Email   | Parent Phone
//
// UPI Number is optional — leave the column blank if unknown.
// All parent columns are optional — leave blank to admit without a parent link.

export function parseStudentCSV(text: string): BulkAdmitRow[] {
  const lines = text.trim().split("\n").filter(Boolean);
  if (lines.length === 0) return [];

  const firstLine = lines[0]?.toLowerCase() ?? "";
  const dataLines =
    firstLine.includes("name") ||
    firstLine.includes("student") ||
    firstLine.includes("upi")
      ? lines.slice(1)
      : lines;

  return dataLines
    .map((line) => {
      const cols = line.split(",").map((s) => s.trim().replace(/^"|"$/g, ""));

      const [
        studentName  = "",
        dateOfBirth  = "",
        rawGender    = "Male",
        currentGrade = "Grade 1",
        stream       = "Main",
        upiNumber    = "",
        parentName   = "",
        parentEmail  = "",
        parentPhone  = "",
      ] = cols;

      return {
        studentName,
        dateOfBirth,
        gender:           rawGender.toLowerCase().startsWith("f") ? "Female" : "Male",
        currentGrade,
        stream:           stream || "Main",
        academicYear:     2026,
        upiNumber:        upiNumber || "",
        parentName,
        parentEmail,
        parentPhone,
        relationshipType: "guardian",
        parentMode:       "new",
        existingParentId: null,
      };
    })
    .filter((r) => r.studentName.trim().length > 0);
}

// ── Teacher Utils ─────────────────────────────────────────────────────────────
export const EMPTY_TEACHER = (): BulkStaffRow => ({
  fullName:  "",
  email:     "",
  phone:     "",
  tscNumber: "",
});

export function parseTeacherCSV(text: string): BulkStaffRow[] {
  const lines = text.trim().split("\n").filter(Boolean);
  const header = lines[0]?.toLowerCase() ?? "";
  const dataLines =
    header.includes("name") || header.includes("email") ? lines.slice(1) : lines;

  return dataLines
    .map((line) => {
      const [fullName = "", email = "", phone = "", tscNumber = ""] = line
        .split(",")
        .map((s) => s.trim().replace(/^"|"$/g, ""));
      return { fullName, email, phone, tscNumber };
    })
    .filter((r) => r.fullName.trim().length > 0);
}

// ── CSV Template Generator ────────────────────────────────────────────────────
export function getCSVTemplate(mode: "students" | "teachers"): string {
  if (mode === "students") {
    const headers =
      "Student Name,Date of Birth,Gender,Grade,Stream,UPI Number,Parent Name,Parent Email,Parent Phone";
    // Example 1: UPI blank (optional), all parent fields filled
    const example1 =
      "Amani Otieno,2015-03-14,Male,Grade 3,North,,David Otieno,david@example.com,0712345678";
    // Example 2: UPI provided, existing parent
    const example2 =
      "Zawadi Muthoni,2016-07-22,Female,Grade 2,Main,UPI123456,Sarah Muthoni,sarah@example.com,0723456789";
    // Example 3: student only — no UPI, no parent
    const example3 =
      "Brian Kamau,2014-11-05,Male,Grade 4,Main,,,,";
    return `${headers}\n${example1}\n${example2}\n${example3}`;
  }

  const headers = "Full Name,Email,Phone,TSC Number";
  const example = "Jane Wambui,jane@school.ac.ke,0712345678,TSC/12345";
  return `${headers}\n${example}`;
}