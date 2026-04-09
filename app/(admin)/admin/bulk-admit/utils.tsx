// app/admin/bulk-admit/_lib/bulk-utils.ts

import { BulkAdmitRow } from "@/lib/actions/bulk-admit";
import { BulkTeacherRow } from "@/lib/actions/bulk-teacher";

// ── Grade to Level Mapping ──────────────────────────────────────────────────
// Matches the CHECK constraint in your public.classes table
export const GRADE_CONFIG = {
  "PP1": "lower_primary",
  "PP2": "lower_primary",
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
export type GradeName = keyof typeof GRADE_CONFIG;

// ── UI Styles ────────────────────────────────────────────────────────────────
export const inputCls =
  "w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 transition-all";

export const selectCls = `${inputCls} cursor-pointer`;

// ── Row Factories ────────────────────────────────────────────────────────────
export const EMPTY_STUDENT = (): BulkAdmitRow => ({
  studentName: "",
  dateOfBirth: "",
  gender: "Male",
  currentGrade: "Grade 1",
  stream: "Main",
  academicYear: 2026,
  parentName: "",
  parentEmail: "",
  parentPhone: "",
});

export const EMPTY_TEACHER = (): BulkTeacherRow => ({
  fullName: "",
  email: "",
  phone: "",
  tscNumber: "",
});

// ── CSV Parsing ──────────────────────────────────────────────────────────────
export function parseStudentCSV(text: string): BulkAdmitRow[] {
  const lines = text.trim().split("\n").filter(Boolean);
  const header = lines[0]?.toLowerCase() ?? "";
  
  // Skip header if it contains keywords like 'name' or 'student'
  const dataLines = header.includes("name") || header.includes("student") 
    ? lines.slice(1) 
    : lines;
  
  return dataLines.map((line) => {
    const [
      studentName = "",
      dateOfBirth = "",
      gender = "Male",
      currentGrade = "Grade 1",
      stream = "Main",
      parentName = "",
      parentEmail = "",
      parentPhone = "",
    ] = line.split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
    
    return {
      studentName,
      dateOfBirth,
      gender: gender.toLowerCase().startsWith("f") ? "Female" : "Male",
      currentGrade,
      stream: stream || "Main",
      academicYear: 2026,
      parentName,
      parentEmail,
      parentPhone,
    };
  });
}

export function parseTeacherCSV(text: string): BulkTeacherRow[] {
  const lines = text.trim().split("\n").filter(Boolean);
  const header = lines[0]?.toLowerCase() ?? "";
  const dataLines = header.includes("name") || header.includes("email") ? lines.slice(1) : lines;
  
  return dataLines.map((line) => {
    const [fullName = "", email = "", phone = "", tscNumber = ""] = line
      .split(",")
      .map((s) => s.trim().replace(/^"|"$/g, ""));
    return { fullName, email, phone, tscNumber };
  });
}

// ── Template Generator ───────────────────────────────────────────────────────
export function getCSVTemplate(mode: "students" | "teachers"): string {
  if (mode === "students") {
    const headers = "Student Name,Date of Birth,Gender,Grade,Stream,Parent Name,Parent Email,Parent Phone";
    const example = "Amani Otieno,2015-03-14,Male,Grade 3,North,David Otieno,david@example.com,0712345678";
    return `${headers}\n${example}`;
  }
  
  const headers = "Full Name,Email,Phone,TSC Number";
  const example = "Jane Wambui,jane@school.ac.ke,0712345678,TSC/12345";
  return `${headers}\n${example}`;
}