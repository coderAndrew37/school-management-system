"use client";
// ============================================================
// components/admin/transfers/TransferCenter.tsx
// Transfer Center dashboard — Incoming + Outgoing with QR
// Note: QR generation uses qrcode.react (npm install qrcode.react)
//       QR scanning uses html5-qrcode (npm install html5-qrcode)
//       Both are dynamically imported to avoid SSR issues.
// ============================================================

import { useState, useTransition, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import {
  QrCode,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  Clock,
  X,
  AlertTriangle,
  Search,
  Loader2,
  ChevronDown,
  Save,
  ScanLine,
  User,
} from "lucide-react";
import {
  approveInboundTransferAction,
  rejectTransferAction,
  initiateOutboundTransferAction,
} from "@/lib/actions/csl";
import type {
  DbTransferRequest,
  TransferStatus,
  QRTransferPayload,
  TransferStudentSnippet,
} from "@/types/csl";

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

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: TransferStatus }) {
  const cfg: Record<
    TransferStatus,
    { cls: string; icon: React.ReactNode; label: string }
  > = {
    pending: {
      cls: "border-amber-400/30 bg-amber-400/10 text-amber-400",
      icon: <Clock className="h-3 w-3" />,
      label: "Pending",
    },
    approved: {
      cls: "border-sky-400/30   bg-sky-400/10   text-sky-400",
      icon: <CheckCircle2 className="h-3 w-3" />,
      label: "Approved",
    },
    rejected: {
      cls: "border-rose-500/30  bg-rose-500/10  text-rose-400",
      icon: <X className="h-3 w-3" />,
      label: "Rejected",
    },
    completed: {
      cls: "border-emerald-400/30 bg-emerald-400/10 text-emerald-400",
      icon: <CheckCircle2 className="h-3 w-3" />,
      label: "Completed",
    },
  };
  const c = cfg[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${c.cls}`}
    >
      {c.icon}
      {c.label}
    </span>
  );
}

// ── QR Panel for a student going out ─────────────────────────────────────────
function StudentQRPanel({
  student,
  schoolCode,
}: {
  student: TransferStudentSnippet;
  schoolCode: string;
}) {
  const payload: QRTransferPayload = {
    upi: student.upi_number ?? "",
    assessment_number: null,
    full_name: student.full_name,
    current_grade: student.current_grade,
    current_school_code: schoolCode,
    generated_at: new Date().toISOString(),
  };
  const qrValue = JSON.stringify(payload);

  return (
    <div className="flex flex-col items-center gap-4 p-6 rounded-2xl border border-white/10 bg-white/[0.03]">
      <p className="text-xs font-black text-white/50 uppercase tracking-widest">
        Transfer QR Code
      </p>
      <div className="bg-white p-3 rounded-2xl shadow-xl">
        <QRCodeSVG value={qrValue} size={160} level="H" />
      </div>
      <div className="text-center space-y-0.5">
        <p className="text-sm font-bold text-white">{student.full_name}</p>
        <p className="text-xs text-white/40">
          {student.current_grade} · UPI: {student.upi_number ?? "N/A"}
        </p>
      </div>
      <p className="text-[10px] text-white/25 text-center leading-relaxed max-w-[200px]">
        Print and hand to student. Valid 30 days. Receiving school scans this to
        initiate inbound transfer.
      </p>
    </div>
  );
}

// ── QR Scanner using html5-qrcode ────────────────────────────────────────────
function QRScanner({
  onScanned,
}: {
  onScanned: (payload: QRTransferPayload) => void;
}) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startScan = useCallback(async () => {
    if (!scannerRef.current) return;
    setError(null);
    setScanning(true);

    try {
      // Dynamic import to avoid SSR
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-scanner-region");

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          try {
            const parsed = JSON.parse(decodedText) as QRTransferPayload;
            if (!parsed.upi || !parsed.current_school_code)
              throw new Error("Invalid QR");
            scanner.stop().catch(() => null);
            setScanning(false);
            onScanned(parsed);
          } catch {
            setError("QR code is not a valid student transfer code.");
          }
        },
        () => null, // suppress frame errors
      );
    } catch {
      setScanning(false);
      setError("Camera access denied or scanner unavailable.");
    }
  }, [onScanned]);

  return (
    <div className="space-y-3">
      <div
        id="qr-scanner-region"
        ref={scannerRef}
        className="w-full aspect-square max-w-[280px] mx-auto rounded-2xl overflow-hidden border border-white/10 bg-black"
      />
      {error && <p className="text-xs text-rose-400 text-center">{error}</p>}
      {!scanning && (
        <button
          onClick={startScan}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-sky-500 hover:bg-sky-400 py-2.5 text-sm font-bold text-white transition-all active:scale-95"
        >
          <ScanLine className="h-4 w-4" />
          Start Camera Scan
        </button>
      )}
      {scanning && (
        <p className="text-xs text-sky-400 text-center animate-pulse">
          Scanning… point camera at QR code
        </p>
      )}
    </div>
  );
}

// ── Outbound initiation form ──────────────────────────────────────────────────
function OutboundForm({
  student,
  onSubmitted,
}: {
  student: TransferStudentSnippet;
  onSubmitted: () => void;
}) {
  const [dest, setDest] = useState("");
  const [reason, setReason] = useState("");
  const [isPending, startTrans] = useTransition();

  const submit = () => {
    if (!dest.trim() || !reason.trim()) {
      toast.error("Fill in destination school and reason.");
      return;
    }
    const fd = new FormData();
    fd.append("studentId", student.id);
    fd.append("destinationSchool", dest);
    fd.append("reason", reason);
    startTrans(async () => {
      const res = await initiateOutboundTransferAction(fd);
      if (res.success) {
        toast.success(res.message);
        onSubmitted();
      } else toast.error(res.message);
    });
  };

  return (
    <div className="space-y-3">
      <input
        value={dest}
        onChange={(e) => setDest(e.target.value)}
        placeholder="Destination school name"
        className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-amber-400/40 transition"
      />
      <textarea
        rows={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason for transfer…"
        className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-amber-400/40 resize-none transition"
      />
      <button
        onClick={submit}
        disabled={isPending}
        className="flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 px-4 py-2.5 text-sm font-bold text-white transition-all active:scale-95"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ArrowUpRight className="h-4 w-4" />
        )}
        Initiate Transfer Out
      </button>
    </div>
  );
}

// ── Transfer request card ─────────────────────────────────────────────────────
function TransferCard({
  req,
  schoolCode,
}: {
  req: DbTransferRequest;
  schoolCode: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTrans] = useTransition();
  const [rejectNote, setNote] = useState("");
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);

  const approve = () => {
    if (!req.student_id) {
      toast.error("No student_id on this request.");
      return;
    }
    startTrans(async () => {
      const res = await approveInboundTransferAction(req.id, req.student_id!);
      if (res.success) {
        toast.success(res.message);
        refresh();
      } else toast.error(res.message);
    });
  };

  const reject = () => {
    startTrans(async () => {
      const res = await rejectTransferAction(req.id, rejectNote);
      if (res.success) {
        toast.success(res.message);
        refresh();
      } else toast.error(res.message);
    });
  };

  const isInbound = req.direction === "inbound";
  const scanned = req.scanned_qr_payload;

  return (
    <div
      className={`rounded-2xl border overflow-hidden transition-all ${
        isInbound
          ? "border-sky-400/15 bg-sky-400/[0.03]"
          : "border-amber-400/15 bg-amber-400/[0.03]"
      }`}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
      >
        <div
          className={`flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-xl ${
            isInbound
              ? "bg-sky-400/10 border border-sky-400/20"
              : "bg-amber-400/10 border border-amber-400/20"
          }`}
        >
          {isInbound ? (
            <ArrowDownLeft className={`h-4 w-4 text-sky-400`} />
          ) : (
            <ArrowUpRight className={`h-4 w-4 text-amber-400`} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">
            {isInbound
              ? (scanned?.full_name ??
                req.student?.full_name ??
                "Unknown student")
              : (req.student?.full_name ?? "—")}
          </p>
          <p className="text-[10px] text-white/35 mt-0.5">
            {isInbound
              ? `From: ${req.source_school_code ?? "—"} · UPI: ${req.source_upi ?? "—"}`
              : `To: ${req.destination_school ?? "—"}`}
          </p>
        </div>
        <StatusBadge status={req.status} />
        <ChevronDown
          className={`h-4 w-4 text-white/25 flex-shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-white/[0.06] pt-4 space-y-3">
          {/* Details */}
          <div className="grid grid-cols-2 gap-2 text-xs text-white/45">
            <span>
              Grade:{" "}
              <strong className="text-white/70">
                {scanned?.current_grade ?? req.student?.current_grade ?? "—"}
              </strong>
            </span>
            <span>
              Created:{" "}
              <strong className="text-white/70">
                {new Date(req.created_at).toLocaleDateString("en-KE")}
              </strong>
            </span>
            {req.reason && (
              <span className="col-span-2">
                Reason: <strong className="text-white/70">{req.reason}</strong>
              </span>
            )}
            {req.notes && (
              <span className="col-span-2">
                Notes: <strong className="text-white/70">{req.notes}</strong>
              </span>
            )}
          </div>

          {/* QR code for outbound */}
          {!isInbound && req.student && req.status === "pending" && (
            <StudentQRPanel student={req.student} schoolCode={schoolCode} />
          )}

          {/* Inbound approval actions */}
          {isInbound && req.status === "pending" && (
            <div className="space-y-2">
              <p className="text-[10px] text-white/35 font-semibold">
                Approving will restore this student's G7 + G8 SBA records from
                archive.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={approve}
                  disabled={isPending || !req.student_id}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 px-4 py-2 text-xs font-bold hover:bg-emerald-500/25 disabled:opacity-50 transition-all"
                >
                  {isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  Approve &amp; Restore SBA
                </button>
                <button
                  onClick={reject}
                  disabled={isPending}
                  className="flex items-center gap-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-2 text-xs font-bold hover:bg-rose-500/20 disabled:opacity-50 transition-all"
                >
                  <X className="h-3.5 w-3.5" />
                  Reject
                </button>
              </div>
              {!req.student_id && (
                <p className="text-[10px] text-amber-400/70 flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3" />
                  Student not found by UPI — admit them first via Admit Student,
                  then approve.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
