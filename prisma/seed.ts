/**
 * Development seed: one demo account with ratings, shelves and a review so the
 * personalization loop (DNA → CineType → For You) has something to work with.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { MOCK_CATALOG } from "../src/lib/movies/mock-catalog";
import { ensureMovieByProviderId } from "../src/lib/movies/repository";
import { refreshCinemaDna } from "../src/lib/dna/compute";

const DEFAULT_SHELVES = [
  { name: "Watched", kind: "watched", motif: "archive_box" },
  { name: "Favorites", kind: "favorites", motif: "film_roll" },
  { name: "Want to Watch", kind: "want_to_watch", motif: "vhs" },
];

const prisma = new PrismaClient();

const DEMO_RATINGS: Record<string, number> = {
  "m-arrival": 5,
  "m-blade-runner-2049": 4.5,
  "m-dune": 4,
  "m-perfect-days": 5,
  "m-in-the-mood-for-love": 4.5,
  "m-parasite": 4,
  "m-2001": 5,
  "m-her": 4.5,
  "m-whiplash": 3.5,
  "m-mad-max-fury-road": 3,
  "m-the-social-network": 3.5,
  "m-interstellar": 4,
};

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

  for (const [providerId, score] of Object.entries(DEMO_RATINGS)) {
    const movie = await ensureMovieByProviderId(providerId);
    if (!movie) continue;
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

  for (const providerId of ["m-past-lives", "m-drive-my-car"]) {
    const movie = await ensureMovieByProviderId(providerId);
    if (!movie) continue;
    await prisma.shelfMovie.upsert({
      where: { shelfId_movieId: { shelfId: wantToWatch.id, movieId: movie.id } },
      update: {},
      create: { shelfId: wantToWatch.id, movieId: movie.id },
    });
  }

  const arrival = await ensureMovieByProviderId("m-arrival");
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
  console.log(`Seeded ${MOCK_CATALOG.length} catalog titles available, demo user: ${email} / cinema2024`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
