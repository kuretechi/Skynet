import { cache } from "react";
import { prisma } from "@/lib/db";

export const shelfDisplayName = (kind: string, name: string) =>
  kind === "want_to_watch" ? "WATCHLIST" : name;

/** Movies already sitting on the user's "want to watch" shelf, once per request. */
export const watchlistMovieIds = cache(async (userId: string): Promise<Set<string>> => {
  const rows = await prisma.shelfMovie.findMany({
    where: { shelf: { userId, kind: "want_to_watch" } },
    select: { movieId: true },
  });
  return new Set(rows.map((row) => row.movieId));
});
