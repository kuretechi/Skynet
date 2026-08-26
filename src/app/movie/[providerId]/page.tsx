import { Suspense } from "react";
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
import { CreateRoomButton } from "@/components/create-room-button";
import { MovieActions } from "@/components/movie-actions";
import { MovieNote } from "@/components/movie-note";
import { MovieHero } from "@/components/movie-hero";
import { PosterFrame, ScoreBlock, releaseYear } from "@/components/movie-visuals";
import { RatingMasterpieceControls } from "@/components/rating-masterpiece-controls";
import { ReviewSection } from "@/components/review-section";
import { SectionHeader } from "@/components/movie-list";
import { CarouselSkeleton, SectionSkeleton } from "@/components/skeletons";
import type { Movie } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function MovieDetailPage({ params }: { params: Promise<{ providerId: string }> }) {
  const { providerId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [movie, ctx] = await Promise.all([
    ensureMovieByProviderId(providerId),
    getUserTasteContext(user.id),
  ]);
  if (!movie) notFound();

  const [scored, rating, note, shelves] = await Promise.all([
    scoreMovieForUser(movie, ctx),
    prisma.rating.findUnique({ where: { userId_movieId: { userId: user.id, movieId: movie.id } } }),
    prisma.movieNote.findUnique({ where: { userId_movieId: { userId: user.id, movieId: movie.id } } }),
    prisma.shelf.findMany({
      where: { userId: user.id },
      include: { movies: { where: { movieId: movie.id }, select: { id: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const shelfState = {
    watched: shelves.some((s) => s.kind === "watched" && s.movies.length > 0),
    favorites: shelves.some((s) => s.kind === "favorites" && s.movies.length > 0),
    want_to_watch: shelves.some((s) => s.kind === "want_to_watch" && s.movies.length > 0),
  };
  const customShelves = shelves
    .filter((s) => s.kind === "custom")
    .map((s) => ({ id: s.id, name: s.name, contains: s.movies.length > 0 }));

  const genres = movieGenres(movie);
  const cast = movieCast(movie).slice(0, 6);
  const strengths = sharedStrengths(ctx.dna, scored.vector, 3);
  const backdrop = backdropUrl(movie);
  const meta = `${releaseYear(movie.releaseDate)}${movie.runtime ? ` · ${movie.runtime}分` : ""}${
    movie.director ? ` · ${movie.director}` : ""
  }`;

  return (
    <div className="app-with-bottom-nav min-h-dvh">
      <div className="mx-auto max-w-3xl px-5">
        <MovieHero
          title={movie.title}
          originalTitle={movie.originalTitle && movie.originalTitle !== movie.title ? movie.originalTitle : null}
          meta={meta}
          genres={genres.join(" / ")}
          backdrop={backdrop}
          posterUrl={posterUrl(movie)}
          year={releaseYear(movie.releaseDate)}
          score={scored.score.predicted.toFixed(1)}
        />

        <main className="relative z-10 flex flex-col gap-10 pt-10">
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
            <RatingMasterpieceControls
              providerId={movie.providerId}
              initialScore={rating?.score ?? null}
              initialMasterpiece={rating?.masterpiece ?? false}
            />
            <MovieActions providerId={movie.providerId} initial={shelfState} customShelves={customShelves} />
            <CreateRoomButton providerId={movie.providerId} movieTitle={movie.title} />
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeader title="Your Note" caption="自分だけのメモ / 公開されません" />
            <MovieNote providerId={movie.providerId} initial={note?.text ?? ""} />
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

          <Suspense fallback={<CarouselSkeleton title="Similar Structure" />}>
            <SimilarStructure movie={movie} />
          </Suspense>

          <Suspense fallback={<SectionSkeleton title="Reviews" rows={2} />}>
            <Reviews movie={movie} userId={user.id} />
          </Suspense>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}

async function SimilarStructure({ movie }: { movie: Movie }) {
  const similar = await similarMovies(movie, 6);
  if (similar.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader title="Similar Structure" caption="作品特徴が近い作品" />
      <ul className="no-scrollbar -mx-5 flex gap-4 overflow-x-auto px-5">
        {similar.map((item) => (
          <li key={item.movie.id} className="w-24 shrink-0">
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
    </section>
  );
}

async function Reviews({ movie, userId }: { movie: Movie; userId: string }) {
  const reviews = await prisma.review.findMany({
    where: { movieId: movie.id },
    include: { user: true, likes: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <ReviewSection
      providerId={movie.providerId}
      userId={userId}
      initialReviews={reviews.map((review) => ({
        id: review.id,
        userId: review.userId,
        userName: review.user.name,
        text: review.text,
        spoiler: review.spoiler,
        likeCount: review.likes.length,
        liked: review.likes.some((like) => like.userId === userId),
      }))}
    />
  );
}
