// lib/pdf/ReportCardDocument.tsx
// Phase 4: CBC Report Card PDF using @react-pdf/renderer
// npm install @react-pdf/renderer

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

// ── Types ─────────────────────────────────────────────────────────────────────

interface StrandScore {
  strand_id: string;
  score: string;
  teacher_remarks: string | null;
}

interface SubjectResult {
  name: string;
  strands: StrandScore[];
  overallScore: string;
}

interface ReportCardProps {
  student: {
    fullName: string;
    readableId?: string;
    upiNumber?: string;
    gender?: string;
    dateOfBirth: string;
    grade: string;
  };
  report: {
    term: number;
    academicYear: number;
    classTeacherName: string;
    classTeacherRemarks?: string;
    conductGrade?: string;
    effortGrade?: string;
  };
  subjects: SubjectResult[];
  attendance: { present: number; absent: number; late: number; total: number };
}

// ── Colours ───────────────────────────────────────────────────────────────────

const C = {
  emerald: "#10b981",
  emeraldDark: "#065f46",
  emeraldLight: "#d1fae5",
  amber: "#f59e0b",
  amberLight: "#fef3c7",
  sky: "#0ea5e9",
  skyLight: "#e0f2fe",
  rose: "#ef4444",
  roseLight: "#fee2e2",
  slate800: "#1e293b",
  slate600: "#475569",
  slate400: "#94a3b8",
  slate200: "#e2e8f0",
  slate100: "#f1f5f9",
  white: "#ffffff",
};

// Score colours
const SCORE_COLOR: Record<string, { bg: string; text: string }> = {
  EE: { bg: "#d1fae5", text: "#065f46" },
  ME: { bg: "#dbeafe", text: "#1e40af" },
  AE: { bg: "#fef3c7", text: "#92400e" },
  BE: { bg: "#fee2e2", text: "#991b1b" },
};
const SCORE_LABEL: Record<string, string> = {
  EE: "Exceeding Expectations",
  ME: "Meeting Expectations",
  AE: "Approaching Expectations",
  BE: "Below Expectations",
};

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    backgroundColor: C.white,
    paddingTop: 0,
    paddingBottom: 24,
    paddingHorizontal: 0,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: C.slate800,
  },

  // Header
  header: {
    backgroundColor: C.emeraldDark,
    paddingHorizontal: 32,
    paddingTop: 24,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  schoolBadge: {
    width: 36,
    height: 36,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  badgeText: {
    color: C.white,
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
  },
  schoolName: {
    color: C.white,
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
  },
  schoolSub: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 8,
    marginTop: 2,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  reportTitle: {
    color: C.white,
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginTop: 12,
    letterSpacing: 0.3,
  },
  termBadge: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
    marginTop: 6,
  },
  termBadgeText: {
    color: C.white,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
  },

  // Content wrapper
  content: {
    paddingHorizontal: 32,
    paddingTop: 20,
  },

  // Student info card
  infoCard: {
    backgroundColor: C.slate100,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    flexDirection: "row",
    gap: 24,
  },
  infoCol: { flex: 1 },
  infoRow: {
    flexDirection: "row",
    marginBottom: 5,
  },
  infoLabel: {
    color: C.slate400,
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    width: 72,
  },
  infoValue: {
    color: C.slate800,
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    flex: 1,
  },

  // Section headers
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    marginTop: 14,
  },
  sectionDot: {
    width: 6,
    height: 6,
    backgroundColor: C.emerald,
    borderRadius: 3,
    marginRight: 6,
  },
  sectionTitle: {
    color: C.slate800,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  // Subjects
  subjectRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.slate200,
    borderRadius: 6,
    marginBottom: 4,
    padding: 8,
    gap: 6,
  },
  subjectName: {
    flex: 1,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: C.slate800,
  },
  strandPills: {
    flexDirection: "row",
    gap: 3,
    flexWrap: "wrap",
    flex: 2,
  },
  strandPill: {
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
  },
  subjectOverall: {
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 3,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    minWidth: 24,
    textAlign: "center",
  },
  teacherRemark: {
    fontSize: 7.5,
    color: C.slate600,
    marginTop: 3,
    fontStyle: "italic",
  },

  // Attendance
  attGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  attBox: {
    flex: 1,
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
  },
  attValue: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
  },
  attLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 3,
  },

  // Conduct / effort
  conductGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  conductBox: {
    flex: 1,
    borderRadius: 8,
    padding: 10,
    backgroundColor: C.slate100,
    borderWidth: 1,
    borderColor: C.slate200,
  },
  conductLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: C.slate400,
    marginBottom: 4,
  },
  conductValue: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: C.slate800,
  },

  // Remarks
  remarksBox: {
    backgroundColor: C.emeraldLight,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  remarksLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: C.emeraldDark,
    marginBottom: 5,
  },
  remarksText: {
    fontSize: 9,
    color: C.emeraldDark,
    lineHeight: 1.6,
  },
  remarksEmpty: {
    fontSize: 8.5,
    color: C.slate400,
    fontStyle: "italic",
  },

  // Signature row
  sigRow: {
    flexDirection: "row",
    marginTop: 20,
    gap: 16,
  },
  sigBox: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: C.slate400,
    paddingTop: 6,
  },
  sigLabel: {
    fontSize: 7.5,
    color: C.slate600,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sigName: {
    fontSize: 8,
    color: C.slate800,
    marginTop: 2,
  },

  // CBC legend
  legend: {
    flexDirection: "row",
    gap: 6,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: C.slate200,
    paddingTop: 10,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 7,
    color: C.slate600,
  },

  // Footer
  footer: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: C.slate200,
    paddingTop: 8,
    paddingHorizontal: 32,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 7,
    color: C.slate400,
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcAge(dob: string): number {
  const b = new Date(dob),
    n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (
    n.getMonth() < b.getMonth() ||
    (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())
  )
    a--;
  return a;
}

function attRate(present: number, late: number, total: number): string {
  if (total === 0) return "N/A";
  return `${Math.round(((present + late) / total) * 100)}%`;
}

// ── Document ──────────────────────────────────────────────────────────────────

export function ReportCardDocument(props: ReportCardProps) {
  const { student, report, subjects, attendance } = props;
  const { present, absent, late, total } = attendance;
  const rate = attRate(present, late, total);
  const attRateNum =
    total > 0 ? Math.round(((present + late) / total) * 100) : 0;
  const attColor =
    attRateNum >= 90 ? C.emerald : attRateNum >= 75 ? C.amber : C.rose;

  return (
    <Document
      title={`${student.fullName} — Term ${report.term} Report`}
      author="Kibali Academy"
    >
      <Page size="A4" style={s.page}>
        {/* ── Header ── */}
        <View style={s.header}>
          <View style={s.headerTop}>
            <View style={s.schoolBadge}>
              <Text style={s.badgeText}>K</Text>
            </View>
            <View>
              <Text style={s.schoolName}>Kibali Academy</Text>
              <Text style={s.schoolSub}>CBC Competency-Based Curriculum</Text>
            </View>
          </View>
          <Text style={s.reportTitle}>Student Progress Report Card</Text>
          <View style={s.termBadge}>
            <Text style={s.termBadgeText}>
              Term {report.term} · Academic Year {report.academicYear} ·{" "}
              {student.grade}
            </Text>
          </View>
        </View>

        <View style={s.content}>
          {/* ── Student Info ── */}
          <View style={s.infoCard}>
            <View style={s.infoCol}>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Student</Text>
                <Text style={s.infoValue}>{student.fullName}</Text>
              </View>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Grade</Text>
                <Text style={s.infoValue}>{student.grade}</Text>
              </View>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Gender</Text>
                <Text style={s.infoValue}>{student.gender ?? "—"}</Text>
              </View>
            </View>
            <View style={s.infoCol}>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Age</Text>
                <Text style={s.infoValue}>
                  {calcAge(student.dateOfBirth)} years
                </Text>
              </View>
              {student.upiNumber && (
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>UPI No.</Text>
                  <Text style={s.infoValue}>{student.upiNumber}</Text>
                </View>
              )}
              {student.readableId && (
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>Adm. No.</Text>
                  <Text style={s.infoValue}>{student.readableId}</Text>
                </View>
              )}
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Class Teacher</Text>
                <Text style={s.infoValue}>{report.classTeacherName}</Text>
              </View>
            </View>
          </View>

          {/* ── Attendance ── */}
          <View style={s.sectionHeader}>
            <View style={s.sectionDot} />
            <Text style={s.sectionTitle}>Attendance</Text>
          </View>

          <View style={s.attGrid}>
            {[
              {
                label: "Present",
                value: present,
                bg: C.emeraldLight,
                text: C.emeraldDark,
              },
              {
                label: "Absent",
                value: absent,
                bg: C.roseLight,
                text: "#991b1b",
              },
              { label: "Late", value: late, bg: C.amberLight, text: "#92400e" },
              {
                label: "Total Days",
                value: total,
                bg: C.slate100,
                text: C.slate600,
              },
              { label: "Rate", value: rate, bg: C.skyLight, text: "#075985" },
            ].map(({ label, value, bg, text }) => (
              <View key={label} style={[s.attBox, { backgroundColor: bg }]}>
                <Text style={[s.attValue, { color: text }]}>{value}</Text>
                <Text style={[s.attLabel, { color: text }]}>{label}</Text>
              </View>
            ))}
          </View>

          {/* ── Conduct & Effort ── */}
          {(report.conductGrade || report.effortGrade) && (
            <>
              <View style={s.sectionHeader}>
                <View style={s.sectionDot} />
                <Text style={s.sectionTitle}>Conduct & Effort</Text>
              </View>
              <View style={s.conductGrid}>
                <View style={s.conductBox}>
                  <Text style={s.conductLabel}>Conduct</Text>
                  <Text style={s.conductValue}>
                    {report.conductGrade ?? "Not graded"}
                  </Text>
                </View>
                <View style={s.conductBox}>
                  <Text style={s.conductLabel}>Effort</Text>
                  <Text style={s.conductValue}>
                    {report.effortGrade ?? "Not graded"}
                  </Text>
                </View>
              </View>
            </>
          )}

          {/* ── Subject Results ── */}
          <View style={s.sectionHeader}>
            <View style={s.sectionDot} />
            <Text style={s.sectionTitle}>
              Subject Results ({subjects.length} subjects)
            </Text>
          </View>

          {subjects.length === 0 ? (
            <View
              style={[
                s.remarksBox,
                { backgroundColor: C.amberLight, borderColor: "#fde68a" },
              ]}
            >
              <Text style={[s.remarksText, { color: "#92400e" }]}>
                No subject assessments have been recorded for this term.
              </Text>
            </View>
          ) : (
            subjects.map((subj) => {
              const sc = SCORE_COLOR[subj.overallScore] ?? SCORE_COLOR.ME;
              return (
                <View key={subj.name} style={s.subjectRow}>
                  <View style={{ flex: 3 }}>
                    <Text style={s.subjectName}>{subj.name}</Text>
                    {/* Strand pills */}
                    <View style={s.strandPills}>
                      {subj.strands.map((strand) => {
                        const ssc = SCORE_COLOR[strand.score] ?? SCORE_COLOR.ME;
                        return (
                          <Text
                            key={strand.strand_id}
                            style={[
                              s.strandPill,
                              { backgroundColor: ssc.bg, color: ssc.text },
                            ]}
                            title={strand.strand_id}
                          >
                            {strand.score}
                          </Text>
                        );
                      })}
                    </View>
                    {/* First teacher remark */}
                    {subj.strands.find((st) => st.teacher_remarks) && (
                      <Text style={s.teacherRemark}>
                        {
                          subj.strands.find((st) => st.teacher_remarks)!
                            .teacher_remarks
                        }
                      </Text>
                    )}
                  </View>
                  <Text
                    style={[
                      s.subjectOverall,
                      { backgroundColor: sc.bg, color: sc.text },
                    ]}
                  >
                    {subj.overallScore}
                  </Text>
                </View>
              );
            })
          )}

          {/* ── Class Teacher Remarks ── */}
          <View style={s.sectionHeader}>
            <View style={s.sectionDot} />
            <Text style={s.sectionTitle}>Class Teacher Remarks</Text>
          </View>

          <View style={s.remarksBox}>
            <Text style={s.remarksLabel}>
              Remarks by {report.classTeacherName}
            </Text>
            {report.classTeacherRemarks ? (
              <Text style={s.remarksText}>{report.classTeacherRemarks}</Text>
            ) : (
              <Text style={s.remarksEmpty}>
                No remarks have been added for this term.
              </Text>
            )}
          </View>

          {/* ── Signature row ── */}
          <View style={s.sigRow}>
            <View style={s.sigBox}>
              <Text style={s.sigLabel}>Class Teacher</Text>
              <Text style={s.sigName}>{report.classTeacherName}</Text>
            </View>
            <View style={s.sigBox}>
              <Text style={s.sigLabel}>Head Teacher</Text>
              <Text style={s.sigName}>_______________________</Text>
            </View>
            <View style={s.sigBox}>
              <Text style={s.sigLabel}>Parent / Guardian</Text>
              <Text style={s.sigName}>_______________________</Text>
            </View>
          </View>

          {/* ── CBC Legend ── */}
          <View style={s.legend}>
            {(["EE", "ME", "AE", "BE"] as const).map((code) => {
              const c = SCORE_COLOR[code];
              return (
                <View key={code} style={s.legendItem}>
                  <View style={[s.legendDot, { backgroundColor: c.bg }]} />
                  <Text style={s.legendText}>
                    <Text style={{ fontFamily: "Helvetica-Bold" }}>{code}</Text>
                    {" — "}
                    {SCORE_LABEL[code]}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Footer ── */}
        <View style={s.footer}>
          <Text style={s.footerText}>
            Kibali Academy · Nairobi, Kenya · admin@kibali.ac.ke
          </Text>
          <Text style={s.footerText}>
            Generated:{" "}
            {new Date().toLocaleDateString("en-KE", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

// ── ReportCardPageOnly ────────────────────────────────────────────────────────
// Same content as ReportCardDocument but returns just the <Page>.
// Used by the bulk generator (/api/reports/generate) which wraps multiple
// students' pages inside a single <Document>.

export function ReportCardPageOnly(props: ReportCardProps) {
  const { student, report, subjects, attendance } = props;
  const { present, absent, late, total } = attendance;
  const rate = attRate(present, late, total);
  const attRateNum =
    total > 0 ? Math.round(((present + late) / total) * 100) : 0;

  return (
    <Page size="A4" style={s.page}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerTop}>
          <View style={s.schoolBadge}>
            <Text style={s.badgeText}>K</Text>
          </View>
          <View>
            <Text style={s.schoolName}>Kibali Academy</Text>
            <Text style={s.schoolSub}>CBC Competency-Based Curriculum</Text>
          </View>
        </View>
        <Text style={s.reportTitle}>Student Progress Report Card</Text>
        <View style={s.termBadge}>
          <Text style={s.termBadgeText}>
            Term {report.term} · Academic Year {report.academicYear} ·{" "}
            {student.grade}
          </Text>
        </View>
      </View>

      <View style={s.content}>
        {/* Student info */}
        <View style={s.infoCard}>
          <View style={s.infoCol}>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Student</Text>
              <Text style={s.infoValue}>{student.fullName}</Text>
            </View>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Grade</Text>
              <Text style={s.infoValue}>{student.grade}</Text>
            </View>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Gender</Text>
              <Text style={s.infoValue}>{student.gender ?? "—"}</Text>
            </View>
          </View>
          <View style={s.infoCol}>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Age</Text>
              <Text style={s.infoValue}>
                {calcAge(student.dateOfBirth)} years
              </Text>
            </View>
            {student.upiNumber && (
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>UPI No.</Text>
                <Text style={s.infoValue}>{student.upiNumber}</Text>
              </View>
            )}
            {student.readableId && (
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Adm. No.</Text>
                <Text style={s.infoValue}>{student.readableId}</Text>
              </View>
            )}
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Class Teacher</Text>
              <Text style={s.infoValue}>{report.classTeacherName}</Text>
            </View>
          </View>
        </View>

        {/* Attendance */}
        <View style={s.sectionHeader}>
          <View style={s.sectionDot} />
          <Text style={s.sectionTitle}>Attendance</Text>
        </View>
        <View style={s.attGrid}>
          {[
            {
              label: "Present",
              value: present,
              bg: C.emeraldLight,
              text: C.emeraldDark,
            },
            {
              label: "Absent",
              value: absent,
              bg: C.roseLight,
              text: "#991b1b",
            },
            { label: "Late", value: late, bg: C.amberLight, text: "#92400e" },
            {
              label: "Total Days",
              value: total,
              bg: C.slate100,
              text: C.slate600,
            },
            { label: "Rate", value: rate, bg: C.skyLight, text: "#075985" },
          ].map(({ label, value, bg, text }) => (
            <View key={label} style={[s.attBox, { backgroundColor: bg }]}>
              <Text style={[s.attValue, { color: text }]}>{value}</Text>
              <Text style={[s.attLabel, { color: text }]}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Conduct & Effort */}
        {(report.conductGrade || report.effortGrade) && (
          <>
            <View style={s.sectionHeader}>
              <View style={s.sectionDot} />
              <Text style={s.sectionTitle}>Conduct & Effort</Text>
            </View>
            <View style={s.conductGrid}>
              <View style={s.conductBox}>
                <Text style={s.conductLabel}>Conduct</Text>
                <Text style={s.conductValue}>
                  {report.conductGrade ?? "Not graded"}
                </Text>
              </View>
              <View style={s.conductBox}>
                <Text style={s.conductLabel}>Effort</Text>
                <Text style={s.conductValue}>
                  {report.effortGrade ?? "Not graded"}
                </Text>
              </View>
            </View>
          </>
        )}

        {/* Subject results */}
        <View style={s.sectionHeader}>
          <View style={s.sectionDot} />
          <Text style={s.sectionTitle}>
            Subject Results ({subjects.length} subjects)
          </Text>
        </View>
        {subjects.length === 0 ? (
          <View
            style={[
              s.remarksBox,
              { backgroundColor: C.amberLight, borderColor: "#fde68a" },
            ]}
          >
            <Text style={[s.remarksText, { color: "#92400e" }]}>
              No subject assessments recorded for this term.
            </Text>
          </View>
        ) : (
          subjects.map((subj) => {
            const sc = SCORE_COLOR[subj.overallScore] ?? SCORE_COLOR.ME;
            return (
              <View key={subj.name} style={s.subjectRow}>
                <View style={{ flex: 3 }}>
                  <Text style={s.subjectName}>{subj.name}</Text>
                  <View style={s.strandPills}>
                    {subj.strands.map((strand) => {
                      const ssc = SCORE_COLOR[strand.score] ?? SCORE_COLOR.ME;
                      return (
                        <Text
                          key={strand.strand_id}
                          style={[
                            s.strandPill,
                            { backgroundColor: ssc.bg, color: ssc.text },
                          ]}
                        >
                          {strand.score}
                        </Text>
                      );
                    })}
                  </View>
                  {subj.strands.find((st) => st.teacher_remarks) && (
                    <Text style={s.teacherRemark}>
                      "
                      {
                        subj.strands.find((st) => st.teacher_remarks)!
                          .teacher_remarks
                      }
                      "
                    </Text>
                  )}
                </View>
                <Text
                  style={[
                    s.subjectOverall,
                    { backgroundColor: sc.bg, color: sc.text },
                  ]}
                >
                  {subj.overallScore}
                </Text>
              </View>
            );
          })
        )}

        {/* Remarks */}
        <View style={s.sectionHeader}>
          <View style={s.sectionDot} />
          <Text style={s.sectionTitle}>Class Teacher Remarks</Text>
        </View>
        <View style={s.remarksBox}>
          <Text style={s.remarksLabel}>
            Remarks by {report.classTeacherName}
          </Text>
          {report.classTeacherRemarks ? (
            <Text style={s.remarksText}>{report.classTeacherRemarks}</Text>
          ) : (
            <Text style={s.remarksEmpty}>
              No remarks have been added for this term.
            </Text>
          )}
        </View>

        {/* Signatures */}
        <View style={s.sigRow}>
          <View style={s.sigBox}>
            <Text style={s.sigLabel}>Class Teacher</Text>
            <Text style={s.sigName}>{report.classTeacherName}</Text>
          </View>
          <View style={s.sigBox}>
            <Text style={s.sigLabel}>Head Teacher</Text>
            <Text style={s.sigName}>_______________________</Text>
          </View>
          <View style={s.sigBox}>
            <Text style={s.sigLabel}>Parent / Guardian</Text>
            <Text style={s.sigName}>_______________________</Text>
          </View>
        </View>

        {/* CBC legend */}
        <View style={s.legend}>
          {(["EE", "ME", "AE", "BE"] as const).map((code) => {
            const c = SCORE_COLOR[code];
            return (
              <View key={code} style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: c.bg }]} />
                <Text style={s.legendText}>
                  <Text style={{ fontFamily: "Helvetica-Bold" }}>{code}</Text>
                  {" — "}
                  {SCORE_LABEL[code]}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Footer */}
      <View style={s.footer}>
        <Text style={s.footerText}>
          Kibali Academy · Nairobi, Kenya · admin@kibali.ac.ke
        </Text>
        <Text style={s.footerText}>
          Generated:{" "}
          {new Date().toLocaleDateString("en-KE", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </Text>
      </View>
    </Page>
  );
}
