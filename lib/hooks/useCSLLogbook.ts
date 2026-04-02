// ============================================================
// lib/hooks/useCSLLogbook.ts
// Client-side hook for CSL logbook data with optimistic updates
// ============================================================
"use client";

import { saveCSLEntryAction } from "@/lib/actions/csl";
import type {
  CSLEntryFormValues,
  CSLPerformanceResult,
  DbCSLEntry,
} from "@/types/csl";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";

export interface UseCSLLogbookReturn {
  entries: DbCSLEntry[];
  performance: CSLPerformanceResult | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  saveEntry: (
    values: CSLEntryFormValues & { studentId: string; academicYear: number },
  ) => Promise<boolean>;
  refetch: () => void;
}

export function useCSLLogbook(
  studentId: string,
  academicYear: number = 2026,
): UseCSLLogbookReturn {
  const [entries, setEntries] = useState<DbCSLEntry[]>([]);
  const [performance, setPerformance] = useState<CSLPerformanceResult | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();
  const [tick, setTick] = useState(0);

  // Fetch from API route — swap for TanStack Query / Dexie offline in Phase 2
  const refetch = useCallback(() => setTick((t) => t + 1), []);

  const saveEntry = useCallback(
    (
      values: CSLEntryFormValues & { studentId: string; academicYear: number },
    ): Promise<boolean> => {
      return new Promise((resolve) => {
        startSave(async () => {
          const result = await saveCSLEntryAction({
            studentId: values.studentId,
            academicYear: values.academicYear,
            projectTitle: values.projectTitle,
            strand: values.strand,
            activityDescription: values.activityDescription,
            hoursSpent: values.hoursSpent,
            competenciesAddressed: values.competenciesAddressed,
            studentReflection: values.studentReflection,
            evidenceUrl: values.evidenceUrl,
          });

          if (result.success) {
            toast.success(result.message);
            refetch();
            resolve(true);
          } else {
            toast.error(result.message);
            resolve(false);
          }
        });
      });
    },
    [refetch, startSave],
  );

  return {
    entries,
    performance,
    isLoading,
    isSaving,
    error,
    saveEntry,
    refetch,
  };
}
