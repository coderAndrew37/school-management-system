ParentPortalHub — the tab controller. Seven tabs with badge counts for unread items: Alerts, Diary, Attendance, Messages, Competencies, Gallery, Pathway. Scrollable on mobile, active tab highlighted in its own color.

NotificationsPanel — real-time notification inbox. Shows attendance alerts, diary posts, new messages, assessment results. Mark-all-read calls the server action, optimistically updates local state. Unread items glow with a sky-blue dot.

CommunicationBook — threaded messaging between parents and teachers. Messages group into threads by thread_id, each thread expands inline. Parents compose new messages with subject, category (general/academic/behaviour/health/pastoral/urgent), and body.
Reply form opens inside the thread. Timestamps rendered as relative time ("2h ago").

DiaryView — class diary entries for the child's grade. Filters by subject and "homework only". Overdue homework shown in rose, due-soon in amber, future homework in gentle amber. A banner at the top highlights any homework due within 3 days.

AttendancePanel (pre-existing, already built) — calendar view with monthly stats strip, day-by-day colour coding, and recent absences list.

CompetencyRadar (pre-existing, already built) — SVG radar chart across 8 CBC competency domains. Term selector, compare-with-previous toggle, per-domain bars with delta arrows.

TalentGallery — masonry-style media grid grouped by category (academic/sports/arts/leadership/social/general). Category filter pills at top. Clicking any item opens a full lightbox with image rendering, video player, or link for documents/audio. Skills tagged on each item are shown as chips.

JssPathwayPanel — JSS-only (hides for PP–Grade 6 with a clean message). Cluster picker (6 CBC pathway options with icons and career previews), interest area toggles, strong subjects toggles, career interests with custom add, learning style selector. Save button hits the server action which calls Claude to generate 80–110 word personalised career guidance and caches it, then displays it in a purple card at the top.
