// ============================================================
// lib/hooks/useKESSCEData.ts
// Offline-capable KESSCE data hook (Dexie.js + fetch)
// ============================================================
// Phase 1 (current): direct server-side fetch via Next.js server actions.
// Phase 2 (offline): uncomment the Dexie sections and install:
//   npm install dexie dexie-react-hooks
//
// Usage in a client component:
//   const { data, isLoading, invalidate } = useKESSCEData("Grade 9 / JSS 3", 2026);

"use client";

import { useState, useEffect, useCallback } from "react";
import type { IKESSCEResult } from "@/types/knec";

// ── Dexie schema (uncomment when installing Dexie) ───────────────────────────
//
// import Dexie, { type Table } from "dexie";
//
// interface CachedKESSCERecord {
//   studentId:    string;   // primary key
//   grade:        string;
//   year:         number;
//   result:       IKESSCEResult;
//   cachedAt:     number;   // Date.now()
// }
//
// class KibaliOfflineDB extends Dexie {
//   kessce!: Table<CachedKESSCERecord, string>;
//   constructor() {
//     super("KibaliOffline");
//     this.version(1).stores({
//       kessce: "studentId, grade, year, cachedAt",
//     });
//   }
// }
//
// const offlineDB = new KibaliOfflineDB();
// const CACHE_TTL_MS = 1000 * 60 * 60 * 4; // 4 hours

// ── Fetch abstraction (swap for /api/kessce in offline phase) ─────────────────

async function fetchKESSCEData(
  grade: string,
  year: number,
): Promise<IKESSCEResult[]> {
  // Phase 1: call the Next.js API route (which calls getKESSCEClassData server-side)
  const res = await fetch(
    `/api/kessce?grade=${encodeURIComponent(grade)}&year=${year}`,
    {
      cache: "no-store",
    },
  );
  if (!res.ok) throw new Error(`KESSCE fetch failed: ${res.statusText}`);
  return res.json() as Promise<IKESSCEResult[]>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseKESSCEDataReturn {
  data: IKESSCEResult[];
  isLoading: boolean;
  error: string | null;
  /** Call after saving overrides / pathway edits to refetch */
  invalidate: () => void;
}

export function useKESSCEData(
  grade: string,
  year: number,
): UseKESSCEDataReturn {
  const [data, setData] = useState<IKESSCEResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const invalidate = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    // ── Phase 2: try Dexie cache first ────────────────────────────────────────
    // const tryCache = async () => {
    //   const cached = await offlineDB.kessce
    //     .where("grade").equals(grade)
    //     .and(r => r.year === year)
    //     .toArray();
    //   const fresh = cached.filter(r => Date.now() - r.cachedAt < CACHE_TTL_MS);
    //   if (fresh.length > 0) {
    //     setData(fresh.map(r => r.result));
    //     setIsLoading(false);
    //   }
    // };
    // tryCache();

    fetchKESSCEData(grade, year)
      .then((results) => {
        if (cancelled) return;
        setData(results);

        // ── Phase 2: write to Dexie ───────────────────────────────────────────
        // offlineDB.kessce.bulkPut(
        //   results.map(r => ({
        //     studentId: r.studentId, grade, year, result: r, cachedAt: Date.now(),
        //   })),
        // );
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Unknown error";
        setError(msg);

        // ── Phase 2: fall back to stale Dexie cache ───────────────────────────
        // offlineDB.kessce.where("grade").equals(grade).and(r => r.year === year)
        //   .toArray().then(stale => { if (!cancelled) setData(stale.map(r => r.result)); });
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [grade, year, tick]);

  return { data, isLoading, error, invalidate };
}
