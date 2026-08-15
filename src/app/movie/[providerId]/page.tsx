import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AXIS_LABELS } from "@/lib/dna/axes";
import {
  ensureMovieByProviderId,
  movieCast,
  movieGenres,
  posterUrl,
  backdropUrl,
} from "@/lib/movies/repository";
import { getUserTasteContext, scoreMovieForUser, similarMovies } from "@/lib/recommend/engine";
import { sharedStrengths } from "@/lib/recommend/for-you";
import { BottomNav } from "@/components/bottom-nav";
import { MovieActions } from "@/components/movie-actions";
import { PosterFrame, ScoreBlock, releaseYear } from "@/components/movie-visuals";
import { RatingInput } from "@/components/rating-input";
import { ReviewForm } from "@/components/review-form";
import { SectionHeader } from "@/components/movie-list";
import { LikeButton, SpoilerText } from "@/components/community-buttons";

export const dynamic = "force-dynamic";

export default async function MovieDetailPage({ params }: { params: Promise<{ providerId: string }> }) {
  const { providerId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const movie = await ensureMovieByProviderId(providerId);
  if (!movie) notFound();

  const ctx = await getUserTasteContext(user.id);
  const [scored, rating, shelves, reviews, similar] = await Promise.all([
    scoreMovieForUser(movie, ctx),
    prisma.rating.findUnique({ where: { userId_movieId: { userId: user.id, movieId: movie.id } } }),
    prisma.shelf.findMany({
      where: { userId: user.id },
      include: { movies: { where: { movieId: movie.id }, select: { id: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.review.findMany({
      where: { movieId: movie.id },
      include: { user: true, likes: true },
      orderBy: { createdAt: "desc" },
    }),
    similarMovies(movie, 6),
  ]);

  const shelfState = {
    watched: shelves.some((s) => s.kind === "watched" && s.movies.length > 0),
    favorites: shelves.some((s) => s.kind === "favorites" && s.movies.length > 0),
    want_to_watch: shelves.some((s) => s.kind === "want_to_watch" && s.movies.length > 0),
  };
  const customShelves = shelves
    .filter((s) => s.kind === "custom")
    .map((s) => ({ id: s.id, name: s.name, contains: s.movies.length > 0 }));

  const myReview = reviews.find((r) => r.userId === user.id);
  const genres = movieGenres(movie);
  const cast = movieCast(movie).slice(0, 6);
  const strengths = sharedStrengths(ctx.dna, scored.vector, 3);
  const backdrop = backdropUrl(movie);

  return (
    <div className="min-h-dvh pb-28">
      <div className="mx-auto max-w-3xl px-5">
        <div
          className="-mx-5 mb-6 h-44 bg-cover bg-center opacity-60"
          style={backdrop ? { backgroundImage: `url(${backdrop})` } : { background: "var(--surface-2)" }}
        />

        <main className="flex flex-col gap-10">
          <section className="flex gap-5">
            <PosterFrame
              title={movie.title}
              posterUrl={posterUrl(movie)}
              year={releaseYear(movie.releaseDate)}
              className="w-32 shrink-0"
              sizes="128px"
            />
            <div className="flex flex-col gap-2">
              <h1 className="display text-2xl leading-tight">{movie.title}</h1>
              {movie.originalTitle && movie.originalTitle !== movie.title ? (
                <p className="text-xs text-[var(--muted)]">{movie.originalTitle}</p>
              ) : null}
              <p className="label">
                {releaseYear(movie.releaseDate)}
                {movie.runtime ? ` · ${movie.runtime}分` : ""}
                {movie.director ? ` · ${movie.director}` : ""}
              </p>
              <p className="text-xs text-[var(--muted)]">{genres.join(" / ")}</p>
            </div>
          </section>

          <section className="grid grid-cols-3 gap-4 border-y border-[var(--line)] py-5">
            <ScoreBlock label="For You" value={scored.score.predicted.toFixed(1)} strong />
            <ScoreBlock label="Match" value={`${scored.score.match}`} suffix="%" />
            <ScoreBlock
              label="Community"
              value={scored.community.average ? scored.community.average.toFixed(1) : "—"}
              suffix={scored.community.count ? `${scored.community.count}件` : undefined}
            />
          </section>

          <section className="flex flex-col gap-3">
            <p className="text-sm leading-relaxed text-[var(--muted)]">{scored.explanation}</p>
            <div className="flex flex-wrap gap-2">
              {strengths.map((axis) => (
                <span key={axis} className="label border border-[var(--line)] px-2 py-1">
                  {AXIS_LABELS[axis].label}
                </span>
              ))}
            </div>
            <p className="font-mono text-[10px] text-[var(--muted)]">
              CONFIDENCE {(scored.score.confidence * 100).toFixed(0)}%
              {scored.external
                ? ` · ${scored.external.provider.toUpperCase()} ${scored.external.score.toFixed(1)}/${scored.external.scale} (${scored.external.voteCount})`
                : ""}
            </p>
          </section>

          <section className="flex flex-col gap-5">
            <SectionHeader title="Your Rating" caption="0.5 — 5.0" />
            <RatingInput providerId={movie.providerId} initialScore={rating?.score ?? null} />
            <MovieActions providerId={movie.providerId} initial={shelfState} customShelves={customShelves} />
          </section>

          {movie.overview ? (
            <section className="flex flex-col gap-3">
              <SectionHeader title="Overview" />
              <p className="text-sm leading-relaxed">{movie.overview}</p>
            </section>
          ) : null}

          {cast.length > 0 ? (
            <section className="flex flex-col gap-3">
              <SectionHeader title="Cast" />
              <p className="text-sm text-[var(--muted)]">{cast.join(" · ")}</p>
            </section>
          ) : null}

          {similar.length > 0 ? (
            <section className="flex flex-col gap-4">
              <SectionHeader title="Similar Structure" caption="8軸距離が近い作品" />
              <ul className="no-scrollbar -mx-5 flex gap-4 overflow-x-auto px-5">
                {similar.map((item) => (
                  <li key={item.movie.id} className="w-24 shrink-0">
                    <Link href={`/movie/${item.movie.providerId}`}>
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
            </section>
          ) : null}

          <section className="flex flex-col gap-5">
            <SectionHeader title="Reviews" caption={`${reviews.length}`} />
            <ReviewForm
              providerId={movie.providerId}
              initialText={myReview?.text}
              initialSpoiler={myReview?.spoiler}
            />
            <ul className="flex flex-col gap-6">
              {reviews.map((review) => (
                <li key={review.id} className="flex flex-col gap-2 border-t border-[var(--line)] pt-4">
                  <Link href={`/u/${review.userId}`} className="label">
                    {review.user.name}
                  </Link>
                  {review.spoiler ? (
                    <SpoilerText text={review.text} />
                  ) : (
                    <p className="text-sm leading-relaxed">{review.text}</p>
                  )}
                  <LikeButton
                    reviewId={review.id}
                    initialLiked={review.likes.some((like) => like.userId === user.id)}
                    initialCount={review.likes.length}
                  />
                </li>
              ))}
            </ul>
          </section>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
