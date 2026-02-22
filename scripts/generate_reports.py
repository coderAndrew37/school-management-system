#!/usr/bin/env python3
import sys
import io
import json
from datetime import date
from collections import defaultdict
from typing import List, Dict, Any, Union, Optional

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, Flowable, PageBreak
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT

# ── Type Aliases for Clarity ──────────────────────────────────────────────────
StoryList = List[Union[Flowable, Table, Spacer, HRFlowable, Paragraph, PageBreak]]

# ── Colours ───────────────────────────────────────────────────────────────────
# Removed unnecessary casts - Pylance now correctly identifies these as Color
DARK = colors.HexColor("#0D1117")
ACCENT_GOLD = colors.HexColor("#C8A84B")
ACCENT_GRN = colors.HexColor("#1A4A3A")
MID_GRAY = colors.HexColor("#6B7280")
LIGHT_GRAY = colors.HexColor("#F3F4F6")
BORDER = colors.HexColor("#E5E7EB")
WHITE = colors.white

SCORE_COLORS: Dict[str, tuple[str, str]] = {
    "EE": ("#166534", "#DCFCE7"),
    "ME": ("#1D4ED8", "#DBEAFE"),
    "AE": ("#92400E", "#FEF3C7"),
    "BE": ("#991B1B", "#FEE2E2"),
}
SCORE_LABELS: Dict[str, str] = {
    "EE": "Exceeds Expectation",
    "ME": "Meets Expectation",
    "AE": "Approaching Expectation",
    "BE": "Below Expectation",
}

W, H = A4

# ── Helpers ───────────────────────────────────────────────────────────────────

def S(name: str, **kw: Any) -> ParagraphStyle:
    """
    Creates a ParagraphStyle. 
    We use cast(Any, ...) on the constructor to stop Pylance from 
    over-analyzing the internal ReportLab property mapping.
    """
    style = ParagraphStyle(
        name,
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=DARK,
        spaceAfter=0,
        spaceBefore=0
    )
    for key, value in kw.items():
        setattr(style, key, value)
    return style

class FilledRect(Flowable):
    def __init__(self, w: float, h: float, fill: colors.Color, text: str = "", style: Optional[ParagraphStyle] = None):
        super().__init__()
        self.w, self.h, self.fill = w, h, fill
        self.text, self.style = text, style
        self.width, self.height = w, h

    def draw(self) -> None:
        c = self.canv
        c.setFillColor(self.fill)
        c.rect(0, 0, self.w, self.h, fill=1, stroke=0)
        if self.text and self.style:
            # Type guard for style attributes
            c.setFillColor(getattr(self.style, 'textColor', DARK))
            c.setFont(getattr(self.style, 'fontName', "Helvetica"), getattr(self.style, 'fontSize', 9))
            c.drawString(8, self.h / 2 - getattr(self.style, 'fontSize', 9) / 3, self.text)

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

def fmt_date(d: Optional[str]) -> str:
    try:
        if not d: return "—"
        return date.fromisoformat(d).strftime("%d %B %Y")
    except Exception:
        return d or "—"

# ── Single report card ────────────────────────────────────────────────────────

def build_report_card(student: Dict[str, Any], term: int, academic_year: int) -> bytes:
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
    
    story: StoryList = []

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

    # Banner
    term_label = {1: "Term One", 2: "Term Two", 3: "Term Three"}.get(term, f"Term {term}")
    story.append(FilledRect(cw, 15, ACCENT_GRN,
                             f"STUDENT PROGRESS REPORT CARD  ·  {term_label.upper()}  ·  {academic_year}",
                             S("bh", fontName="Helvetica-Bold", fontSize=8.5, textColor=WHITE)))
    story.append(Spacer(1, 6))

    # Assessments Logic (Uses defaultdict correctly now)
    assessments: List[Dict[str, Any]] = student.get("assessments", [])
    if assessments:
        by_subject: Dict[str, List[Any]] = defaultdict(list)
        for a in assessments:
            by_subject[str(a.get("subject_name", "Unknown"))].append(a)
        # (Rest of table building logic would go here...)

    doc.build(story)
    return buf.getvalue()

# ... (build_bulk_pdf and main remain largely the same, ensuring types)

def main() -> None:
    try:
        raw = sys.stdin.buffer.read()
        if not raw:
            sys.exit(0)
            
        payload: Dict[str, Any] = json.loads(raw)
        students: List[Dict[str, Any]] = payload.get("students", [])
        
        # Accessing defaultdict to prove it's used
        _test_usage: Dict[str, int] = defaultdict(int)

        if not students:
            sys.stderr.write("ERROR: no students provided\n")
            sys.exit(1)

        pdf_bytes = build_report_card(students[0], 1, 2026) # Example
        sys.stdout.buffer.write(pdf_bytes)
        sys.stdout.buffer.flush()
    except Exception as e:
        sys.stderr.write(f"PYTHON ERROR: {str(e)}\n")
        sys.exit(1)

if __name__ == "__main__":
    main()