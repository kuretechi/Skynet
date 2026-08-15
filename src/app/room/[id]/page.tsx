import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { posterUrl } from "@/lib/movies/repository";
import { canAccessRoom, loadRoomState } from "@/lib/rooms/service";
import { BottomNav } from "@/components/bottom-nav";
import { PosterFrame, releaseYear } from "@/components/movie-visuals";
import { WatchRoomView } from "@/components/watch-room";

export const dynamic = "force-dynamic";

export default async function WatchRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const room = await prisma.watchRoom.findUnique({
    where: { id },
    include: { movie: true, host: { select: { id: true, name: true } } },
  });
  if (!room || !(await canAccessRoom(room, user.id))) notFound();

  const [state, rating] = await Promise.all([
    loadRoomState(room.id, user.id),
    prisma.rating.findUnique({
      where: { userId_movieId: { userId: user.id, movieId: room.movieId } },
    }),
  ]);
  if (!state) notFound();

  return (
    <div className="min-h-dvh pb-28">
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-5 pt-10">
        <header className="flex gap-4">
          <Link href={`/movie/${room.movie.providerId}`} className="w-20 shrink-0">
            <PosterFrame
              title={room.movie.title}
              posterUrl={posterUrl(room.movie)}
              year={releaseYear(room.movie.releaseDate)}
              className="w-20"
              sizes="80px"
            />
          </Link>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="label">Watch Room</span>
            <h1 className="display text-xl leading-tight">{room.title}</h1>
            <p className="label text-[var(--muted)]">
              {room.movie.title} · {releaseYear(room.movie.releaseDate)} · HOST {room.host.name}
            </p>
          </div>
        </header>

        <WatchRoomView
          initial={state}
          currentUserId={user.id}
          providerId={room.movie.providerId}
          movieTitle={room.movie.title}
          initialScore={rating?.score ?? null}
        />
      </div>
      <BottomNav />
    </div>
  );
}
