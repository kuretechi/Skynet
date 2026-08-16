import { prisma } from "@/lib/db";
import { memberPositionMs } from "@/lib/rooms/clock";

export type RoomReactionView = {
  id: string;
  userId: string;
  userName: string;
  atMs: number;
  kind: string;
  body: string;
};

export type RoomMemberView = {
  userId: string;
  name: string;
  offsetMs: number;
  isHost: boolean;
};

export type RoomState = {
  id: string;
  status: string;
  visibility: string;
  startedAt: string | null;
  endedAt: string | null;
  hostId: string;
  serverNow: number;
  joined: boolean;
  offsetMs: number;
  members: RoomMemberView[];
  reactions: RoomReactionView[];
  ahead: number;
  nextAheadAtMs: number | null;
};

const REACTION_LIMIT = 500;

/** A screening nobody closed is treated as over once it is this old. */
const ROOM_MAX_AGE_MS = 1000 * 60 * 60 * 12;

/** Ended rooms and their reactions are kept this long, then dropped. */
const ROOM_RETENTION_MS = 1000 * 60 * 60 * 24 * 90;

/**
 * Hosts leave rooms open, so without this every abandoned screening stays in
 * the Community list as if it were still live.
 */
export async function closeStaleRooms(): Promise<number> {
  const { count } = await prisma.watchRoom.updateMany({
    where: {
      status: { in: ["scheduled", "live"] },
      createdAt: { lt: new Date(Date.now() - ROOM_MAX_AGE_MS) },
    },
    data: { status: "ended", endedAt: new Date() },
  });
  return count;
}

/** Keeps room history bounded on a small database. */
export async function purgeOldRooms(): Promise<number> {
  const { count } = await prisma.watchRoom.deleteMany({
    where: { status: "ended", endedAt: { lt: new Date(Date.now() - ROOM_RETENTION_MS) } },
  });
  return count;
}

export async function loadRoomState(roomId: string, userId: string): Promise<RoomState | null> {
  const room = await prisma.watchRoom.findUnique({
    where: { id: roomId },
    include: {
      members: { include: { user: { select: { id: true, name: true } } }, orderBy: { joinedAt: "asc" } },
      reactions: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
        take: REACTION_LIMIT,
      },
    },
  });
  if (!room) return null;

  const me = room.members.find((member) => member.userId === userId);
  const serverNow = Date.now();

  // Spoiler safety is enforced here rather than in the client: a reaction to a
  // scene the viewer has not reached yet never leaves the server, so it is not
  // in the HTML, the RSC payload or this API's JSON. `nextAheadAtMs` lets the
  // client come back for the next one exactly when its clock reaches it.
  const cutoff =
    room.status === "ended"
      ? Number.POSITIVE_INFINITY
      : memberPositionMs(room.startedAt, me?.offsetMs ?? 0, serverNow);
  const visible = room.reactions.filter((reaction) => reaction.atMs <= cutoff);
  const hidden = room.reactions.filter((reaction) => reaction.atMs > cutoff);
  const ahead = hidden.length;
  const nextAheadAtMs = hidden.length > 0 ? Math.min(...hidden.map((reaction) => reaction.atMs)) : null;

  return {
    id: room.id,
    status: room.status,
    visibility: room.visibility,
    startedAt: room.startedAt?.toISOString() ?? null,
    endedAt: room.endedAt?.toISOString() ?? null,
    hostId: room.hostId,
    serverNow,
    joined: Boolean(me),
    offsetMs: me?.offsetMs ?? 0,
    members: room.members.map((member) => ({
      userId: member.userId,
      name: member.user.name,
      offsetMs: member.offsetMs,
      isHost: member.userId === room.hostId,
    })),
    ahead,
    nextAheadAtMs,
    reactions: visible.map((reaction) => ({
      id: reaction.id,
      userId: reaction.userId,
      userName: reaction.user.name,
      atMs: reaction.atMs,
      kind: reaction.kind,
      body: reaction.body,
    })),
  };
}

/**
 * A link room is open to anyone holding its (cuid) URL; a followers room is
 * limited to the host's followers plus whoever already joined.
 */
export async function canAccessRoom(
  room: { id: string; hostId: string; visibility: string },
  userId: string,
): Promise<boolean> {
  if (room.visibility === "link" || room.hostId === userId) return true;

  const [member, follow] = await Promise.all([
    prisma.roomMember.findUnique({ where: { roomId_userId: { roomId: room.id, userId } } }),
    prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: userId, followingId: room.hostId } },
    }),
  ]);
  return Boolean(member || follow);
}

/** Rooms you host, rooms you joined, and live rooms hosted by people you follow. */
export async function visibleRooms(userId: string) {
  const following = await prisma.follow.findMany({
    where: { followerId: userId },
    select: { followingId: true },
  });

  return prisma.watchRoom.findMany({
    where: {
      status: { in: ["scheduled", "live"] },
      createdAt: { gte: new Date(Date.now() - ROOM_MAX_AGE_MS) },
      OR: [
        { hostId: userId },
        { members: { some: { userId } } },
        { hostId: { in: following.map((follow) => follow.followingId) } },
      ],
    },
    include: {
      movie: true,
      host: { select: { id: true, name: true } },
      _count: { select: { members: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 10,
  });
}
