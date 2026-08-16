import Link from "next/link";
import { prisma } from "@/lib/db";
import { featureVector } from "@/lib/features/generate";
import { posterUrl } from "@/lib/movies/repository";
import { Logo } from "@/components/logo";
import { DemoFlow, type DemoMovie } from "@/components/demo-flow";
import { releaseYear } from "@/components/movie-visuals";

/**
 * The catalogue is the same for everyone and the whole walkthrough runs in the
 * browser, so the page is prerendered and served from the cache: an audience
 * arriving at once costs one query per revalidation window, not one per person.
 */
export const revalidate = 600;

/** Sign-in free walkthrough: pick a few movies, get a CineType and a Taste Universe. */
export default async function DemoPage() {
  const features = await prisma.movieFeature.findMany({
    include: { movie: true },
    orderBy: { movie: { popularity: "desc" } },
    take: 120,
  });

  const movies: DemoMovie[] = features.map((feature) => ({
    id: feature.movieId,
    providerId: feature.movie.providerId,
    title: feature.movie.title,
    year: releaseYear(feature.movie.releaseDate),
    director: feature.movie.director,
    posterUrl: posterUrl(feature.movie),
    vector: featureVector(feature),
  }));

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-4">
        <Logo size={28} />
        <span className="label">Demo</span>
        <h1 className="display text-3xl leading-relaxed">
          好きな映画を 2〜3本 選ぶと、
          <br />
          あなたの CineType が出ます。
        </h1>
        <p className="text-sm leading-relaxed text-[var(--muted)]">
          ログインは不要です。選んだ作品の特徴から 8 軸の Cinema DNA を計算し、4 文字のタイプコードと Taste
          Universe を表示します。
        </p>
      </header>

      {movies.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">デモ用の作品データがまだありません。</p>
      ) : (
        <DemoFlow movies={movies} />
      )}

      <footer className="flex flex-col gap-3 border-t border-[var(--line)] pt-6">
        <Link
          href="/signup"
          className="label border border-[var(--accent)] px-4 py-4 text-center text-[var(--accent)]"
        >
          START YOUR ARCHIVE
        </Link>
        <Link href="/" className="label border border-[var(--line)] px-4 py-4 text-center">
          BACK
        </Link>
      </footer>
    </main>
  );
}
