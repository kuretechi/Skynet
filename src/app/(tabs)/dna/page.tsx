import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AXIS_LABELS, pickVector, type Axis } from "@/lib/dna/axes";
import { getCineType, rankCineTypes, topAxes } from "@/lib/dna/cinetype";
import { FEATURE_VERSION, featureVector } from "@/lib/features/generate";
import { typeInk } from "@/lib/theme";
import { CinemaCrystal, DnaBars } from "@/components/cinema-crystal";
import { TypeCode, TypeCodeMeters } from "@/components/type-code";
import { cineCode } from "@/lib/dna/code";
import { TasteUniverse, type UniversePoint } from "@/components/taste-universe";
import { SectionHeader } from "@/components/movie-list";
import { ONBOARDING_TARGET_RATINGS } from "@/lib/config";

/** Round numbers worth celebrating, so the count itself becomes content. */
const MILESTONES = [10, 25, 50, 100, 200, 365, 500, 1000];

export const dynamic = "force-dynamic";

function StatCard({
  label,
  value,
  unit,
  strong = false,
}: {
  label: string;
  value: string;
  unit: string;
  strong?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 border border-[var(--line)] px-3 py-4">
      <span className="label text-[10px] text-[var(--muted)]">{label}</span>
      <span className="flex items-baseline gap-1">
        <span
          className="display text-3xl"
          style={strong ? { color: "var(--accent)" } : undefined}
        >
          {value}
        </span>
        <span className="font-mono text-[10px] text-[var(--muted)]">{unit}</span>
      </span>
    </div>
  );
}

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
  const { code } = cineCode(vector);

  const [ratings, watched, wantToWatchCount] = await Promise.all([
    prisma.rating.findMany({ where: { userId: user.id } }),
    prisma.watchHistory.findMany({
      where: { userId: user.id },
      select: { movieId: true, movie: { select: { runtime: true } } },
    }),
    prisma.shelfMovie.count({ where: { shelf: { userId: user.id, kind: "want_to_watch" } } }),
  ]);
  const ratingByMovie = new Map(ratings.map((r) => [r.movieId, r.score]));
  const masterpieceIds = new Set(ratings.filter((r) => r.masterpiece).map((r) => r.movieId));
  const watchedIds = new Set(watched.map((w) => w.movieId));
  const runtimeByMovie = new Map(watched.map((entry) => [entry.movieId, entry.movie.runtime]));
  const screenTimeMinutes = [...runtimeByMovie.values()].reduce<number>((sum, runtime) => sum + (runtime ?? 0), 0);
  const screenTime = `${Math.floor(screenTimeMinutes / 60)}h ${screenTimeMinutes % 60}m`;
  // Recent catalogue backfills continuously change generatedAt. If the
  // universe is a plain "latest 120" query, that pushes older watched films
  // (including masterpieces) out of view between reloads. Pin every title the
  // user has interacted with, then add a bounded recommendation backdrop.
  const personalMovieIds = [...new Set([...watchedIds, ...ratings.map((rating) => rating.movieId)])];
  const [personalFeatures, recommendedFeatures] = await Promise.all([
    personalMovieIds.length > 0
      ? prisma.movieFeature.findMany({
          where: { featureVersion: FEATURE_VERSION, movieId: { in: personalMovieIds } },
          include: { movie: true },
          orderBy: { generatedAt: "desc" },
        })
      : [],
    prisma.movieFeature.findMany({
      where: {
        featureVersion: FEATURE_VERSION,
        ...(personalMovieIds.length > 0 ? { movieId: { notIn: personalMovieIds } } : {}),
      },
      include: { movie: true },
      take: 120,
      orderBy: { generatedAt: "desc" },
    }),
  ]);
  const features = [...recommendedFeatures, ...personalFeatures];
  const nextMilestone = MILESTONES.find((m) => m > watched.length) ?? null;

  const points: UniversePoint[] = features.map((f) => ({
    id: f.movieId,
    title: f.movie.title,
    providerId: f.movie.providerId,
    vector: featureVector(f),
    rating: ratingByMovie.get(f.movieId) ?? null,
    watched: watchedIds.has(f.movieId),
    masterpiece: masterpieceIds.has(f.movieId),
  }));

  return (
    <main className={`flex flex-col gap-12 pt-10 ${reveal ? "reveal" : ""}`}>
      <header className="flex flex-col items-center gap-4 text-center">
        <span className="label">Your Type Code</span>
        <CinemaCrystal vector={vector} size={300} accent={primary.accent} />
        <h1 className="sr-only">
          {code} {primary.name}
        </h1>
        <TypeCode vector={vector} accent={typeInk(primary.accent)} />
        <p className="label">{primary.name}</p>
        <p className="text-sm text-[var(--muted)]">{primary.tagline}</p>
        <p className="max-w-md text-sm leading-relaxed">{primary.description}</p>
        <p className="font-mono text-[11px] text-[var(--muted)]">
          CONFIDENCE {(user.dna.confidence * 100).toFixed(0)}% · {user.dna.ratingCount} RATINGS · FEATURE{" "}
          {user.dna.featureVersion}
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <SectionHeader
          title="Cinema Life"
          caption={
            nextMilestone
              ? `次の節目 ${nextMilestone} 本まであと ${nextMilestone - watched.length} 本`
              : "全マイルストーン達成"
          }
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="WATCHED" value={`${watched.length}`} unit="本" strong />
          <StatCard label="MASTERPIECE" value={`${masterpieceIds.size}`} unit="本" />
          <StatCard label="WANT TO WATCH" value={`${wantToWatchCount}`} unit="本" />
          <StatCard label="SCREEN TIME" value={screenTime} unit="" />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader title="Type Code" caption="8軸を4つの対で読む / 中央に近いほど拮抗" />
        <TypeCodeMeters vector={vector} accent={typeInk(primary.accent)} />
      </section>

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
          <SectionHeader title="Taste Universe" caption="8軸=8面の3D特徴空間 / 観た作品＝実点・未見＝輪郭" />
          <TasteUniverse points={points} />
        </section>
      ) : null}
    </main>
  );
}
