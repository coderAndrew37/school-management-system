"use client";

// Shared bulk admission client — used for both students and teachers.
// app/admin/bulk-admit/_components/BulkAdmitClient.tsx

import { useState, useTransition, useRef } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Upload,
  Plus,
  Trash2,
  Check,
  X,
  Loader2,
  Download,
  AlertTriangle,
  CheckCircle2,
  Users,
  GraduationCap,
} from "lucide-react";
import {
  bulkAdmitStudentsAction,
  type BulkAdmitRow,
  type BulkAdmitResult,
} from "@/lib/actions/bulk-admit";
import {
  bulkAddTeachersAction,
  type BulkTeacherRow,
  type BulkTeacherResult,
} from "@/lib/actions/bulk-teacher";

type Mode = "students" | "teachers";

interface BulkAdmitClientProps {
  classes: { id: string; name: string }[];
}

// ── Default empty rows ─────────────────────────────────────────────────────────
const EMPTY_STUDENT = (): BulkAdmitRow => ({
  studentName: "",
  dateOfBirth: "",
  gender: "Male",
  currentGrade: "",
  classId: "",
  parentName: "",
  parentEmail: "",
  parentPhone: "",
});

const EMPTY_TEACHER = (): BulkTeacherRow => ({
  fullName: "",
  email: "",
  phone: "",
  tscNumber: "",
});

// ── CSV parsing ───────────────────────────────────────────────────────────────
function parseStudentCSV(text: string): BulkAdmitRow[] {
  const lines = text.trim().split("\n").filter(Boolean);
  const header = lines[0]?.toLowerCase() ?? "";
  const dataLines =
    header.includes("student") || header.includes("name")
      ? lines.slice(1)
      : lines;
  return dataLines.map((line) => {
    const [
      studentName = "",
      dateOfBirth = "",
      gender = "Male",
      currentGrade = "",
      classId = "",
      parentName = "",
      parentEmail = "",
      parentPhone = "",
    ] = line.split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
    return {
      studentName,
      dateOfBirth,
      gender: gender === "Female" ? "Female" : "Male",
      currentGrade,
      classId,
      parentName,
      parentEmail,
      parentPhone,
    };
  });
}

function parseTeacherCSV(text: string): BulkTeacherRow[] {
  const lines = text.trim().split("\n").filter(Boolean);
  const header = lines[0]?.toLowerCase() ?? "";
  const dataLines =
    header.includes("name") || header.includes("email")
      ? lines.slice(1)
      : lines;
  return dataLines.map((line) => {
    const [fullName = "", email = "", phone = "", tscNumber = ""] = line
      .split(",")
      .map((s) => s.trim().replace(/^"|"$/g, ""));
    return { fullName, email, phone, tscNumber };
  });
}

// ── Grade options ──────────────────────────────────────────────────────────────
const GRADES = [
  "PP1",
  "PP2",
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
  "Grade 7 / JSS 1",
  "Grade 8 / JSS 2",
  "Grade 9 / JSS 3",
];

const inputCls =
  "w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400";
const selectCls = `${inputCls} cursor-pointer`;

export function BulkAdmitClient({ classes }: BulkAdmitClientProps) {
  const [mode, setMode] = useState<Mode>("students");
  const [studentRows, setStudentRows] = useState<BulkAdmitRow[]>([
    EMPTY_STUDENT(),
  ]);
  const [teacherRows, setTeacherRows] = useState<BulkTeacherRow[]>([
    EMPTY_TEACHER(),
  ]);
  const [results, setResults] = useState<
    (BulkAdmitResult | BulkTeacherResult)[] | null
  >(null);
  const [summary, setSummary] = useState<{
    success: number;
    fail: number;
  } | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [isPending, startTrans] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  // ── Student row ops ──────────────────────────────────────────────────────────
  function updateStudent(i: number, field: keyof BulkAdmitRow, value: string) {
    setStudentRows((rows) =>
      rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)),
    );
  }
  function addStudentRow() {
    setStudentRows((r) => [...r, EMPTY_STUDENT()]);
  }
  function removeStudentRow(i: number) {
    setStudentRows((rows) =>
      rows.length === 1
        ? [EMPTY_STUDENT()]
        : rows.filter((_, idx) => idx !== i),
    );
  }

  // ── Teacher row ops ──────────────────────────────────────────────────────────
  function updateTeacher(
    i: number,
    field: keyof BulkTeacherRow,
    value: string,
  ) {
    setTeacherRows((rows) =>
      rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)),
    );
  }
  function addTeacherRow() {
    setTeacherRows((r) => [...r, EMPTY_TEACHER()]);
  }
  function removeTeacherRow(i: number) {
    setTeacherRows((rows) =>
      rows.length === 1
        ? [EMPTY_TEACHER()]
        : rows.filter((_, idx) => idx !== i),
    );
  }

  // ── CSV upload ────────────────────────────────────────────────────────────────
  function handleCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (mode === "students") {
        const parsed = parseStudentCSV(text);
        if (parsed.length) {
          setStudentRows(parsed);
          showToast(`Loaded ${parsed.length} student rows from CSV`, true);
        }
      } else {
        const parsed = parseTeacherCSV(text);
        if (parsed.length) {
          setTeacherRows(parsed);
          showToast(`Loaded ${parsed.length} teacher rows from CSV`, true);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  // ── CSV template download ────────────────────────────────────────────────────
  function downloadTemplate() {
    const csv =
      mode === "students"
        ? "Student Name,Date of Birth,Gender,Grade,Class ID,Parent Name,Parent Email,Parent Phone\nAmani Otieno,2015-03-14,Male,Grade 3,,David Otieno,david@example.com,0712345678"
        : "Full Name,Email,Phone,TSC Number\nJane Wambui,jane@school.ac.ke,0712345678,TSC/12345";
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download =
      mode === "students" ? "student_template.csv" : "teacher_template.csv";
    a.click();
  }

  // ── Submit ────────────────────────────────────────────────────────────────────
  function handleSubmit() {
    setResults(null);
    setSummary(null);
    startTrans(async () => {
      if (mode === "students") {
        const valid = studentRows.filter((r) => r.studentName.trim());
        if (valid.length === 0) {
          showToast("Add at least one student", false);
          return;
        }
        const res = await bulkAdmitStudentsAction(valid);
        setResults(res.results);
        setSummary({ success: res.successCount, fail: res.failCount });
        showToast(
          `${res.successCount} admitted, ${res.failCount} failed`,
          res.failCount === 0,
        );
      } else {
        const valid = teacherRows.filter((r) => r.fullName.trim());
        if (valid.length === 0) {
          showToast("Add at least one teacher", false);
          return;
        }
        const res = await bulkAddTeachersAction(valid);
        setResults(res.results);
        setSummary({ success: res.successCount, fail: res.failCount });
        showToast(
          `${res.successCount} added, ${res.failCount} failed`,
          res.failCount === 0,
        );
      }
    });
  }

  const rowCount =
    mode === "students" ? studentRows.length : teacherRows.length;

  return (
    <div className="min-h-screen bg-[#f5f6fa]">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-bold shadow-lg flex items-center gap-2 ${toast.ok ? "bg-emerald-600 text-white" : "bg-rose-500 text-white"}`}
        >
          {toast.ok && <Check className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Link href="/admin" className="text-slate-400 hover:text-slate-600">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <p className="text-sm font-black text-slate-800">Bulk Admission</p>
            <p className="text-[10px] text-slate-400 font-semibold">
              {rowCount} row{rowCount !== 1 ? "s" : ""} · paste or upload CSV
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-1.5 text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 px-3 py-1.5 rounded-xl transition-colors"
            >
              <Download className="h-3.5 w-3.5" /> Template
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 px-3 py-1.5 rounded-xl transition-colors"
            >
              <Upload className="h-3.5 w-3.5" /> Upload CSV
            </button>
            <input
              aria-label="upload CSV file"
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleCSV}
            />
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 space-y-4">
        {/* Mode toggle */}
        <div className="flex gap-2 bg-white rounded-2xl border border-slate-200 p-1.5 shadow-sm max-w-xs">
          {(
            [
              { key: "students", label: "Students", icon: GraduationCap },
              { key: "teachers", label: "Teachers", icon: Users },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => {
                setMode(key);
                setResults(null);
                setSummary(null);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${
                mode === key
                  ? "bg-sky-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        {/* Results panel */}
        {summary && results && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <span className="text-sm font-black text-emerald-600">
                  {summary.success} succeeded
                </span>
              </div>
              {summary.fail > 0 && (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-rose-500" />
                  <span className="text-sm font-black text-rose-600">
                    {summary.fail} failed
                  </span>
                </div>
              )}
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {results.map((r, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 text-xs rounded-xl px-3 py-2 ${r.success ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}
                >
                  {r.success ? (
                    <Check className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  ) : (
                    <X className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <span className="font-bold">
                      {"studentName" in r
                        ? r.studentName
                        : (r as BulkTeacherResult).fullName}
                    </span>
                    {" — "}
                    <span>{r.message}</span>
                  </div>
                </div>
              ))}
            </div>
            {summary.fail === 0 && (
              <button
                onClick={() => {
                  setResults(null);
                  setSummary(null);
                  if (mode === "students") setStudentRows([EMPTY_STUDENT()]);
                  else setTeacherRows([EMPTY_TEACHER()]);
                }}
                className="text-xs font-bold text-sky-600 hover:underline"
              >
                Clear and add more →
              </button>
            )}
          </div>
        )}

        {/* Grid editor */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            {mode === "students" ? (
              <table
                className="w-full border-collapse"
                style={{ minWidth: "1000px" }}
              >
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-400 w-6">
                      #
                    </th>
                    {[
                      "Student Name",
                      "Date of Birth",
                      "Gender",
                      "Grade",
                      "Assigned Class",
                      "Parent Name",
                      "Parent Email",
                      "Parent Phone",
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-left px-2 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-400"
                      >
                        {h}
                      </th>
                    ))}
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {studentRows.map((row, i) => {
                    const result = results?.[i] as BulkAdmitResult | undefined;
                    return (
                      <tr
                        key={i}
                        className={`border-b border-slate-100 ${result?.success ? "bg-emerald-50/30" : result ? "bg-rose-50/30" : ""}`}
                      >
                        <td className="px-3 py-1.5 text-[10px] text-slate-400 font-bold">
                          {i + 1}
                        </td>
                        <td className="px-1.5 py-1.5">
                          <input
                            className={inputCls}
                            placeholder="Full name"
                            value={row.studentName}
                            onChange={(e) =>
                              updateStudent(i, "studentName", e.target.value)
                            }
                          />
                        </td>
                        <td className="px-1.5 py-1.5">
                          <input
                            aria-label="Date of Birth"
                            className={inputCls}
                            type="date"
                            value={row.dateOfBirth}
                            onChange={(e) =>
                              updateStudent(i, "dateOfBirth", e.target.value)
                            }
                          />
                        </td>
                        <td className="px-1.5 py-1.5">
                          <select
                            aria-label="Gender"
                            className={selectCls}
                            value={row.gender}
                            onChange={(e) =>
                              updateStudent(
                                i,
                                "gender",
                                e.target.value as "Male" | "Female",
                              )
                            }
                          >
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                          </select>
                        </td>
                        <td className="px-1.5 py-1.5">
                          <select
                            aria-label="Grade"
                            className={selectCls}
                            value={row.currentGrade}
                            onChange={(e) =>
                              updateStudent(i, "currentGrade", e.target.value)
                            }
                          >
                            <option value="">Grade…</option>
                            {GRADES.map((g) => (
                              <option key={g} value={g}>
                                {g}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-1.5 py-1.5">
                          <select
                            aria-label="Class"
                            className={selectCls}
                            value={row.classId}
                            onChange={(e) =>
                              updateStudent(i, "classId", e.target.value)
                            }
                          >
                            <option value="">Select Class…</option>
                            {classes.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-1.5 py-1.5">
                          <input
                            className={inputCls}
                            placeholder="Parent name"
                            value={row.parentName}
                            onChange={(e) =>
                              updateStudent(i, "parentName", e.target.value)
                            }
                          />
                        </td>
                        <td className="px-1.5 py-1.5">
                          <input
                            className={inputCls}
                            type="email"
                            placeholder="parent@email.com"
                            value={row.parentEmail}
                            onChange={(e) =>
                              updateStudent(i, "parentEmail", e.target.value)
                            }
                          />
                        </td>
                        <td className="px-1.5 py-1.5">
                          <input
                            className={inputCls}
                            placeholder="0712345678"
                            value={row.parentPhone}
                            onChange={(e) =>
                              updateStudent(i, "parentPhone", e.target.value)
                            }
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <button
                            aria-label="Remove student"
                            onClick={() => removeStudentRow(i)}
                            className="text-slate-300 hover:text-rose-500 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <table
                className="w-full border-collapse"
                style={{ minWidth: "600px" }}
              >
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-400 w-6">
                      #
                    </th>
                    {[
                      "Full Name",
                      "Email",
                      "Phone",
                      "TSC Number (optional)",
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-left px-2 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-400"
                      >
                        {h}
                      </th>
                    ))}
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {teacherRows.map((row, i) => {
                    const result = results?.[i] as
                      | BulkTeacherResult
                      | undefined;
                    return (
                      <tr
                        key={i}
                        className={`border-b border-slate-100 ${result?.success ? "bg-emerald-50/30" : result ? "bg-rose-50/30" : ""}`}
                      >
                        <td className="px-3 py-1.5 text-[10px] text-slate-400 font-bold">
                          {i + 1}
                        </td>
                        <td className="px-1.5 py-1.5">
                          <input
                            className={inputCls}
                            placeholder="Full name"
                            value={row.fullName}
                            onChange={(e) =>
                              updateTeacher(i, "fullName", e.target.value)
                            }
                          />
                        </td>
                        <td className="px-1.5 py-1.5">
                          <input
                            className={inputCls}
                            type="email"
                            placeholder="teacher@school.ac.ke"
                            value={row.email}
                            onChange={(e) =>
                              updateTeacher(i, "email", e.target.value)
                            }
                          />
                        </td>
                        <td className="px-1.5 py-1.5">
                          <input
                            className={inputCls}
                            placeholder="0712345678"
                            value={row.phone}
                            onChange={(e) =>
                              updateTeacher(i, "phone", e.target.value)
                            }
                          />
                        </td>
                        <td className="px-1.5 py-1.5">
                          <input
                            className={inputCls}
                            placeholder="TSC/12345"
                            value={row.tscNumber}
                            onChange={(e) =>
                              updateTeacher(i, "tscNumber", e.target.value)
                            }
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <button
                            aria-label="Remove teacher"
                            onClick={() => removeTeacherRow(i)}
                            className="text-slate-300 hover:text-rose-500 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer actions */}
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
            <button
              onClick={mode === "students" ? addStudentRow : addTeacherRow}
              className="flex items-center gap-1.5 text-xs font-bold text-sky-600 hover:text-sky-700 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add row
            </button>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400">
                {rowCount} row{rowCount !== 1 ? "s" : ""}
              </span>
              <button
                onClick={handleSubmit}
                disabled={isPending}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold transition-colors disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Processing…
                  </>
                ) : (
                  <>
                    {mode === "students" ? (
                      <GraduationCap className="h-4 w-4" />
                    ) : (
                      <Users className="h-4 w-4" />
                    )}
                    Submit {rowCount}{" "}
                    {mode === "students" ? "Student" : "Teacher"}
                    {rowCount !== 1 ? "s" : ""}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-slate-400 text-center">
          Each row creates auth accounts, database records, and sends welcome
          emails automatically. Duplicate emails are skipped gracefully.
        </p>
      </div>
    </div>
  );
}