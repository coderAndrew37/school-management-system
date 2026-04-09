"use client";
// ============================================================
// components/admin/transfers/TransferCenter.tsx
// Transfer Center dashboard — Incoming + Outgoing with QR
// Note: QR generation uses qrcode.react (npm install qrcode.react)
//       QR scanning uses html5-qrcode (npm install html5-qrcode)
//       Both are dynamically imported to avoid SSR issues.
// ============================================================

import {
  approveInboundTransferAction,
  initiateOutboundTransferAction,
  rejectTransferAction,
} from "@/lib/actions/csl";
import type {
  DbTransferRequest,
  QRTransferPayload,
  TransferStatus,
  TransferStudentSnippet,
} from "@/types/csl";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  Clock,
  Loader2,
  Save,
  ScanLine,
  Search,
  X
} from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { QRScanner, TransferCard } from "./utils";

// ── Dynamic imports (no SSR) ──────────────────────────────────────────────────
// QRCodeSVG from qrcode.react — renders a student's transfer QR code
const QRCodeSVG = dynamic(
  () => import("qrcode.react").then((m) => m.QRCodeSVG),
  {
    ssr: false,
    loading: () => (
      <div className="h-40 w-40 bg-white/5 rounded-xl animate-pulse" />
    ),
  },
);



// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  incoming: DbTransferRequest[];
  outgoing: DbTransferRequest[];
  schoolCode: string;
}

// ── Main component ────────────────────────────────────────────────────────────
export function TransferCenter({ incoming, outgoing, schoolCode }: Props) {
  const [tab, setTab] = useState<"incoming" | "outgoing" | "scanner">(
    "incoming",
  );
  const [search, setSearch] = useState("");
  const [scannedData, setScanned] = useState<QRTransferPayload | null>(null);
  const [isPending, startTrans] = useTransition();
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);

  const filtered = (tab === "incoming" ? incoming : outgoing).filter((r) => {
    const name = r.student?.full_name ?? r.scanned_qr_payload?.full_name ?? "";
    return (
      name.toLowerCase().includes(search.toLowerCase()) ||
      (r.source_upi ?? "").includes(search)
    );
  });

  const handleScanned = useCallback((payload: QRTransferPayload) => {
    setScanned(payload);
    toast.success(
      `Scanned: ${payload.full_name} from ${payload.current_school_code}`,
    );
  }, []);

  const submitScan = () => {
    if (!scannedData) return;
    startTrans(async () => {
      const res = await fetch("/api/transfers/inbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: scannedData }),
      });
      const data = (await res.json()) as { success: boolean; message: string };
      if (data.success) {
        toast.success(data.message);
        setScanned(null);
        setTab("incoming");
        refresh();
      } else {
        toast.error(data.message);
      }
    });
  };

  const pendingIn = incoming.filter((r) => r.status === "pending").length;
  const pendingOut = outgoing.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-5">
      {/* ── Tab bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-1.5 w-max">
        {(
          [
            {
              id: "incoming",
              label: "Incoming",
              Icon: ArrowDownLeft,
              count: pendingIn,
              color: "text-sky-400    bg-sky-400/10    border-sky-400/30",
            },
            {
              id: "outgoing",
              label: "Outgoing",
              Icon: ArrowUpRight,
              count: pendingOut,
              color: "text-amber-400  bg-amber-400/10  border-amber-400/30",
            },
            {
              id: "scanner",
              label: "QR Scanner",
              Icon: ScanLine,
              count: 0,
              color: "text-purple-400 bg-purple-400/10 border-purple-400/30",
            },
          ] as const
        ).map(({ id, label, Icon, count, color }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={[
              "flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all whitespace-nowrap",
              tab === id ? `border ${color}` : "text-white/40 hover:text-white",
            ].join(" ")}
          >
            <Icon className="h-3.5 w-3.5 flex-shrink-0" />
            {label}
            {count > 0 && (
              <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 text-white text-[9px] font-black px-1">
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── QR Scanner tab ───────────────────────────────────────────────── */}
      {tab === "scanner" && (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 space-y-5 max-w-sm mx-auto">
          <p className="text-xs font-black uppercase tracking-widest text-white/40 text-center">
            Scan Student Transfer QR
          </p>

          {!scannedData ? (
            <QRScanner onScanned={handleScanned} />
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/[0.06] p-4 space-y-2">
                <p className="text-xs font-black text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  QR Scanned Successfully
                </p>
                <div className="space-y-1 text-xs text-white/60">
                  <p>
                    <span className="text-white/35">Name:</span>{" "}
                    <strong className="text-white/80">
                      {scannedData.full_name}
                    </strong>
                  </p>
                  <p>
                    <span className="text-white/35">UPI:</span>{" "}
                    <strong className="text-white/80">
                      {scannedData.upi || "N/A"}
                    </strong>
                  </p>
                  <p>
                    <span className="text-white/35">Grade:</span>{" "}
                    <strong className="text-white/80">
                      {scannedData.current_grade}
                    </strong>
                  </p>
                  <p>
                    <span className="text-white/35">From:</span>{" "}
                    <strong className="text-white/80">
                      {scannedData.current_school_code}
                    </strong>
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={submitScan}
                  disabled={isPending}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 py-2.5 text-sm font-bold text-white transition-all active:scale-95"
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Create Inbound Request
                </button>
                <button
                  aria-label="Clear Scanned Data"
                  onClick={() => setScanned(null)}
                  className="px-3 rounded-xl border border-white/10 text-white/35 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Incoming / Outgoing tabs ──────────────────────────────────────── */}
      {tab !== "scanner" && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or UPI…"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] pl-9 pr-4 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-sky-400/40"
            />
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 py-12 text-center">
              <p className="text-sm text-white/30">No {tab} transfers</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((req) => (
                <TransferCard key={req.id} req={req} schoolCode={schoolCode} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
