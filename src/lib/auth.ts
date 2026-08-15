import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

const COOKIE = "pc_session";
const MAX_AGE = 60 * 60 * 24 * 30;

const secret = () =>
  new TextEncoder().encode(process.env.AUTH_SECRET ?? "development-only-secret-change-me");

export const hashPassword = (password: string) => bcrypt.hash(password, 10);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function getSessionUserId(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const userId = await getSessionUserId();
  if (!userId) return null;
  return prisma.user.findUnique({ where: { id: userId }, include: { dna: true } });
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export const DEFAULT_SHELVES = [
  { name: "Watched", kind: "watched", motif: "archive_box" },
  { name: "Favorites", kind: "favorites", motif: "film_roll" },
  { name: "Want to Watch", kind: "want_to_watch", motif: "vhs" },
] as const;

export async function ensureDefaultShelves(userId: string) {
  for (const shelf of DEFAULT_SHELVES) {
    await prisma.shelf.upsert({
      where: { userId_name: { userId, name: shelf.name } },
      update: {},
      create: { userId, name: shelf.name, kind: shelf.kind, motif: shelf.motif },
    });
  }
}
