#!/usr/bin/env python3
"""
Kibali Academy – CBC Report Card Generator
Called from the Next.js API route via child_process.
Reads student+assessment JSON from stdin, writes PDF bytes to stdout.

Input JSON shape:
{
  "students": [
    {
      "full_name": str, "readable_id": str|null, "date_of_birth": str,
      "gender": str|null, "current_grade": str,
      "parent_name": str|null, "parent_phone": str|null,
      "assessments": [
        { "subject_name": str, "strand_id": str, "score": str,
          "teacher_remarks": str|null, "teacher_name": str|null,
          "term": int, "academic_year": int }
      ]
    }
  ],
  "term": int,
  "academic_year": int,
  "mode": "bulk" | "single"
}

Output: PDF bytes written to stdout (single student = one report,
        bulk = merged PDF one page per student).
"""

import sys
import io
import json
from datetime import date
from collections import defaultdict

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak,
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import Flowable
from pypdf import PdfWriter, PdfReader

# ── Colours ───────────────────────────────────────────────────────────────────
DARK        = colors.HexColor("#0D1117")
ACCENT_GOLD = colors.HexColor("#C8A84B")
ACCENT_GRN  = colors.HexColor("#1A4A3A")
MID_GRAY    = colors.HexColor("#6B7280")
LIGHT_GRAY  = colors.HexColor("#F3F4F6")
BORDER      = colors.HexColor("#E5E7EB")
WHITE       = colors.white

SCORE_COLORS = {
    "EE": ("#166534", "#DCFCE7"),
    "ME": ("#1D4ED8", "#DBEAFE"),
    "AE": ("#92400E", "#FEF3C7"),
    "BE": ("#991B1B", "#FEE2E2"),
}
SCORE_LABELS = {
    "EE": "Exceeds Expectation",
    "ME": "Meets Expectation",
    "AE": "Approaching Expectation",
    "BE": "Below Expectation",
}

W, H = A4


# ── Helpers ───────────────────────────────────────────────────────────────────

def S(name: str, **kw) -> ParagraphStyle:
    defaults = dict(fontName="Helvetica", fontSize=9, leading=13,
                    textColor=DARK, spaceAfter=0, spaceBefore=0)
    defaults.update(kw)
    return ParagraphStyle(name, **defaults)


class FilledRect(Flowable):
    def __init__(self, w: float, h: float, fill, text: str = "", style=None):
        super().__init__()
        self.w, self.h, self.fill = w, h, fill
        self.text, self.style = text, style
        self.width, self.height = w, h

    def draw(self) -> None:
        c = self.canv
        c.setFillColor(self.fill)
        c.rect(0, 0, self.w, self.h, fill=1, stroke=0)
        if self.text and self.style:
            c.setFillColor(self.style.textColor)
            c.setFont(self.style.fontName, self.style.fontSize)
            c.drawString(8, self.h / 2 - self.style.fontSize / 3, self.text)


def score_badge(score: str) -> Paragraph:
    if score not in SCORE_COLORS:
        return Paragraph(score or "—", S("fallback", fontSize=8))
    fg, bg = SCORE_COLORS[score]
    return Paragraph(
        score,
        S(f"b_{score}", fontName="Helvetica-Bold", fontSize=8,
          textColor=colors.HexColor(fg),
          backColor=colors.HexColor(bg),
          borderPadding=(2, 5, 2, 5),
          alignment=TA_CENTER),
    )


def fmt_date(d: str) -> str:
    try:
        return date.fromisoformat(d).strftime("%d %B %Y")
    except Exception:
        return d or "—"


# ── Single report card ────────────────────────────────────────────────────────

def build_report_card(student: dict, term: int, academic_year: int) -> bytes:
    buf = io.BytesIO()
    margin = 14 * mm
    cw = W - 2 * margin

    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=margin, rightMargin=margin,
        topMargin=11 * mm, bottomMargin=11 * mm,
        title=f"CBC Report – {student.get('full_name', '')}",
        author="Kibali Academy",
    )
    story: list = []

    # ── Header ────────────────────────────────────────────────────────────────
    hdr = Table([[
        Paragraph("KA", S("logo", fontName="Helvetica-Bold", fontSize=22,
                           textColor=ACCENT_GOLD, alignment=TA_CENTER)),
        [
            Paragraph("KIBALI ACADEMY",
                      S("sch", fontName="Helvetica-Bold", fontSize=17, leading=20,
                        textColor=ACCENT_GRN, alignment=TA_CENTER)),
            Paragraph("Competency-Based Curriculum · Nairobi, Kenya",
                      S("sub", fontSize=8, textColor=MID_GRAY, alignment=TA_CENTER)),
            Paragraph("Tel: +254 700 000 000  ·  admin@kibali.ac.ke",
                      S("contact", fontSize=7.5, textColor=MID_GRAY, alignment=TA_CENTER)),
        ],
        Paragraph(f"Term {term}<br/><b>{academic_year}</b>",
                  S("yr", fontSize=9, textColor=ACCENT_GRN, alignment=TA_RIGHT,
                    fontName="Helvetica")),
    ]], colWidths=[16 * mm, cw - 38 * mm, 22 * mm])
    hdr.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(hdr)
    story.append(HRFlowable(width=cw, thickness=1.5, color=ACCENT_GOLD, spaceAfter=5))

    # ── Banner ────────────────────────────────────────────────────────────────
    term_label = {1: "Term One", 2: "Term Two", 3: "Term Three"}.get(term, f"Term {term}")
    story.append(FilledRect(cw, 15, ACCENT_GRN,
                             f"STUDENT PROGRESS REPORT CARD  ·  {term_label.upper()}  ·  {academic_year}",
                             S("bh", fontName="Helvetica-Bold", fontSize=8.5, textColor=WHITE)))
    story.append(Spacer(1, 6))

    # ── Student details ───────────────────────────────────────────────────────
    dw = [26 * mm, cw / 2 - 26 * mm, 26 * mm, cw / 2 - 26 * mm]
    details_rows = [
        ["Student Name:", student.get("full_name") or "—",
         "Student ID:", student.get("readable_id") or "—"],
        ["Date of Birth:", fmt_date(student.get("date_of_birth", "")),
         "Gender:", student.get("gender") or "—"],
        ["Grade / Class:", student.get("current_grade") or "—",
         "Parent:", student.get("parent_name") or "—"],
        ["Parent Phone:", student.get("parent_phone") or "—",
         "Report Date:", date.today().strftime("%d %B %Y")],
    ]
    dt = Table(details_rows, colWidths=dw)
    dt.setStyle(TableStyle([
        ("FONTNAME",     (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME",     (2, 0), (2, -1), "Helvetica-Bold"),
        ("TEXTCOLOR",    (0, 0), (0, -1), ACCENT_GRN),
        ("TEXTCOLOR",    (2, 0), (2, -1), ACCENT_GRN),
        ("FONTSIZE",     (0, 0), (-1, -1), 8.5),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [LIGHT_GRAY, WHITE]),
        ("TOPPADDING",   (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 3.5),
        ("LEFTPADDING",  (0, 0), (-1, -1), 6),
        ("GRID",         (0, 0), (-1, -1), 0.3, BORDER),
    ]))
    story.append(dt)
    story.append(Spacer(1, 8))

    # ── CBC Legend ────────────────────────────────────────────────────────────
    leg = []
    for code, (fg, bg) in SCORE_COLORS.items():
        leg.append(Paragraph(f"<b>{code}</b>",
                             S(f"l_{code}", fontSize=7,
                               textColor=colors.HexColor(fg),
                               backColor=colors.HexColor(bg),
                               borderPadding=(1, 4, 1, 4),
                               alignment=TA_CENTER)))
        leg.append(Paragraph(SCORE_LABELS[code],
                             S(f"lt_{code}", fontSize=7, textColor=MID_GRAY)))

    leg_t = Table([leg], colWidths=[11 * mm, 42 * mm] * 4)
    leg_t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    story.append(leg_t)
    story.append(Spacer(1, 8))

    # ── Assessments ───────────────────────────────────────────────────────────
    story.append(FilledRect(cw, 14, ACCENT_GRN, "SUBJECT ASSESSMENTS",
                             S("ah", fontName="Helvetica-Bold", fontSize=8.5, textColor=WHITE)))
    story.append(Spacer(1, 4))

    assessments: list[dict] = student.get("assessments", [])

    if not assessments:
        story.append(Paragraph("No assessments recorded for this term.",
                               S("na", fontSize=8, textColor=MID_GRAY)))
    else:
        by_subject: dict[str, list] = defaultdict(list)
        for a in assessments:
            by_subject[a.get("subject_name", "Unknown")].append(a)

        header_row = [
            Paragraph("<b>Subject / Strand</b>",
                      S("th", fontSize=8, textColor=WHITE, fontName="Helvetica-Bold")),
            Paragraph("<b>Score</b>",
                      S("th2", fontSize=8, textColor=WHITE, fontName="Helvetica-Bold",
                        alignment=TA_CENTER)),
            Paragraph("<b>Remarks</b>",
                      S("th3", fontSize=8, textColor=WHITE, fontName="Helvetica-Bold")),
            Paragraph("<b>Teacher</b>",
                      S("th4", fontSize=8, textColor=WHITE, fontName="Helvetica-Bold")),
        ]
        rows = [header_row]

        for subj, entries in by_subject.items():
            rows.append([
                Paragraph(f"<b>{subj}</b>",
                          S(f"sn", fontName="Helvetica-Bold", fontSize=8, textColor=ACCENT_GRN)),
                "", "", "",
            ])
            for e in entries:
                strand = (e.get("strand_id") or "").replace("-", " ").title()
                rows.append([
                    Paragraph(f"  {strand}",
                              S("st", fontSize=8, textColor=MID_GRAY, leftIndent=8)),
                    score_badge(e.get("score", "—")),
                    Paragraph(e.get("teacher_remarks") or "—",
                              S("rm", fontSize=7.5, leading=10, textColor=DARK)),
                    Paragraph(e.get("teacher_name") or "—",
                              S("tn", fontSize=7.5, textColor=MID_GRAY)),
                ])

        col_w = [cw * 0.32, 18 * mm, cw * 0.41, cw * 0.17]
        tbl = Table(rows, colWidths=col_w, repeatRows=1)
        ts = [
            ("BACKGROUND",   (0, 0), (-1, 0), ACCENT_GRN),
            ("TEXTCOLOR",    (0, 0), (-1, 0), WHITE),
            ("FONTSIZE",     (0, 0), (-1, -1), 8),
            ("TOPPADDING",   (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING",(0, 0), (-1, -1), 3),
            ("LEFTPADDING",  (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("VALIGN",       (0, 0), (-1, -1), "TOP"),
            ("ALIGN",        (1, 0), (1, -1), "CENTER"),
            ("GRID",         (0, 0), (-1, -1), 0.3, BORDER),
            ("LINEBELOW",    (0, 0), (-1, -1), 0.3, BORDER),
        ]
        for i in range(2, len(rows)):
            if i % 2 == 0:
                ts.append(("BACKGROUND", (0, i), (-1, i), LIGHT_GRAY))
        tbl.setStyle(TableStyle(ts))
        story.append(tbl)

    story.append(Spacer(1, 10))

    # ── Performance summary ───────────────────────────────────────────────────
    story.append(FilledRect(cw, 14, ACCENT_GRN, "PERFORMANCE SUMMARY",
                             S("ps", fontName="Helvetica-Bold", fontSize=8.5, textColor=WHITE)))
    story.append(Spacer(1, 4))

    counts: dict[str, int] = {k: 0 for k in SCORE_COLORS}
    for a in assessments:
        s = a.get("score", "")
        if s in counts:
            counts[s] += 1
    total = sum(counts.values()) or 1

    perf_rows = [
        [Paragraph(f"<b>{code}</b>  –  {SCORE_LABELS[code]}",
                   S(f"p_{code}", fontSize=8,
                     textColor=colors.HexColor(SCORE_COLORS[code][0]))),
         Paragraph(f"{cnt} strand{'s' if cnt != 1 else ''}",
                   S("pc", fontSize=8)),
         Paragraph(f"{cnt / total * 100:.0f}%",
                   S("pp", fontSize=8, alignment=TA_RIGHT))]
        for code, cnt in counts.items()
    ]
    pt = Table(perf_rows, colWidths=[cw * 0.56, cw * 0.25, cw * 0.19])
    pt.setStyle(TableStyle([
        ("TOPPADDING",    (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING",   (0, 0), (-1, -1), 6),
        ("ROWBACKGROUNDS",(0, 0), (-1, -1), [WHITE, LIGHT_GRAY]),
        ("LINEBELOW",     (0, 0), (-1, -1), 0.3, BORDER),
        ("ALIGN",         (2, 0), (2, -1), "RIGHT"),
    ]))
    story.append(pt)
    story.append(Spacer(1, 12))

    # ── Signatures ────────────────────────────────────────────────────────────
    sig_t = Table([[
        [Paragraph("Class Teacher:", S("sl", fontSize=7.5, textColor=MID_GRAY)),
         Spacer(1, 18),
         HRFlowable(width=50 * mm, thickness=0.5, color=MID_GRAY),
         Paragraph("Date: __________________", S("sd", fontSize=7.5, textColor=MID_GRAY))],
        [Paragraph("Head Teacher:", S("sl2", fontSize=7.5, textColor=MID_GRAY)),
         Spacer(1, 18),
         HRFlowable(width=50 * mm, thickness=0.5, color=MID_GRAY),
         Paragraph("Date: __________________", S("sd2", fontSize=7.5, textColor=MID_GRAY))],
        [Paragraph("Parent / Guardian:", S("sl3", fontSize=7.5, textColor=MID_GRAY)),
         Spacer(1, 18),
         HRFlowable(width=50 * mm, thickness=0.5, color=MID_GRAY),
         Paragraph("Date: __________________", S("sd3", fontSize=7.5, textColor=MID_GRAY))],
    ]], colWidths=[cw / 3] * 3)
    sig_t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(sig_t)
    story.append(Spacer(1, 6))

    # ── Footer ────────────────────────────────────────────────────────────────
    story.append(HRFlowable(width=cw, thickness=0.5, color=BORDER, spaceAfter=3))
    story.append(Paragraph(
        "Kibali Academy  ·  CBC School Management System  ·  Confidential – For addressee only",
        S("foot", fontSize=7, textColor=MID_GRAY, alignment=TA_CENTER),
    ))

    doc.build(story)
    return buf.getvalue()


# ── Bulk merge ────────────────────────────────────────────────────────────────

def build_bulk_pdf(students: list[dict], term: int, academic_year: int) -> bytes:
    writer = PdfWriter()
    for student in students:
        single_bytes = build_report_card(student, term, academic_year)
        reader = PdfReader(io.BytesIO(single_bytes))
        for page in reader.pages:
            writer.add_page(page)
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    raw = sys.stdin.buffer.read()
    payload = json.loads(raw)

    students: list[dict] = payload.get("students", [])
    term: int = payload.get("term", 1)
    academic_year: int = payload.get("academic_year", 2026)
    mode: str = payload.get("mode", "bulk")

    if not students:
        sys.stderr.write("ERROR: no students provided\n")
        sys.exit(1)

    if mode == "single":
        pdf_bytes = build_report_card(students[0], term, academic_year)
    else:
        pdf_bytes = build_bulk_pdf(students, term, academic_year)

    sys.stdout.buffer.write(pdf_bytes)


if __name__ == "__main__":
    main()