import { cache, Suspense } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { pickVector } from "@/lib/dna/axes";
import { getCineType } from "@/lib/dna/cinetype";
import { recommendForUser, scoreMoviesForUser, getUserTasteContext } from "@/lib/recommend/engine";
import { CinemaCrystal } from "@/components/cinema-crystal";
import { TypeCode } from "@/components/type-code";
import { typeInk } from "@/lib/theme";
import { ScoredMovieCarousel, ScoredMovieGrid, SectionHeader } from "@/components/movie-list";
import { PosterFrame, releaseYear } from "@/components/movie-visuals";
import { posterUrl } from "@/lib/movies/repository";
import { RatingInput } from "@/components/rating-input";
import { WatchlistButton } from "@/components/watchlist-button";
import { watchlistMovieIds } from "@/lib/shelves";
import { CarouselSkeleton, HeroSkeleton, SectionSkeleton } from "@/components/skeletons";

export const dynamic = "force-dynamic";

/** Shared by the two sections it feeds, so the work happens once per request. */
const homeRecommendations = cache((userId: string) => recommendForUser(userId, { limit: 30, poolSize: 60 }));

/**
 * The page shell only needs the signed-in user, so it is sent immediately and
 * every section that has to talk to the database streams in behind its own
 * Suspense boundary instead of holding up the first byte.
 */
export default async function HomePage() {
  const user = await requireUser();
  const dna = user.dna ? pickVector(user.dna as unknown as Record<string, unknown>) : null;
  const cineType = getCineType(user.dna?.cineTypeId);

  return (
    <main className="flex flex-col gap-12 pt-10">
      <header className="flex items-start justify-between">
        <div>
          <span className="label">Tonight</span>
          <h1 className="display mt-2 text-2xl">{user.name} の映画棚</h1>
        </div>
        <Link href="/profile" className="label border border-[var(--line)] px-3 py-2">
          PROFILE
        </Link>
      </header>

      <Suspense fallback={<HeroSkeleton />}>
        <Tonight userId={user.id} />
      </Suspense>

      <Suspense fallback={<CarouselSkeleton title="Watchlist" />}>
        <HomeWatchlist userId={user.id} />
      </Suspense>

      <Suspense fallback={null}>
        <ContinueRating userId={user.id} />
      </Suspense>

      <Suspense fallback={<CarouselSkeleton title="For You" />}>
        <ForYouRecommendations userId={user.id} />
      </Suspense>

      <Suspense fallback={<CarouselSkeleton title="Recently Watched" />}>
        <RecentlyWatched userId={user.id} />
      </Suspense>

      {dna ? (
        <section className="flex flex-col gap-4">
          <SectionHeader title="Cinema DNA Update" caption={`${user.dna?.ratingCount ?? 0} ratings`} />
          <Link href="/dna" className="flex items-center gap-6">
            <CinemaCrystal vector={dna} size={140} showLabels={false} accent={cineType?.accent ?? "#d8a657"} />
            <div>
              {cineType ? (
                <TypeCode vector={dna} accent={typeInk(cineType.accent)} />
              ) : (
                <p className="display text-xl">ANALYZING</p>
              )}
              <p className="label mt-2">{cineType?.name}</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{cineType?.tagline}</p>
            </div>
          </Link>
        </section>
      ) : null}

      <Suspense fallback={<SectionSkeleton title="Friends Activity" rows={2} />}>
        <FriendsActivity userId={user.id} />
      </Suspense>
    </main>
  );
}

async function Tonight({ userId }: { userId: string }) {
  const [recommendations, watchlist] = await Promise.all([
    homeRecommendations(userId),
    watchlistMovieIds(userId),
  ]);
  const [tonight] = recommendations;
  if (!tonight) return null;

  return (
      <section className="flex flex-col gap-5">
        <SectionHeader
          title="Tonight For You"
          caption={`${tonight.score.match}% MATCH · CONF ${Math.round(tonight.score.confidence * 100)}%`}
        />
        <Link href={`/movie/${tonight.movie.providerId}`} prefetch={false} className="flex flex-col gap-5">
          <div className="flex gap-5">
            <PosterFrame
              title={tonight.movie.title}
              posterUrl={posterUrl(tonight.movie)}
              year={releaseYear(tonight.movie.releaseDate)}
              className="w-32 shrink-0"
              sizes="128px"
            />
            <div className="flex flex-col justify-between">
              <div>
                <h3 className="display text-3xl leading-tight">{tonight.movie.title}</h3>
                <p className="label mt-2">
                  {releaseYear(tonight.movie.releaseDate)}
                  {tonight.movie.director ? ` · ${tonight.movie.director}` : ""}
                </p>
              </div>
              <div className="mt-4">
                <span className="label">For You</span>
                <p className="display text-4xl text-[var(--accent)]">{tonight.score.predicted.toFixed(1)}</p>
              </div>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-[var(--muted)]">{tonight.explanation}</p>
        </Link>
        <div className="self-start">
          <WatchlistButton
            providerId={tonight.movie.providerId}
            initial={watchlist.has(tonight.movie.id)}
          />
        </div>
      </section>
  );
}

async function HomeWatchlist({ userId }: { userId: string }) {
  const [items, total] = await Promise.all([
    prisma.shelfMovie.findMany({
      where: { shelf: { userId, kind: "want_to_watch" } },
      include: { movie: true },
      orderBy: { addedAt: "desc" },
      take: 10,
    }),
    prisma.shelfMovie.count({ where: { shelf: { userId, kind: "want_to_watch" } } }),
  ]);
  if (items.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader title="Watchlist" caption={`${total} saved`} />
      <ul className="no-scrollbar -mx-5 flex gap-4 overflow-x-auto px-5">
        {items.map((item) => (
          <li key={item.id} className="w-24 shrink-0">
            <Link href={`/movie/${item.movie.providerId}`} prefetch={false}>
              <PosterFrame
                title={item.movie.title}
                posterUrl={posterUrl(item.movie)}
                year={releaseYear(item.movie.releaseDate)}
                className="w-24"
                sizes="96px"
              />
              <p className="mt-2 truncate text-[11px]">{item.movie.title}</p>
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/shelf" className="label self-end text-[var(--accent)]">
        VIEW ALL
      </Link>
    </section>
  );
}

async function ForYouRecommendations({ userId }: { userId: string }) {
  const [recommendations, watchlist] = await Promise.all([
    homeRecommendations(userId),
    watchlistMovieIds(userId),
  ]);
  const [, ...rest] = recommendations;
  if (rest.length === 0) return null;
  const initial = rest.slice(0, 9);
  const expanded = rest.slice(9);

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader title="For You" caption={`${rest.length} recommendations`} />
      <ScoredMovieCarousel items={initial} watchlist={watchlist} />
      {expanded.length > 0 ? <details className="group border-t border-[var(--line)] pt-3">
        <summary className="label cursor-pointer list-none text-center text-[var(--accent)] group-open:mb-5">
          <span className="group-open:hidden">MORE · VIEW POSTER GRID</span><span className="hidden group-open:inline">CLOSE POSTER GRID</span>
        </summary>
        <ScoredMovieGrid items={expanded} watchlist={watchlist} />
      </details> : null}
    </section>
  );
}

async function ContinueRating({ userId }: { userId: string }) {
  const [wantToWatch, ctx] = await Promise.all([
    prisma.shelfMovie.findMany({
      where: { shelf: { userId, kind: "want_to_watch" } },
      include: { movie: true },
      orderBy: { addedAt: "desc" },
      take: 6,
    }),
    getUserTasteContext(userId),
  ]);

  const unrated = wantToWatch.filter((s) => !ctx.ratedMovieIds.has(s.movieId)).slice(0, 3);
  const continueRating = await scoreMoviesForUser(unrated.map((s) => s.movie), ctx);
  if (continueRating.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader title="Continue Rating" caption="観たならスコアを" />
      <ul className="flex flex-col divide-y divide-[var(--line)]">
        {continueRating.map((item) => (
          <li key={item.movie.id} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm">{item.movie.title}</p>
              <p className="label mt-1">{releaseYear(item.movie.releaseDate)}</p>
            </div>
            <RatingInput providerId={item.movie.providerId} compact />
          </li>
        ))}
      </ul>
    </section>
  );
}

async function RecentlyWatched({ userId }: { userId: string }) {
  const [watchHistory, shelfCount] = await Promise.all([
    prisma.watchHistory.findMany({
      where: { userId },
      include: { movie: true },
      orderBy: { watchedAt: "desc" },
      take: 8,
    }),
    prisma.shelfMovie.count({ where: { shelf: { userId } } }),
  ]);
  if (watchHistory.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader title="Recently Watched" caption={`${shelfCount} items on your shelf`} />
      <ul className="no-scrollbar -mx-5 flex gap-4 overflow-x-auto px-5">
        {watchHistory.map((entry) => (
          <li key={entry.id} className="w-24 shrink-0">
            <Link href={`/movie/${entry.movie.providerId}`} prefetch={false}>
              <PosterFrame
                title={entry.movie.title}
                posterUrl={posterUrl(entry.movie)}
                year={releaseYear(entry.movie.releaseDate)}
                className="w-24"
                sizes="96px"
              />
              <p className="mt-2 truncate text-[11px]">{entry.movie.title}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

async function FriendsActivity({ userId }: { userId: string }) {
  const friendReviews = await prisma.review.findMany({
    where: { user: { followers: { some: { followerId: userId } } } },
    include: { user: true, movie: true },
    orderBy: { createdAt: "desc" },
    take: 3,
  });
  if (friendReviews.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader title="Friends Activity" />
      <ul className="flex flex-col divide-y divide-[var(--line)]">
        {friendReviews.map((review) => (
          <li key={review.id} className="py-3">
            <p className="label">{review.user.name}</p>
            <Link href={`/movie/${review.movie.providerId}`} prefetch={false} className="text-sm">
              {review.movie.title}
            </Link>
            <p className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">
              {review.spoiler ? "（ネタバレを含むレビュー）" : review.text}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
