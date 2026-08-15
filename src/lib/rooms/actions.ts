"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureMovieByProviderId } from "@/lib/movies/repository";
import { memberPositionMs, offsetForPosition } from "@/lib/rooms/clock";
import { notifyRoomChanged } from "@/lib/rooms/broadcast";
import { canAccessRoom } from "@/lib/rooms/service";

export type RoomActionState = { error?: string; ok?: boolean };

const MAX_COMMENT = 140;

const roomFor = (roomId: string) => prisma.watchRoom.findUnique({ where: { id: roomId } });

/** Every room mutation goes through here so visibility is checked server-side. */
async function roomForMember(roomId: string, userId: string) {
  const room = await roomFor(roomId);
  if (!room) return null;
  return (await canAccessRoom(room, userId)) ? room : null;
}

export async function createRoomAction(
  providerId: string,
  title: string,
  visibility: "followers" | "link" = "followers",
) {
  const user = await requireUser();
  const movie = await ensureMovieByProviderId(providerId);
  if (!movie) return { error: "映画が見つかりませんでした" };

  const parsed = z
    .object({ title: z.string().min(1).max(60), visibility: z.enum(["followers", "link"]) })
    .safeParse({ title: title.trim() || movie.title, visibility });
  if (!parsed.success) return { error: "ルーム名を入力してください" };

  const room = await prisma.watchRoom.create({
    data: {
      movieId: movie.id,
      hostId: user.id,
      title: parsed.data.title,
      visibility: parsed.data.visibility,
      members: { create: { userId: user.id, offsetMs: 0 } },
    },
  });

  revalidatePath("/community");
  redirect(`/room/${room.id}`);
}

export async function joinRoomAction(roomId: string, positionMs: number) {
  const user = await requireUser();
  const room = await roomForMember(roomId, user.id);
  if (!room) return { error: "ルームが見つかりませんでした" };
  if (room.status === "ended") return { error: "このルームは終了しています" };

  const offsetMs = offsetForPosition(room.startedAt, Math.max(0, positionMs));
  await prisma.roomMember.upsert({
    where: { roomId_userId: { roomId, userId: user.id } },
    update: { offsetMs },
    create: { roomId, userId: user.id, offsetMs },
  });

  await notifyRoomChanged(roomId);
  return { ok: true };
}

export async function leaveRoomAction(roomId: string) {
  const user = await requireUser();
  await prisma.roomMember.deleteMany({ where: { roomId, userId: user.id } });
  await notifyRoomChanged(roomId);
  revalidatePath("/community");
  return { ok: true };
}

export async function startRoomAction(roomId: string) {
  const user = await requireUser();
  const room = await roomFor(roomId);
  if (!room) return { error: "ルームが見つかりませんでした" };
  if (room.hostId !== user.id) return { error: "開始できるのはホストだけです" };
  if (room.status === "live") return { ok: true };

  const startedAt = new Date();
  await prisma.$transaction([
    prisma.watchRoom.update({
      where: { id: roomId },
      data: { status: "live", startedAt, endedAt: null },
    }),
    // Everyone already in the room starts from the top together.
    prisma.roomMember.updateMany({ where: { roomId }, data: { offsetMs: 0 } }),
  ]);

  await notifyRoomChanged(roomId);
  revalidatePath("/community");
  return { ok: true };
}

export async function endRoomAction(roomId: string) {
  const user = await requireUser();
  const room = await roomFor(roomId);
  if (!room) return { error: "ルームが見つかりませんでした" };
  if (room.hostId !== user.id) return { error: "終了できるのはホストだけです" };

  await prisma.watchRoom.update({
    where: { id: roomId },
    data: { status: "ended", endedAt: new Date() },
  });

  await notifyRoomChanged(roomId);
  revalidatePath("/community");
  return { ok: true };
}

export async function setRoomVisibilityAction(roomId: string, visibility: "followers" | "link") {
  const user = await requireUser();
  const room = await roomFor(roomId);
  if (!room) return { error: "ルームが見つかりませんでした" };
  if (room.hostId !== user.id) return { error: "公開範囲を変えられるのはホストだけです" };

  await prisma.watchRoom.update({ where: { id: roomId }, data: { visibility } });
  await notifyRoomChanged(roomId);
  return { ok: true };
}

export async function syncPositionAction(roomId: string, positionMs: number) {
  const user = await requireUser();
  const room = await roomForMember(roomId, user.id);
  if (!room) return { error: "ルームが見つかりませんでした" };

  await prisma.roomMember.updateMany({
    where: { roomId, userId: user.id },
    data: { offsetMs: offsetForPosition(room.startedAt, Math.max(0, positionMs)) },
  });

  await notifyRoomChanged(roomId);
  return { ok: true };
}

export async function postReactionAction(roomId: string, kind: "emoji" | "comment", body: string) {
  const user = await requireUser();
  const parsed = z
    .object({ kind: z.enum(["emoji", "comment"]), body: z.string().min(1).max(MAX_COMMENT) })
    .safeParse({ kind, body: body.trim() });
  if (!parsed.success) return { error: "コメントを入力してください" };

  const [room, member] = await Promise.all([
    roomForMember(roomId, user.id),
    prisma.roomMember.findUnique({ where: { roomId_userId: { roomId, userId: user.id } } }),
  ]);
  if (!room) return { error: "ルームが見つかりませんでした" };
  if (!member) return { error: "先にルームに参加してください" };
  if (room.status !== "live") return { error: "上映中のルームではありません" };

  await prisma.roomReaction.create({
    data: {
      roomId,
      userId: user.id,
      atMs: memberPositionMs(room.startedAt, member.offsetMs),
      kind: parsed.data.kind,
      body: parsed.data.body,
    },
  });

  await notifyRoomChanged(roomId);
  return { ok: true };
}
