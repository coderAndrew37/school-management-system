// app/api/teachers/[id]/detail/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/actions/auth";
import { hasPermission } from "@/lib/services/auth-utils";
import {
  fetchTeacherStats,
  fetchTeacherAllocations,
  fetchClassTeacherAssignments,
} from "@/lib/data/teachers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || !hasPermission(session.profile, "people:teachers:read")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: teacherId } = await params;
  const year =
    parseInt(request.nextUrl.searchParams.get("year") ?? "") ||
    new Date().getFullYear();

  const [stats, allocations, assignments] = await Promise.all([
    fetchTeacherStats(teacherId, year),
    fetchTeacherAllocations(teacherId, year),
    fetchClassTeacherAssignments(teacherId, year),
  ]);

  return NextResponse.json({ stats, allocations, assignments });
}