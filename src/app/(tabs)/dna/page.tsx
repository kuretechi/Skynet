import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AXIS_LABELS, pickVector, type Axis } from "@/lib/dna/axes";
import { getCineType, rankCineTypes, topAxes } from "@/lib/dna/cinetype";
import { featureVector } from "@/lib/features/generate";
import { typeInk } from "@/lib/theme";
import { CinemaCrystal, DnaBars } from "@/components/cinema-crystal";
import { TasteUniverse, type UniversePoint } from "@/components/taste-universe";
import { SectionHeader } from "@/components/movie-list";
import { ONBOARDING_TARGET_RATINGS } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function DnaPage({ searchParams }: { searchParams: Promise<{ reveal?: string }> }) {
  const { reveal } = await searchParams;
  const user = await requireUser();

  if (!user.dna || user.dna.ratingCount === 0) {
    return (
      <main className="flex flex-col gap-6 pt-10">
        <span className="label">Cinema DNA</span>
        <h1 className="display text-2xl">まだ DNA を生成できていません。</h1>
        <p className="text-sm text-[var(--muted)]">
          映画を {ONBOARDING_TARGET_RATINGS} 本ほど評価すると、8軸のプロファイルと CineType が決まります。
        </p>
        <Link href="/discover" className="label border border-[var(--accent)] px-4 py-3 text-center text-[var(--accent)]">
          RATE MOVIES
        </Link>
      </main>
    );
  }

  const vector = pickVector(user.dna as unknown as Record<string, unknown>);
  const ranked = rankCineTypes(vector);
  const primary = getCineType(user.dna.cineTypeId) ?? ranked[0].type;
  const secondary = ranked.slice(1, 3);
  const strongest = topAxes(vector, 3);

  const features = await prisma.movieFeature.findMany({
    include: { movie: true },
    take: 120,
    orderBy: { generatedAt: "desc" },
  });
  const [ratings, watched] = await Promise.all([
    prisma.rating.findMany({ where: { userId: user.id } }),
    prisma.watchHistory.findMany({ where: { userId: user.id }, select: { movieId: true } }),
  ]);
  const ratingByMovie = new Map(ratings.map((r) => [r.movieId, r.score]));
  const watchedIds = new Set(watched.map((w) => w.movieId));

  const points: UniversePoint[] = features.map((f) => ({
    id: f.movieId,
    title: f.movie.title,
    providerId: f.movie.providerId,
    vector: featureVector(f),
    rating: ratingByMovie.get(f.movieId) ?? null,
    watched: watchedIds.has(f.movieId),
  }));

  return (
    <main className={`flex flex-col gap-12 pt-10 ${reveal ? "reveal" : ""}`}>
      <header className="flex flex-col items-center gap-4 text-center">
        <span className="label">Your CineType</span>
        <CinemaCrystal vector={vector} size={300} accent={primary.accent} />
        <h1 className="display text-3xl" style={{ color: typeInk(primary.accent) }}>
          {primary.name}
        </h1>
        <p className="text-sm text-[var(--muted)]">{primary.tagline}</p>
        <p className="max-w-md text-sm leading-relaxed">{primary.description}</p>
        <p className="font-mono text-[11px] text-[var(--muted)]">
          CONFIDENCE {(user.dna.confidence * 100).toFixed(0)}% · {user.dna.ratingCount} RATINGS · FEATURE{" "}
          {user.dna.featureVersion}
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <SectionHeader title="8 Axes" caption={strongest.map((a: Axis) => AXIS_LABELS[a].label).join(" / ")} />
        <DnaBars vector={vector} />
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader title="Nearby Types" caption="境界にいるタイプ" />
        <ul className="flex flex-col divide-y divide-[var(--line)]">
          {secondary.map((match) => (
            <li key={match.type.id} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm" style={{ color: typeInk(match.type.accent) }}>
                  {match.type.name}
                </p>
                <p className="text-xs text-[var(--muted)]">{match.type.tagline}</p>
              </div>
              <span className="font-mono text-xs text-[var(--muted)]">
                {(match.similarity * 100).toFixed(0)}%
              </span>
            </li>
          ))}
        </ul>
      </section>

      {points.length > 0 ? (
        <section className="flex flex-col gap-4">
          <SectionHeader title="Taste Universe" caption="3D特徴空間 / 観た作品＝実点・未見＝輪郭 / ドラッグで回転" />
          <TasteUniverse points={points} />
        </section>
      ) : null}
    </main>
  );
}
