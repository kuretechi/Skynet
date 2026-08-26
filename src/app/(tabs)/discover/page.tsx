import { cache, Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { RECOMMENDATION_POOL_SIZE } from "@/lib/config";
import { recommendForUser } from "@/lib/recommend/engine";
import { watchlistMovieIds } from "@/lib/shelves";
import { MovieSearch } from "@/components/movie-search";
import { ScoredMovieCarousel, SectionHeader } from "@/components/movie-list";
import { CarouselSkeleton } from "@/components/skeletons";

export const dynamic = "force-dynamic";
const discoverRecommendations = cache((userId: string) => recommendForUser(userId, { limit: RECOMMENDATION_POOL_SIZE, poolSize: RECOMMENDATION_POOL_SIZE }));

export default async function DiscoverPage() {
  const user = await requireUser();
  return <main className="flex flex-col gap-12 pt-10">
    <header><span className="label">Discover</span><h1 className="display mt-2 text-2xl">次の一本を見つける。</h1></header>
    <section className="flex flex-col gap-4"><MovieSearch unified /></section>
    <Suspense fallback={<CarouselSkeleton title="Hidden Gems" />}><HiddenGems userId={user.id} /></Suspense>
    <Suspense fallback={<CarouselSkeleton title="Outside Your Bubble" />}><OutsideBubble userId={user.id} /></Suspense>
  </main>;
}

async function HiddenGems({ userId }: { userId: string }) {
  const [recommendations, watchlist] = await Promise.all([discoverRecommendations(userId), watchlistMovieIds(userId)]);
  const items = recommendations.filter((item) => item.movie.popularity < 55).slice(0, 6);
  if (items.length === 0) return null;
  return <section className="flex flex-col gap-4"><SectionHeader title="Hidden Gems" caption="話題の外にある作品" /><ScoredMovieCarousel items={items} watchlist={watchlist} /></section>;
}

async function OutsideBubble({ userId }: { userId: string }) {
  const [recommendations, watchlist] = await Promise.all([discoverRecommendations(userId), watchlistMovieIds(userId)]);
  const items = recommendations
    .filter((item) => item.score.match >= 40)
    .sort((a, b) =>
      (a.trace.islandAffinity ?? 1) - (b.trace.islandAffinity ?? 1)
      || b.score.match - a.score.match,
    )
    .slice(0, 4);
  if (items.length === 0) return null;
  return <section className="flex flex-col gap-4"><SectionHeader title="Outside Your Bubble" caption="嗜好から少し離れた提案" /><ScoredMovieCarousel items={items} watchlist={watchlist} /></section>;
}
