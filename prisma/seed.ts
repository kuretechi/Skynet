/**
 * Development seed: one demo account with ratings, shelves and a review so the
 * personalization loop (DNA → CineType → For You) has something to work with.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ensureMovieByProviderId } from "../src/lib/movies/repository";
import { getMovieProvider } from "../src/lib/movies/provider";
import { refreshCinemaDna } from "../src/lib/dna/compute";
import type { Movie } from "@prisma/client";

const DEFAULT_SHELVES = [
  { name: "Watched", kind: "watched", motif: "archive_box" },
  { name: "Favorites", kind: "favorites", motif: "film_roll" },
  { name: "Want to Watch", kind: "want_to_watch", motif: "vhs" },
];

const prisma = new PrismaClient();

/**
 * Titles are resolved through the active provider (TMDB or mock) instead of
 * hard-coded provider ids, so the seed works whichever provider is configured.
 */
type SeedTitle = { title: string; year: number };

const DEMO_RATINGS: { movie: SeedTitle; score: number }[] = [
  { movie: { title: "Arrival", year: 2016 }, score: 5 },
  { movie: { title: "Blade Runner 2049", year: 2017 }, score: 4.5 },
  { movie: { title: "Dune", year: 2021 }, score: 4 },
  { movie: { title: "Perfect Days", year: 2023 }, score: 5 },
  { movie: { title: "In the Mood for Love", year: 2000 }, score: 4.5 },
  { movie: { title: "Parasite", year: 2019 }, score: 4 },
  { movie: { title: "2001: A Space Odyssey", year: 1968 }, score: 5 },
  { movie: { title: "Her", year: 2013 }, score: 4.5 },
  { movie: { title: "Whiplash", year: 2014 }, score: 3.5 },
  { movie: { title: "Mad Max: Fury Road", year: 2015 }, score: 3 },
  { movie: { title: "The Social Network", year: 2010 }, score: 3.5 },
  { movie: { title: "Interstellar", year: 2014 }, score: 4 },
];

const WANT_TO_WATCH: SeedTitle[] = [
  { title: "Past Lives", year: 2023 },
  { title: "Drive My Car", year: 2021 },
];

async function resolveMovie({ title, year }: SeedTitle): Promise<Movie | null> {
  const results = await getMovieProvider().search(title);
  if (results.length === 0) return null;
  const exact = results.find((r) => Number(r.releaseDate?.slice(0, 4)) === year);
  const near = results.find((r) => Math.abs(Number(r.releaseDate?.slice(0, 4)) - year) <= 1);
  const match = exact ?? near ?? results[0];
  return ensureMovieByProviderId(match.providerId);
}

async function main() {
  const email = "demo@personal.cinema";
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "Demo Cinephile",
      passwordHash: await bcrypt.hash("cinema2024", 10),
      avatarSeed: "demo",
      onboardedAt: new Date(),
    },
  });

  for (const shelf of DEFAULT_SHELVES) {
    await prisma.shelf.upsert({
      where: { userId_name: { userId: user.id, name: shelf.name } },
      update: {},
      create: { userId: user.id, name: shelf.name, kind: shelf.kind, motif: shelf.motif },
    });
  }
  const watched = await prisma.shelf.findFirstOrThrow({ where: { userId: user.id, kind: "watched" } });
  const wantToWatch = await prisma.shelf.findFirstOrThrow({
    where: { userId: user.id, kind: "want_to_watch" },
  });

  for (const { movie: seedTitle, score } of DEMO_RATINGS) {
    const movie = await resolveMovie(seedTitle);
    if (!movie) {
      console.warn(`Skipped (not found by provider): ${seedTitle.title}`);
      continue;
    }
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
    await prisma.shelfMovie.upsert({
      where: { shelfId_movieId: { shelfId: watched.id, movieId: movie.id } },
      update: {},
      create: { shelfId: watched.id, movieId: movie.id },
    });
  }

  for (const seedTitle of WANT_TO_WATCH) {
    const movie = await resolveMovie(seedTitle);
    if (!movie) continue;
    await prisma.shelfMovie.upsert({
      where: { shelfId_movieId: { shelfId: wantToWatch.id, movieId: movie.id } },
      update: {},
      create: { shelfId: wantToWatch.id, movieId: movie.id },
    });
  }

  const arrival = await resolveMovie({ title: "Arrival", year: 2016 });
  if (arrival) {
    await prisma.review.upsert({
      where: { userId_movieId: { userId: user.id, movieId: arrival.id } },
      update: {},
      create: {
        userId: user.id,
        movieId: arrival.id,
        text: "言語が思考を変える、という一点だけで構成された映画。静けさの密度がすごい。",
        spoiler: false,
      },
    });
  }

  await refreshCinemaDna(user.id);
  console.log(`Seeded via provider "${getMovieProvider().name}", demo user: ${email} / cinema2024`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
