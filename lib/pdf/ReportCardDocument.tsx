// lib/pdf/ReportCardDocument.tsx
// CBC Report Card — @react-pdf/renderer
// npm install @react-pdf/renderer

import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  Image,
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
    photoUrl?: string; // public URL from student-photos bucket
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
  school: {
    name: string;
    email: string;
    phone: string;
    logoUrl?: string; // public URL from school-assets bucket
  };
}

// ── Colours ───────────────────────────────────────────────────────────────────

const C = {
  green: "#065f46",
  greenMid: "#10b981",
  greenLight: "#d1fae5",
  greenBorder: "#a7f3d0",
  amber: "#92400e",
  amberLight: "#fef3c7",
  sky: "#075985",
  skyLight: "#e0f2fe",
  rose: "#991b1b",
  roseLight: "#fee2e2",
  s800: "#1e293b",
  s600: "#475569",
  s400: "#94a3b8",
  s200: "#e2e8f0",
  s100: "#f1f5f9",
  white: "#ffffff",
} as const;

const SCORE: Record<string, { bg: string; text: string }> = {
  EE: { bg: C.greenLight, text: C.green },
  ME: { bg: "#dbeafe", text: "#1e40af" },
  AE: { bg: C.amberLight, text: C.amber },
  BE: { bg: C.roseLight, text: C.rose },
};

const SCORE_FULL: Record<string, string> = {
  EE: "Exceeding Expectations",
  ME: "Meeting Expectations",
  AE: "Approaching Expectations",
  BE: "Below Expectations",
};

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    backgroundColor: C.white,
    paddingBottom: 24,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: C.s800,
  },

  // Header
  header: {
    backgroundColor: C.green,
    paddingHorizontal: 32,
    paddingTop: 22,
    paddingBottom: 18,
  },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 10,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  logoFallback: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 10,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  logoLetter: { color: C.white, fontSize: 18, fontFamily: "Helvetica-Bold" },
  schoolName: {
    color: C.white,
    fontSize: 17,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
  },
  schoolSub: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 7.5,
    marginTop: 2,
    letterSpacing: 1,
  },
  reportTitle: {
    color: C.white,
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginTop: 10,
    letterSpacing: 0.3,
  },
  termBadge: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
    marginTop: 5,
  },
  termBadgeText: {
    color: C.white,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
  },

  // Content
  content: { paddingHorizontal: 32, paddingTop: 18 },

  // Student info card
  infoCard: {
    backgroundColor: C.s100,
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
    flexDirection: "row",
    gap: 16,
  },
  infoCol: { flex: 1 },
  photoBox: {
    width: 52,
    height: 60,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: C.s200,
    marginRight: 12,
  },
  infoRow: { flexDirection: "row", marginBottom: 4 },
  infoLabel: {
    color: C.s400,
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    width: 68,
  },
  infoValue: {
    color: C.s800,
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    flex: 1,
  },

  // Section
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 7,
    marginTop: 13,
  },
  sectionDot: {
    width: 5,
    height: 5,
    backgroundColor: C.greenMid,
    borderRadius: 3,
    marginRight: 6,
  },
  sectionTitle: {
    color: C.s800,
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  // Subjects
  subjectRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.s200,
    borderRadius: 6,
    marginBottom: 4,
    padding: 7,
    gap: 6,
  },
  subjectName: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: C.s800,
    marginBottom: 3,
  },
  strandPills: { flexDirection: "row", gap: 3, flexWrap: "wrap" },
  pill: {
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
  },
  overall: {
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 3,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    minWidth: 22,
    textAlign: "center",
  },
  strandRemark: {
    fontSize: 7,
    color: C.s600,
    marginTop: 3,
    fontStyle: "italic",
  },

  // Attendance
  attGrid: { flexDirection: "row", gap: 6, marginBottom: 10 },
  attBox: { flex: 1, borderRadius: 7, padding: 9, alignItems: "center" },
  attVal: { fontSize: 15, fontFamily: "Helvetica-Bold" },
  attLbl: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 2,
  },

  // Conduct
  conductGrid: { flexDirection: "row", gap: 8, marginBottom: 10 },
  conductBox: {
    flex: 1,
    borderRadius: 7,
    padding: 9,
    backgroundColor: C.s100,
    borderWidth: 1,
    borderColor: C.s200,
  },
  conductLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: C.s400,
    marginBottom: 3,
  },
  conductValue: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.s800 },

  // Remarks
  remarksBox: {
    backgroundColor: C.greenLight,
    borderRadius: 7,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.greenBorder,
  },
  remarksLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: C.green,
    marginBottom: 4,
  },
  remarksText: { fontSize: 8.5, color: C.green, lineHeight: 1.6 },
  remarksEmpty: { fontSize: 8, color: C.s400, fontStyle: "italic" },

  // Signatures
  sigRow: { flexDirection: "row", marginTop: 18, gap: 14 },
  sigBox: { flex: 1, borderTopWidth: 1, borderTopColor: C.s400, paddingTop: 5 },
  sigLabel: {
    fontSize: 7,
    color: C.s600,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sigName: { fontSize: 8, color: C.s800, marginTop: 2 },

  // Legend
  legend: {
    flexDirection: "row",
    gap: 5,
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: C.s200,
    paddingTop: 9,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 3, flex: 1 },
  legendDot: { width: 7, height: 7, borderRadius: 3.5 },
  legendText: { fontSize: 7, color: C.s600 },

  // Footer
  footer: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: C.s200,
    paddingTop: 7,
    paddingHorizontal: 32,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 7, color: C.s400 },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcAge(dob: string): number {
  if (!dob) return 0;
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

// ── Content component (shared between single and bulk) ────────────────────────

function ReportContent({
  student,
  report,
  subjects,
  attendance,
  school,
}: ReportCardProps) {
  const { present, absent, late, total } = attendance;

  return (
    <>
      {/* ── Header ── */}
      <View style={s.header}>
        <View style={s.headerRow}>
          {school.logoUrl ? (
            <Image src={school.logoUrl} style={s.logo} />
          ) : (
            <View style={s.logoFallback}>
              <Text style={s.logoLetter}>
                {school.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View>
            <Text style={s.schoolName}>{school.name}</Text>
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
        {/* ── Student info ── */}
        <View style={s.infoCard}>
          {student.photoUrl && (
            <Image src={student.photoUrl} style={s.photoBox} />
          )}
          <View style={[s.infoCol, { flex: 2 }]}>
            {[
              ["Student", student.fullName],
              ["Grade / Class", student.grade],
              ["Gender", student.gender ?? "—"],
              ["Age", `${calcAge(student.dateOfBirth)} years`],
            ].map(([label, val]) => (
              <View key={label} style={s.infoRow}>
                <Text style={s.infoLabel}>{label}</Text>
                <Text style={s.infoValue}>{val}</Text>
              </View>
            ))}
          </View>
          <View style={s.infoCol}>
            {[
              ["Adm. No.", student.readableId ?? "—"],
              ["UPI No.", student.upiNumber ?? "—"],
              ["Class Teacher", report.classTeacherName],
            ].map(([label, val]) => (
              <View key={label} style={s.infoRow}>
                <Text style={s.infoLabel}>{label}</Text>
                <Text style={s.infoValue}>{val}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Attendance ── */}
        <View style={s.sectionHeader}>
          <View style={s.sectionDot} />
          <Text style={s.sectionTitle}>Attendance Summary</Text>
        </View>
        <View style={s.attGrid}>
          {[
            {
              label: "Present",
              value: present,
              bg: C.greenLight,
              text: C.green,
            },
            { label: "Absent", value: absent, bg: C.roseLight, text: C.rose },
            { label: "Late", value: late, bg: C.amberLight, text: C.amber },
            { label: "Total", value: total, bg: C.s100, text: C.s600 },
            {
              label: "Rate",
              value: attRate(present, late, total),
              bg: C.skyLight,
              text: C.sky,
            },
          ].map(({ label, value, bg, text }) => (
            <View key={label} style={[s.attBox, { backgroundColor: bg }]}>
              <Text style={[s.attVal, { color: text }]}>{value}</Text>
              <Text style={[s.attLbl, { color: text }]}>{label}</Text>
            </View>
          ))}
        </View>

        {/* ── Conduct & Effort ── */}
        {(report.conductGrade || report.effortGrade) && (
          <>
            <View style={s.sectionHeader}>
              <View style={s.sectionDot} />
              <Text style={s.sectionTitle}>Conduct &amp; Effort</Text>
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

        {/* ── Subject results ── */}
        <View style={s.sectionHeader}>
          <View style={s.sectionDot} />
          <Text style={s.sectionTitle}>
            Subject Results ({subjects.length} Subjects)
          </Text>
        </View>
        {subjects.length === 0 ? (
          <View
            style={[
              s.remarksBox,
              { backgroundColor: C.amberLight, borderColor: "#fde68a" },
            ]}
          >
            <Text style={[s.remarksText, { color: C.amber }]}>
              No subject assessments recorded for this term.
            </Text>
          </View>
        ) : (
          subjects.map((subj) => {
            const sc = SCORE[subj.overallScore] ?? SCORE.ME;
            const remark = subj.strands.find(
              (st) => st.teacher_remarks,
            )?.teacher_remarks;
            return (
              <View key={subj.name} style={s.subjectRow}>
                <View style={{ flex: 3 }}>
                  <Text style={s.subjectName}>{subj.name}</Text>
                  <View style={s.strandPills}>
                    {subj.strands.map((strand) => {
                      const ssc = SCORE[strand.score] ?? SCORE.ME;
                      return (
                        <Text
                          key={strand.strand_id}
                          style={[
                            s.pill,
                            { backgroundColor: ssc.bg, color: ssc.text },
                          ]}
                        >
                          {strand.score}
                        </Text>
                      );
                    })}
                  </View>
                  {remark && <Text style={s.strandRemark}>"{remark}"</Text>}
                </View>
                <Text
                  style={[
                    s.overall,
                    { backgroundColor: sc.bg, color: sc.text },
                  ]}
                >
                  {subj.overallScore}
                </Text>
              </View>
            );
          })
        )}

        {/* ── Class teacher remarks ── */}
        <View style={s.sectionHeader}>
          <View style={s.sectionDot} />
          <Text style={s.sectionTitle}>Class Teacher Remarks</Text>
        </View>
        <View style={s.remarksBox}>
          <Text style={s.remarksLabel}>{report.classTeacherName}</Text>
          {report.classTeacherRemarks ? (
            <Text style={s.remarksText}>{report.classTeacherRemarks}</Text>
          ) : (
            <Text style={s.remarksEmpty}>No remarks added for this term.</Text>
          )}
        </View>

        {/* ── Signature row ── */}
        <View style={s.sigRow}>
          {[
            { label: "Class Teacher", name: report.classTeacherName },
            { label: "Head Teacher", name: "_________________________" },
            { label: "Parent / Guardian", name: "_________________________" },
          ].map(({ label, name }) => (
            <View key={label} style={s.sigBox}>
              <Text style={s.sigLabel}>{label}</Text>
              <Text style={s.sigName}>{name}</Text>
            </View>
          ))}
        </View>

        {/* ── CBC Legend ── */}
        <View style={s.legend}>
          {(["EE", "ME", "AE", "BE"] as const).map((code) => {
            const c = SCORE[code];
            return (
              <View key={code} style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: c.bg }]} />
                <Text style={s.legendText}>
                  <Text style={{ fontFamily: "Helvetica-Bold" }}>{code}</Text> —{" "}
                  {SCORE_FULL[code]}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* ── Footer ── */}
      <View style={s.footer}>
        <Text style={s.footerText}>
          {school.name}
          {school.email ? ` · ${school.email}` : ""}
          {school.phone ? ` · ${school.phone}` : ""}
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
    </>
  );
}

// ── Exported documents ────────────────────────────────────────────────────────

export function ReportCardDocument(props: ReportCardProps) {
  return (
    <Document
      title={`${props.student.fullName} — Term ${props.report.term} Report`}
      author={props.school.name}
    >
      <Page size="A4" style={s.page}>
        <ReportContent {...props} />
      </Page>
    </Document>
  );
}

/** Used by bulk generate route — caller wraps multiple pages in a Document */
export function ReportCardPage(props: ReportCardProps) {
  return (
    <Page size="A4" style={s.page}>
      <ReportContent {...props} />
    </Page>
  );
}
