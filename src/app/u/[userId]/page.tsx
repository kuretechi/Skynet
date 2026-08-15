import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { pickVector } from "@/lib/dna/axes";
import { getCineType } from "@/lib/dna/cinetype";
import { TypeCode } from "@/components/type-code";
import { typeInk } from "@/lib/theme";
import { BottomNav } from "@/components/bottom-nav";
import { CinemaCrystal } from "@/components/cinema-crystal";
import { FollowButton } from "@/components/community-buttons";
import { SectionHeader } from "@/components/movie-list";
import { releaseYear } from "@/components/movie-visuals";
import { ShelfRack } from "@/components/shelf-rack";
import { posterUrl } from "@/lib/movies/repository";

export const dynamic = "force-dynamic";

export default async function PublicProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/login");

  const profile = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      dna: true,
      shelves: { include: { movies: { include: { movie: true }, take: 20, orderBy: { addedAt: "desc" } } } },
      ratings: true,
    },
  });
  if (!profile) notFound();

  const type = getCineType(profile.dna?.cineTypeId);
  const vector = profile.dna ? pickVector(profile.dna as unknown as Record<string, unknown>) : null;
  const ratingByMovie = new Map(profile.ratings.map((r) => [r.movieId, r.score]));
  const following = viewer.id !== profile.id
    ? Boolean(
        await prisma.follow.findUnique({
          where: { followerId_followingId: { followerId: viewer.id, followingId: profile.id } },
        }),
      )
    : false;

  return (
    <div className="min-h-dvh pb-28">
      <main className="mx-auto flex max-w-3xl flex-col gap-10 px-5 pt-10">
        <header className="flex flex-col items-center gap-3 text-center">
          {vector ? <CinemaCrystal vector={vector} size={220} accent={type?.accent ?? "#d8a657"} showLabels={false} /> : null}
          <h1 className="display text-2xl">{profile.name}</h1>
          {type ? (
            <div className="flex flex-col items-center gap-1">
              {vector ? <TypeCode vector={vector} accent={typeInk(type.accent)} /> : null}
              <p className="label">
                {type.name} — {type.tagline}
              </p>
            </div>
          ) : (
            <p className="label">NO DNA YET</p>
          )}
          {viewer.id !== profile.id ? <FollowButton userId={profile.id} initialFollowing={following} /> : null}
        </header>

        {profile.shelves.map((shelf) =>
          shelf.movies.length > 0 ? (
            <section key={shelf.id} className="flex flex-col gap-4">
              <SectionHeader title={shelf.name} caption={`${shelf.movies.length}`} />
              <ShelfRack
                items={shelf.movies.map((item) => ({
                  id: item.id,
                  title: item.movie.title,
                  providerId: item.movie.providerId,
                  year: releaseYear(item.movie.releaseDate),
                  rating: ratingByMovie.get(item.movieId) ?? null,
                  posterUrl: posterUrl(item.movie),
                }))}
              />
            </section>
          ) : null,
        )}

        <Link href="/community" className="label border border-[var(--line)] px-4 py-3 text-center">
          BACK TO COMMUNITY
        </Link>
      </main>
      <BottomNav />
    </div>
  );
}
