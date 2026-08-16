import { cache, Suspense } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { type AxisVector, euclideanDistance } from "@/lib/dna/axes";
import { RECOMMENDATION_POOL_SIZE } from "@/lib/config";
import {
  getUserTasteContext,
  recommendForUser,
  scoreMoviesForUser,
  type ScoredMovie,
} from "@/lib/recommend/engine";
import { FEATURE_VERSION } from "@/lib/features/generate";
import { getMood, MOODS } from "@/lib/recommend/moods";
import { prisma } from "@/lib/db";
import { MovieSearch } from "@/components/movie-search";
import { ScoredMovieCarousel, ScoredMovieRow, SectionHeader } from "@/components/movie-list";
import { CarouselSkeleton, SectionSkeleton } from "@/components/skeletons";
import { TtlCache } from "@/lib/cache/process-cache";

export const dynamic = "force-dynamic";

/** Feature rows for mood ranking are the same for everyone. */
const moodPool = new TtlCache<string, Awaited<ReturnType<typeof loadMoodPool>>>(60_000);
const loadMoodPool = () =>
  prisma.movieFeature.findMany({
    where: { featureVersion: FEATURE_VERSION },
    include: { movie: true },
    take: 200,
    orderBy: { movie: { popularity: "desc" } },
  });

/** Shared by the three sections it feeds, so the work happens once per request. */
const discoverRecommendations = cache((userId: string) =>
  recommendForUser(userId, {
    limit: RECOMMENDATION_POOL_SIZE,
    poolSize: RECOMMENDATION_POOL_SIZE,
  }),
);

async function moodRecommendations(
  userId: string,
  target: AxisVector | null,
): Promise<ScoredMovie[]> {
  if (!target) return [];
  const [ctx, cached] = await Promise.all([
    getUserTasteContext(userId),
    moodPool.get("all", loadMoodPool),
  ]);
  const ranked = cached
    .map((f) => ({
      movie: f.movie,
      distance: euclideanDistance(target, {
        feel: f.feel,
        think: f.think,
        immerse: f.immerse,
        story: f.story,
        sense: f.sense,
        pulse: f.pulse,
        explore: f.explore,
        depth: f.depth,
      }),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 6);
  return scoreMoviesForUser(ranked.map((r) => r.movie), ctx);
}

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ mood?: string }>;
}) {
  const { mood: moodId } = await searchParams;
  const user = await requireUser();
  const mood = getMood(moodId);

  return (
    <main className="flex flex-col gap-12 pt-10">
      <header>
        <span className="label">Discover</span>
        <h1 className="display mt-2 text-2xl">次の一本を見つける。</h1>
      </header>

      <section className="flex flex-col gap-4">
        <MovieSearch />
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader title="Mood Search" caption="いまの気分から" />
        <ul className="flex flex-wrap gap-2">
          {MOODS.map((m) => (
            <li key={m.id}>
              <Link
                href={mood?.id === m.id ? "/discover" : `/discover?mood=${m.id}`}
                className="block border px-3 py-2 text-xs"
                style={{
                  borderColor: mood?.id === m.id ? "var(--accent)" : "var(--line)",
                  color: mood?.id === m.id ? "var(--accent)" : "var(--foreground)",
                }}
              >
                {m.label}
              </Link>
            </li>
          ))}
        </ul>
        {mood ? (
          <Suspense fallback={null}>
            <MoodResults userId={user.id} target={mood.target} />
          </Suspense>
        ) : null}
      </section>

      <Suspense fallback={<SectionSkeleton title="For You" rows={4} />}>
        <ForYou userId={user.id} />
      </Suspense>

      <Suspense fallback={<CarouselSkeleton title="Hidden Gems" />}>
        <HiddenGems userId={user.id} />
      </Suspense>

      <Suspense fallback={<CarouselSkeleton title="Outside Your Bubble" />}>
        <OutsideBubble userId={user.id} />
      </Suspense>
    </main>
  );
}

async function MoodResults({ userId, target }: { userId: string; target: AxisVector }) {
  const moodResults = await moodRecommendations(userId, target);
  if (moodResults.length === 0) {
    return (
      <p className="text-xs text-[var(--muted)]">
        まだ分析済みの作品が足りません。検索して数本開くと、気分検索の精度が上がります。
      </p>
    );
  }
  return (
    <ul className="flex flex-col divide-y divide-[var(--line)]">
      {moodResults.map((item) => (
        <li key={item.movie.id}>
          <ScoredMovieRow item={item} />
        </li>
      ))}
    </ul>
  );
}

async function ForYou({ userId }: { userId: string }) {
  const forYou = (await discoverRecommendations(userId)).slice(0, 6);
  if (forYou.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader title="For You" caption="8軸の再ランキング済み" />
      <ul className="flex flex-col divide-y divide-[var(--line)]">
        {forYou.map((item) => (
          <li key={item.movie.id}>
            <ScoredMovieRow item={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}

async function HiddenGems({ userId }: { userId: string }) {
  const hiddenGems = (await discoverRecommendations(userId))
    .filter((r) => r.movie.popularity < 55)
    .slice(0, 6);
  if (hiddenGems.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader title="Hidden Gems" caption="話題の外にある作品" />
      <ScoredMovieCarousel items={hiddenGems} />
    </section>
  );
}

async function OutsideBubble({ userId }: { userId: string }) {
  const outsideBubble = [...(await discoverRecommendations(userId))]
    .sort((a, b) => a.score.match - b.score.match)
    .slice(0, 4);
  if (outsideBubble.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader title="Outside Your Bubble" caption="嗜好から少し離れた提案" />
      <ScoredMovieCarousel items={outsideBubble} />
    </section>
  );
}
