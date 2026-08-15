import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { euclideanDistance } from "@/lib/dna/axes";
import { RECOMMENDATION_POOL_SIZE } from "@/lib/config";
import { getUserTasteContext, recommendForUser, scoreMovieForUser } from "@/lib/recommend/engine";
import { getMood, MOODS } from "@/lib/recommend/moods";
import { prisma } from "@/lib/db";
import { MovieSearch } from "@/components/movie-search";
import { ScoredMovieCarousel, ScoredMovieRow, SectionHeader } from "@/components/movie-list";

export const dynamic = "force-dynamic";

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ mood?: string }>;
}) {
  const { mood: moodId } = await searchParams;
  const user = await requireUser();
  const mood = getMood(moodId);

  const recommendations = await recommendForUser(user.id, {
    limit: RECOMMENDATION_POOL_SIZE,
    poolSize: RECOMMENDATION_POOL_SIZE,
  });

  const forYou = recommendations.slice(0, 6);
  const hiddenGems = recommendations
    .filter((r) => r.movie.popularity < 55)
    .slice(0, 6);
  const outsideBubble = [...recommendations].sort((a, b) => a.score.match - b.score.match).slice(0, 4);

  let moodResults: typeof recommendations = [];
  if (mood) {
    const ctx = await getUserTasteContext(user.id);
    const cached = await prisma.movieFeature.findMany({ include: { movie: true }, take: 200 });
    const ranked = cached
      .map((f) => ({
        movie: f.movie,
        distance: euclideanDistance(mood.target, {
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
    moodResults = await Promise.all(ranked.map((r) => scoreMovieForUser(r.movie, ctx)));
  }

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
          moodResults.length > 0 ? (
            <ul className="flex flex-col divide-y divide-[var(--line)]">
              {moodResults.map((item) => (
                <li key={item.movie.id}>
                  <ScoredMovieRow item={item} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-[var(--muted)]">
              まだ分析済みの作品が足りません。検索して数本開くと、気分検索の精度が上がります。
            </p>
          )
        ) : null}
      </section>

      {forYou.length > 0 ? (
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
      ) : null}

      {hiddenGems.length > 0 ? (
        <section className="flex flex-col gap-4">
          <SectionHeader title="Hidden Gems" caption="話題の外にある作品" />
          <ScoredMovieCarousel items={hiddenGems} />
        </section>
      ) : null}

      {outsideBubble.length > 0 ? (
        <section className="flex flex-col gap-4">
          <SectionHeader title="Outside Your Bubble" caption="嗜好から少し離れた提案" />
          <ScoredMovieCarousel items={outsideBubble} />
        </section>
      ) : null}
    </main>
  );
}
