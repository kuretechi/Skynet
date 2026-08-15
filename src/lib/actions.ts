"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  createSession,
  destroySession,
  ensureDefaultShelves,
  getCurrentUser,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";
import { refreshCinemaDna } from "@/lib/dna/compute";
import { ensureMovieByProviderId } from "@/lib/movies/repository";

export type ActionState = { error?: string; ok?: boolean };

const credentials = z.object({
  email: z.string().email("メールアドレスの形式が正しくありません"),
  password: z.string().min(8, "パスワードは8文字以上にしてください"),
});

export async function signUpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = credentials
    .extend({ name: z.string().min(1, "名前を入力してください").max(40) })
    .safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
      name: formData.get("name"),
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return { error: "このメールアドレスは既に登録されています" };

  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      name: parsed.data.name,
      passwordHash: await hashPassword(parsed.data.password),
      avatarSeed: Math.random().toString(36).slice(2, 8),
    },
  });
  await ensureDefaultShelves(user.id);
  await createSession(user.id);
  redirect("/onboarding");
}

export async function signInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: "メールアドレスまたはパスワードが違います" };
  }
  await ensureDefaultShelves(user.id);
  await createSession(user.id);
  redirect(user.onboardedAt ? "/home" : "/onboarding");
}

export async function signOutAction() {
  await destroySession();
  redirect("/");
}

const requireUserOrThrow = async () => {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
};

const addToShelfByKind = async (userId: string, movieId: string, kind: string) => {
  const shelf = await prisma.shelf.findFirst({ where: { userId, kind } });
  if (!shelf) return;
  await prisma.shelfMovie.upsert({
    where: { shelfId_movieId: { shelfId: shelf.id, movieId } },
    update: {},
    create: { shelfId: shelf.id, movieId },
  });
};

const removeFromShelfByKind = async (userId: string, movieId: string, kind: string) => {
  const shelf = await prisma.shelf.findFirst({ where: { userId, kind } });
  if (!shelf) return;
  await prisma.shelfMovie.deleteMany({ where: { shelfId: shelf.id, movieId } });
};

export async function rateMovieAction(providerId: string, score: number) {
  const user = await requireUserOrThrow();
  const movie = await ensureMovieByProviderId(providerId);
  if (!movie) return { error: "映画が見つかりませんでした" };

  await prisma.rating.upsert({
    where: { userId_movieId: { userId: user.id, movieId: movie.id } },
    update: { score },
    create: { userId: user.id, movieId: movie.id, score },
  });
  await prisma.watchHistory.upsert({
    where: { userId_movieId: { userId: user.id, movieId: movie.id } },
    update: {},
    create: { userId: user.id, movieId: movie.id },
  });
  await ensureDefaultShelves(user.id);
  await addToShelfByKind(user.id, movie.id, "watched");
  await removeFromShelfByKind(user.id, movie.id, "want_to_watch");
  await refreshCinemaDna(user.id);

  revalidatePath("/home");
  revalidatePath("/dna");
  revalidatePath("/shelf");
  revalidatePath(`/movie/${providerId}`);
  return { ok: true };
}

export async function removeRatingAction(providerId: string) {
  const user = await requireUserOrThrow();
  const movie = await ensureMovieByProviderId(providerId);
  if (!movie) return { error: "映画が見つかりませんでした" };
  await prisma.rating.deleteMany({ where: { userId: user.id, movieId: movie.id } });
  await refreshCinemaDna(user.id);
  revalidatePath(`/movie/${providerId}`);
  return { ok: true };
}

export async function toggleShelfAction(providerId: string, kind: "favorites" | "want_to_watch" | "watched") {
  const user = await requireUserOrThrow();
  const movie = await ensureMovieByProviderId(providerId);
  if (!movie) return { error: "映画が見つかりませんでした" };

  await ensureDefaultShelves(user.id);
  const shelf = await prisma.shelf.findFirst({ where: { userId: user.id, kind } });
  if (!shelf) return { error: "棚が見つかりませんでした" };

  const existing = await prisma.shelfMovie.findUnique({
    where: { shelfId_movieId: { shelfId: shelf.id, movieId: movie.id } },
  });
  if (existing) {
    await prisma.shelfMovie.delete({ where: { id: existing.id } });
    if (kind === "watched") await prisma.watchHistory.deleteMany({ where: { userId: user.id, movieId: movie.id } });
  } else {
    await prisma.shelfMovie.create({ data: { shelfId: shelf.id, movieId: movie.id } });
    if (kind === "watched") {
      await prisma.watchHistory.upsert({
        where: { userId_movieId: { userId: user.id, movieId: movie.id } },
        update: {},
        create: { userId: user.id, movieId: movie.id },
      });
    }
  }

  revalidatePath("/shelf");
  revalidatePath(`/movie/${providerId}`);
  return { ok: true, added: !existing };
}

export async function addToCustomShelfAction(providerId: string, shelfId: string) {
  const user = await requireUserOrThrow();
  const movie = await ensureMovieByProviderId(providerId);
  const shelf = await prisma.shelf.findFirst({ where: { id: shelfId, userId: user.id } });
  if (!movie || !shelf) return { error: "棚が見つかりませんでした" };

  const existing = await prisma.shelfMovie.findUnique({
    where: { shelfId_movieId: { shelfId: shelf.id, movieId: movie.id } },
  });
  if (existing) await prisma.shelfMovie.delete({ where: { id: existing.id } });
  else await prisma.shelfMovie.create({ data: { shelfId: shelf.id, movieId: movie.id } });

  revalidatePath("/shelf");
  revalidatePath(`/movie/${providerId}`);
  return { ok: true };
}

export async function createShelfAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUserOrThrow();
  const parsed = z
    .object({ name: z.string().min(1, "棚の名前を入力してください").max(40), motif: z.string().default("vhs") })
    .safeParse({ name: formData.get("name"), motif: formData.get("motif") ?? "vhs" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const existing = await prisma.shelf.findUnique({
    where: { userId_name: { userId: user.id, name: parsed.data.name } },
  });
  if (existing) return { error: "同じ名前の棚があります" };

  await prisma.shelf.create({
    data: { userId: user.id, name: parsed.data.name, kind: "custom", motif: parsed.data.motif },
  });
  revalidatePath("/shelf");
  return { ok: true };
}

export async function postReviewAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUserOrThrow();
  const parsed = z
    .object({
      providerId: z.string().min(1),
      text: z.string().min(1, "レビュー本文を入力してください").max(2000),
      spoiler: z.boolean(),
    })
    .safeParse({
      providerId: formData.get("providerId"),
      text: formData.get("text"),
      spoiler: formData.get("spoiler") === "on",
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const movie = await ensureMovieByProviderId(parsed.data.providerId);
  if (!movie) return { error: "映画が見つかりませんでした" };

  await prisma.review.upsert({
    where: { userId_movieId: { userId: user.id, movieId: movie.id } },
    update: { text: parsed.data.text, spoiler: parsed.data.spoiler },
    create: { userId: user.id, movieId: movie.id, text: parsed.data.text, spoiler: parsed.data.spoiler },
  });

  revalidatePath(`/movie/${parsed.data.providerId}`);
  revalidatePath("/community");
  return { ok: true };
}

export async function toggleReviewLikeAction(reviewId: string) {
  const user = await requireUserOrThrow();
  const existing = await prisma.reviewLike.findUnique({
    where: { reviewId_userId: { reviewId, userId: user.id } },
  });
  if (existing) await prisma.reviewLike.delete({ where: { id: existing.id } });
  else await prisma.reviewLike.create({ data: { reviewId, userId: user.id } });
  revalidatePath("/community");
  return { ok: true, liked: !existing };
}

export async function toggleFollowAction(targetUserId: string) {
  const user = await requireUserOrThrow();
  if (user.id === targetUserId) return { error: "自分はフォローできません" };
  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: user.id, followingId: targetUserId } },
  });
  if (existing) await prisma.follow.delete({ where: { id: existing.id } });
  else await prisma.follow.create({ data: { followerId: user.id, followingId: targetUserId } });
  revalidatePath("/community");
  revalidatePath(`/u/${targetUserId}`);
  return { ok: true, following: !existing };
}

export async function completeOnboardingAction() {
  const user = await requireUserOrThrow();
  await refreshCinemaDna(user.id);
  await prisma.user.update({ where: { id: user.id }, data: { onboardedAt: new Date() } });
  redirect("/dna?reveal=1");
}
