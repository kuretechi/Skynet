import { prisma } from "@/lib/db";

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
};

/** Reactions are handed over whole and revealed by each client's own clock. */
const REACTION_LIMIT = 500;

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

  return {
    id: room.id,
    status: room.status,
    visibility: room.visibility,
    startedAt: room.startedAt?.toISOString() ?? null,
    endedAt: room.endedAt?.toISOString() ?? null,
    hostId: room.hostId,
    serverNow: Date.now(),
    joined: Boolean(me),
    offsetMs: me?.offsetMs ?? 0,
    members: room.members.map((member) => ({
      userId: member.userId,
      name: member.user.name,
      offsetMs: member.offsetMs,
      isHost: member.userId === room.hostId,
    })),
    reactions: room.reactions.map((reaction) => ({
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
