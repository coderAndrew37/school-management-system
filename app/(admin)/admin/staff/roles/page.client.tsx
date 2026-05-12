"use client";

// @/app/admin/staff/RoleManagementClient.tsx

import { useState }               from "react";
import { useRouter }              from "next/navigation";
import type { AdminRoleDefinition, RoleStatistics, StaffMember } from "@/lib/types/auth";
import { StatsBar } from "../_components/Statsbar";
import { AssignRoleModal } from "../_components/AssignRoleModal";
import { AuditLogDrawer } from "../_components/AuditLogDrawer";
import { RoleDefinitionsPanel } from "../_components/RolesDefinitionPanel";
import { StaffTable } from "../_components/StaffTable";

interface Props {
  initialStaff:  StaffMember[];
  roleDefs:      AdminRoleDefinition[];
  stats:         RoleStatistics;
  currentUserId: string;
}

export function RoleManagementClient({ initialStaff, roleDefs, stats, currentUserId }: Props) {
  const router = useRouter();

  const [assignTarget,  setAssignTarget]  = useState<StaffMember | null>(null);
  const [historyTarget, setHistoryTarget] = useState<StaffMember | null>(null);

  // router.refresh() re-runs the RSC, re-fetches data, passes fresh props down.
  const refresh = () => router.refresh();

  const handleAssignSuccess = () => {
    setAssignTarget(null);
    refresh();
  };

  return (
    <>
      <div className="space-y-6">
        {/* Stats */}
        <StatsBar stats={stats} />

        {/* Role definitions CRUD — collapsible panel above the staff table */}
        <RoleDefinitionsPanel roleDefs={roleDefs} onRefresh={refresh} />

        {/* Staff table */}
        <div className="rounded-2xl border border-stone-100 bg-white overflow-hidden">
          <div className="flex items-center justify-between border-b border-stone-100 px-6 py-5">
            <div>
              <h2 className="text-base font-semibold text-stone-900">Staff Directory</h2>
              <p className="mt-0.5 text-xs text-stone-500">
                Hover a row and click <span className="font-medium text-amber-700">Edit role</span> to assign or change access.
              </p>
            </div>
          </div>
          <div className="p-6">
            <StaffTable
              staff={initialStaff}
              onEdit={setAssignTarget}
              onViewHistory={setHistoryTarget}
              currentUserId={currentUserId}
            />
          </div>
        </div>
      </div>

      {/* Modals */}
      <AssignRoleModal
        user={assignTarget}
        roleDefs={roleDefs.filter((d) => d.is_active)}
        isOpen={!!assignTarget}
        onClose={() => setAssignTarget(null)}
        onSuccess={handleAssignSuccess}
      />

      <AuditLogDrawer
        user={historyTarget}
        isOpen={!!historyTarget}
        onClose={() => setHistoryTarget(null)}
      />
    </>
  );
}