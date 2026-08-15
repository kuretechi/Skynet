import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { pickVector } from "@/lib/dna/axes";
import { getCineType } from "@/lib/dna/cinetype";
import { cineCode } from "@/lib/dna/code";
import { posterUrl } from "@/lib/movies/repository";
import { visibleRooms } from "@/lib/rooms/service";
import { typeInk } from "@/lib/theme";
import { FollowButton, LikeButton, SpoilerText } from "@/components/community-buttons";
import { SectionHeader } from "@/components/movie-list";
import { PosterFrame, releaseYear } from "@/components/movie-visuals";

export const dynamic = "force-dynamic";

export default async function CommunityPage() {
  const user = await requireUser();

  const [reviews, suggestions, following, rooms] = await Promise.all([
    prisma.review.findMany({
      include: {
        user: { include: { dna: true } },
        movie: true,
        likes: true,
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.user.findMany({
      where: { id: { not: user.id } },
      include: { dna: true, _count: { select: { ratings: true } } },
      take: 6,
    }),
    prisma.follow.findMany({ where: { followerId: user.id }, select: { followingId: true } }),
    visibleRooms(user.id),
  ]);

  const followingIds = new Set(following.map((f) => f.followingId));

  return (
    <main className="flex flex-col gap-12 pt-10">
      <header>
        <span className="label">Community</span>
        <h1 className="display mt-2 text-2xl">他の人の見方を借りる。</h1>
      </header>

      {rooms.length > 0 ? (
        <section className="flex flex-col gap-4">
          <SectionHeader title="Watch Rooms" caption="外部配信を各自で再生" />
          <ul className="flex flex-col gap-3">
            {rooms.map((room) => (
              <li key={room.id}>
                <Link
                  href={`/room/${room.id}`}
                  className="flex items-center gap-4 border border-[var(--line)] bg-[var(--surface)] p-3"
                >
                  <PosterFrame
                    title={room.movie.title}
                    posterUrl={posterUrl(room.movie)}
                    year={releaseYear(room.movie.releaseDate)}
                    className="w-12 shrink-0"
                    sizes="48px"
                  />
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="text-sm">{room.title}</span>
                    <span className="label text-[var(--muted)]">
                      {room.status === "live" ? "上映中" : "開始待ち"} · HOST {room.host.name} ·{" "}
                      {room._count.members} 人
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {suggestions.length > 0 ? (
        <section className="flex flex-col gap-4">
          <SectionHeader title="Similar CineTypes" />
          <ul className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5">
            {suggestions.map((other) => {
              const type = getCineType(other.dna?.cineTypeId);
              return (
                <li
                  key={other.id}
                  className="flex w-44 shrink-0 flex-col gap-3 border border-[var(--line)] bg-[var(--surface)] p-4"
                >
                  <Link href={`/u/${other.id}`} className="flex flex-col gap-1">
                    <span className="text-sm">{other.name}</span>
                    <span className="label" style={{ color: type ? typeInk(type.accent) : "var(--muted)" }}>
                      {other.dna ? (
                        <span className="font-mono">
                          {cineCode(pickVector(other.dna as unknown as Record<string, unknown>)).code}{" "}
                        </span>
                      ) : null}
                      {type?.name ?? "NO DNA YET"}
                    </span>
                    <span className="font-mono text-[10px] text-[var(--muted)]">
                      {other._count.ratings} RATINGS
                    </span>
                  </Link>
                  <FollowButton userId={other.id} initialFollowing={followingIds.has(other.id)} />
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <SectionHeader title="Review Feed" caption={`${reviews.length} reviews`} />
        {reviews.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">まだレビューがありません。最初の一本を書いてみてください。</p>
        ) : (
          <ul className="flex flex-col gap-8">
            {reviews.map((review) => {
              const type = getCineType(review.user.dna?.cineTypeId);
              return (
                <li key={review.id} className="flex gap-4">
                  <Link href={`/movie/${review.movie.providerId}`} className="w-16 shrink-0">
                    <PosterFrame
                      title={review.movie.title}
                      posterUrl={posterUrl(review.movie)}
                      year={releaseYear(review.movie.releaseDate)}
                      className="w-16"
                      sizes="64px"
                    />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex items-baseline gap-2">
                      <Link href={`/u/${review.user.id}`} className="text-sm">
                        {review.user.name}
                      </Link>
                      {type ? (
                        <span className="label" style={{ color: typeInk(type.accent) }}>
                          {review.user.dna ? (
                            <span className="font-mono">
                              {cineCode(pickVector(review.user.dna as unknown as Record<string, unknown>)).code}{" "}
                            </span>
                          ) : null}
                          {type.name}
                        </span>
                      ) : null}
                    </div>
                    <Link href={`/movie/${review.movie.providerId}`} className="label">
                      {review.movie.title} · {releaseYear(review.movie.releaseDate)}
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
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
