import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { pickVector } from "@/lib/dna/axes";
import { getCineType } from "@/lib/dna/cinetype";
import { recommendForUser, scoreMovieForUser, getUserTasteContext } from "@/lib/recommend/engine";
import { CinemaCrystal } from "@/components/cinema-crystal";
import { ScoredMovieCarousel, SectionHeader } from "@/components/movie-list";
import { PosterFrame, releaseYear } from "@/components/movie-visuals";
import { posterUrl } from "@/lib/movies/repository";
import { RatingInput } from "@/components/rating-input";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await requireUser();
  const [recommendations, watchHistory, wantToWatch, shelfCount, friendReviews] = await Promise.all([
    recommendForUser(user.id, { limit: 7 }),
    prisma.watchHistory.findMany({
      where: { userId: user.id },
      include: { movie: true },
      orderBy: { watchedAt: "desc" },
      take: 8,
    }),
    prisma.shelfMovie.findMany({
      where: { shelf: { userId: user.id, kind: "want_to_watch" } },
      include: { movie: true },
      orderBy: { addedAt: "desc" },
      take: 6,
    }),
    prisma.shelfMovie.count({ where: { shelf: { userId: user.id } } }),
    prisma.review.findMany({
      where: { user: { followers: { some: { followerId: user.id } } } },
      include: { user: true, movie: true },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
  ]);

  const [tonight, ...rest] = recommendations;
  const dna = user.dna ? pickVector(user.dna as unknown as Record<string, unknown>) : null;
  const cineType = getCineType(user.dna?.cineTypeId);

  const ctx = await getUserTasteContext(user.id);
  const unrated = wantToWatch.filter((s) => !ctx.ratedMovieIds.has(s.movieId)).slice(0, 3);
  const continueRating = await Promise.all(unrated.map((s) => scoreMovieForUser(s.movie, ctx)));

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

      {tonight ? (
        <section className="flex flex-col gap-5">
          <SectionHeader title="Tonight For You" caption={`${tonight.score.match}% MATCH`} />
          <Link href={`/movie/${tonight.movie.providerId}`} className="flex flex-col gap-5">
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
        </section>
      ) : null}

      {continueRating.length > 0 ? (
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
      ) : null}

      {rest.length > 0 ? (
        <section className="flex flex-col gap-4">
          <SectionHeader title="Because You Loved…" />
          <ScoredMovieCarousel items={rest} />
        </section>
      ) : null}

      {watchHistory.length > 0 ? (
        <section className="flex flex-col gap-4">
          <SectionHeader title="Recently Watched" caption={`${shelfCount} items on your shelf`} />
          <ul className="no-scrollbar -mx-5 flex gap-4 overflow-x-auto px-5">
            {watchHistory.map((entry) => (
              <li key={entry.id} className="w-24 shrink-0">
                <Link href={`/movie/${entry.movie.providerId}`}>
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
      ) : null}

      {dna ? (
        <section className="flex flex-col gap-4">
          <SectionHeader title="Cinema DNA Update" caption={`${user.dna?.ratingCount ?? 0} ratings`} />
          <Link href="/dna" className="flex items-center gap-6">
            <CinemaCrystal vector={dna} size={140} showLabels={false} accent={cineType?.accent ?? "#d8a657"} />
            <div>
              <p className="display text-xl">{cineType?.name ?? "ANALYZING"}</p>
              <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{cineType?.tagline}</p>
            </div>
          </Link>
        </section>
      ) : null}

      {friendReviews.length > 0 ? (
        <section className="flex flex-col gap-4">
          <SectionHeader title="Friends Activity" />
          <ul className="flex flex-col divide-y divide-[var(--line)]">
            {friendReviews.map((review) => (
              <li key={review.id} className="py-3">
                <p className="label">{review.user.name}</p>
                <Link href={`/movie/${review.movie.providerId}`} className="text-sm">
                  {review.movie.title}
                </Link>
                <p className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">
                  {review.spoiler ? "（ネタバレを含むレビュー）" : review.text}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
