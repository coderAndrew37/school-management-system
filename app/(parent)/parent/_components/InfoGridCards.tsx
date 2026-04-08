import { BookOpen, Image, MessageSquare, TrendingUp } from "lucide-react";
import Link from "next/link";
import type { ChildWithAssessments } from "@/lib/types/parent";
import { SCORE_COLORS } from "./parent.config";

// ── Latest Diary Card ─────────────────────────────────────────────────────────

type DiaryEntry = NonNullable<ReturnType<typeof Array.prototype.at>> & {
  title: string;
  content: string;
  diary_date: string;
  author_name: string;
  subject_name?: string | null;
  homework?: string | null;
};

interface DiaryCardProps {
  entry: DiaryEntry | null;
}

export function LatestDiaryCard({ entry }: DiaryCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-amber-500" />
          <p className="text-sm font-black text-slate-800">Latest Diary</p>
        </div>
        <Link href="/parent/diary" className="text-xs font-bold text-blue-600 hover:text-blue-700">
          View all →
        </Link>
      </div>

      {entry ? (
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-bold text-slate-700 leading-snug">
              {entry.title}
            </p>
            {entry.subject_name && (
              <span className="shrink-0 text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-100 rounded-lg px-2 py-0.5">
                {entry.subject_name}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
            {entry.content}
          </p>
          {entry.homework && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-amber-600 mb-1">
                📚 Homework
              </p>
              <p className="text-xs text-amber-800 leading-relaxed line-clamp-2">
                {entry.homework}
              </p>
            </div>
          )}
          <p className="text-[10px] text-slate-400">
            {new Date(entry.diary_date + "T00:00:00").toLocaleDateString("en-KE", {
              day: "numeric",
              month: "long",
            })}
            {" · "}
            {entry.author_name}
          </p>
        </div>
      ) : (
        <div className="py-6 text-center">
          <p className="text-2xl mb-1">📔</p>
          <p className="text-xs text-slate-400">No diary entries yet</p>
        </div>
      )}
    </div>
  );
}

// ── Recent Grades Card ────────────────────────────────────────────────────────

interface GradesCardProps {
  assessments: ChildWithAssessments["assessments"];
}

export function RecentGradesCard({ assessments }: GradesCardProps) {
  const latest = assessments
    .filter((a) => a.score)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, 4);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-blue-500" />
          <p className="text-sm font-black text-slate-800">Recent Grades</p>
        </div>
        <Link href="/parent/academics" className="text-xs font-bold text-blue-600 hover:text-blue-700">
          Full report →
        </Link>
      </div>

      {latest.length > 0 ? (
        <div className="space-y-2.5">
          {latest.map((a) => (
            <div key={a.id} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-700 truncate">
                  {a.subject_name}
                </p>
                <p className="text-[10px] text-slate-400 truncate">
                  {a.strand_id}
                </p>
              </div>
              <span
                className={`text-xs font-black px-2.5 py-1 rounded-xl border shrink-0 ${
                  a.score
                    ? SCORE_COLORS[a.score]
                    : "bg-slate-100 text-slate-400 border-slate-200"
                }`}
              >
                {a.score ?? "—"}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-6 text-center">
          <p className="text-2xl mb-1">📊</p>
          <p className="text-xs text-slate-400">No assessments recorded yet</p>
        </div>
      )}
    </div>
  );
}

// ── Messages Card ─────────────────────────────────────────────────────────────

type Message = {
  id: string;
  is_read: boolean;
  sender_role: string;
  sender_name: string;
  subject?: string | null;
  body: string;
};

interface MessagesCardProps {
  messages: Message[];
}

export function MessagesCard({ messages }: MessagesCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-emerald-500" />
          <p className="text-sm font-black text-slate-800">Messages</p>
        </div>
        <Link href="/parent/messages" className="text-xs font-bold text-blue-600 hover:text-blue-700">
          View all →
        </Link>
      </div>

      {messages.length > 0 ? (
        <div className="space-y-2.5">
          {messages.slice(0, 3).map((m) => (
            <div
              key={m.id}
              className={`rounded-xl border p-3 ${
                !m.is_read && m.sender_role !== "parent"
                  ? "bg-emerald-50 border-emerald-100"
                  : "bg-slate-50 border-slate-100"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wide">
                  {m.sender_name}
                </span>
                {!m.is_read && m.sender_role !== "parent" && (
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                )}
              </div>
              {m.subject && (
                <p className="text-xs font-bold text-slate-700 mb-0.5">
                  {m.subject}
                </p>
              )}
              <p className="text-xs text-slate-500 line-clamp-2">{m.body}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-6 text-center">
          <p className="text-2xl mb-1">💬</p>
          <p className="text-xs text-slate-400">No messages yet</p>
        </div>
      )}
    </div>
  );
}

// ── Gallery Card ──────────────────────────────────────────────────────────────

type GalleryItem = {
  id: string;
  title: string;
  media_url: string;
  signedUrl?: string | null;
};

interface GalleryCardProps {
  items: GalleryItem[];
}

export function GalleryCard({ items }: GalleryCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Image className="h-4 w-4 text-purple-500" />
          <p className="text-sm font-black text-slate-800">Gallery</p>
        </div>
        <Link href="/parent/gallery" className="text-xs font-bold text-blue-600 hover:text-blue-700">
          View all →
        </Link>
      </div>

      {items.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {items.slice(0, 6).map((item) => {
            const src = item.signedUrl || item.media_url;
            return (
              <Link key={item.id} href="/parent/gallery">
                <div className="aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={src}
                      alt={item.title}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <Image className="h-6 w-6" />
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="py-6 text-center">
          <p className="text-2xl mb-1">🖼️</p>
          <p className="text-xs text-slate-400">No gallery items yet</p>
        </div>
      )}
    </div>
  );
}