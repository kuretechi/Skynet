import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCineType } from "@/lib/dna/cinetype";
import { signOutAction } from "@/lib/actions";
import { getMovieProvider } from "@/lib/movies/provider";
import { SectionHeader } from "@/components/movie-list";
import { ThemeMenu } from "@/components/theme-menu";
import { typeInk } from "@/lib/theme";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser();
  const [ratings, reviews, shelfCount, followers, following] = await Promise.all([
    prisma.rating.count({ where: { userId: user.id } }),
    prisma.review.count({ where: { userId: user.id } }),
    prisma.shelfMovie.count({ where: { shelf: { userId: user.id } } }),
    prisma.follow.count({ where: { followingId: user.id } }),
    prisma.follow.count({ where: { followerId: user.id } }),
  ]);
  const type = getCineType(user.dna?.cineTypeId);

  return (
    <main className="flex flex-col gap-10 pt-10">
      <header className="flex flex-col gap-2">
        <span className="label">Profile</span>
        <h1 className="display text-2xl">{user.name}</h1>
        <p className="text-xs text-[var(--muted)]">{user.email}</p>
        {type ? (
          <p className="label" style={{ color: typeInk(type.accent) }}>
            {type.name}
          </p>
        ) : null}
      </header>

      <section className="grid grid-cols-3 gap-4 border-y border-[var(--line)] py-5 text-center">
        {[
          { label: "Ratings", value: ratings },
          { label: "Shelf", value: shelfCount },
          { label: "Reviews", value: reviews },
          { label: "Followers", value: followers },
          { label: "Following", value: following },
        ].map((stat) => (
          <div key={stat.label} className="flex flex-col gap-1">
            <span className="display text-xl">{stat.value}</span>
            <span className="label">{stat.label}</span>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeader title="Theme" />
        <ThemeMenu />
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeader title="Data Source" />
        <p className="text-xs leading-relaxed text-[var(--muted)]">
          Movie metadata provider: <span className="text-[var(--foreground)]">{getMovieProvider().name}</span>
          {getMovieProvider().name === "tmdb"
            ? " — This product uses the TMDB API but is not endorsed or certified by TMDB."
            : " — 開発用のモックカタログで動作しています。TMDB_API_KEY を設定すると実データに切り替わります。"}
        </p>
        <p className="text-xs leading-relaxed text-[var(--muted)]">
          あなたの評価・棚・DNA は first-party データとして保存され、外部メタデータとは分離されています。
        </p>
      </section>

      <div className="flex flex-col gap-3">
        <Link href={`/u/${user.id}`} className="label border border-[var(--line)] px-4 py-3 text-center">
          VIEW PUBLIC PROFILE
        </Link>
        <form action={signOutAction}>
          <button type="submit" className="label w-full border border-[var(--line)] px-4 py-3 text-[var(--muted)]">
            SIGN OUT
          </button>
        </form>
      </div>
    </main>
  );
}
