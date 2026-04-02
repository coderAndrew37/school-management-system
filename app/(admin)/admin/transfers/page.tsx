// ─────────────────────────────────────────────────────────────────────────────
// app/(admin)/admin/transfers/page.tsx
// Route: /admin/transfers
// Transfer Center — Incoming QR scans + Outgoing clearances
// ─────────────────────────────────────────────────────────────────────────────

import { ArrowLeftRight, Info } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DbTransferRequest } from "@/types/csl";
import { TransferCenter } from "@/app/_components/transfers/TransferCenter";

export const metadata = {
  title: "Transfer Center | Kibali Academy",
  description:
    "Student transfer management — incoming QR scans and outgoing clearances.",
};

export const revalidate = 0;

const SCHOOL_CODE = "KIBALI-001";

async function fetchTransfers(): Promise<{
  incoming: DbTransferRequest[];
  outgoing: DbTransferRequest[];
}> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("transfer_requests")
    .select(
      `
      *,
      student:students (
        id, full_name, upi_number, current_grade, readable_id, status
      )
    `,
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[fetchTransfers]", error.message);
    return { incoming: [], outgoing: [] };
  }

  const all = (data ?? []) as DbTransferRequest[];
  const incoming = all.filter((r) => r.direction === "inbound");
  const outgoing = all.filter((r) => r.direction === "outbound");

  return { incoming, outgoing };
}

export default async function TransfersPage() {
  const { incoming, outgoing } = await fetchTransfers();

  const pendingIn = incoming.filter((r) => r.status === "pending").length;
  const pendingOut = outgoing.filter((r) => r.status === "pending").length;
  const total = incoming.length + outgoing.length;

  return (
    <div className="min-h-screen bg-[#0c0f1a] font-[family-name:var(--font-body)]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute top-10 right-1/4 w-[600px] h-[400px] rounded-full bg-amber-500/[0.03] blur-[140px]" />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-sky-500/[0.025] blur-[100px]" />
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <header className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-400/70">
              Kibali Academy · Admin
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/10 border border-amber-400/20">
                <ArrowLeftRight className="h-5 w-5 text-amber-400" />
              </div>
              Transfer Center
            </h1>
            <p className="mt-1 text-xs text-white/35 ml-12">
              {total} requests · {pendingIn} incoming pending · {pendingOut}{" "}
              outgoing pending
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-2.5">
            <span className="text-xs font-mono text-white/40">School:</span>
            <span className="text-xs font-bold text-white/70">
              {SCHOOL_CODE}
            </span>
          </div>
        </header>

        {/* Context */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 space-y-2">
          <p className="text-xs text-white/40 leading-relaxed">
            <span className="font-bold text-white/60">Data Integrity:</span>{" "}
            Approving an inbound transfer calls the{" "}
            <code className="text-amber-400/60 text-[10px]">
              approve_inbound_transfer()
            </code>{" "}
            PostgreSQL function which atomically restores the student's G7 + G8
            SBA records from the archive table — ensuring the KESSCE 3-year
            aggregator has a complete record.
          </p>
          <p className="text-xs text-white/30 flex items-center gap-1.5">
            <Info className="h-3 w-3" />
            Outbound transfers archive assessments and generate a QR code. The
            receiving school scans it via the QR Scanner tab to create an
            inbound request.
          </p>
        </div>

        <TransferCenter
          incoming={incoming}
          outgoing={outgoing}
          schoolCode={SCHOOL_CODE}
        />
      </main>
    </div>
  );
}
