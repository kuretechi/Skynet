import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAccessRoom, loadRoomState } from "@/lib/rooms/service";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { id } = await params;
  const room = await prisma.watchRoom.findUnique({
    where: { id },
    select: { id: true, hostId: true, visibility: true },
  });
  if (!room || !(await canAccessRoom(room, user.id))) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const state = await loadRoomState(id, user.id);
  if (!state) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  return NextResponse.json(state, { headers: { "cache-control": "no-store" } });
}
