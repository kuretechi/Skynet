import { requireUser, ensureDefaultShelves } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CreateShelfForm } from "@/components/create-shelf-form";
import { releaseYear } from "@/components/movie-visuals";
import { ShelfRack } from "@/components/shelf-rack";
import { posterUrl } from "@/lib/movies/repository";
import { SectionHeader } from "@/components/movie-list";

export const dynamic = "force-dynamic";

const MOTIF_CAPTION: Record<string, string> = {
  vhs: "VHS RACK",
  cassette: "CASSETTE HOLDER",
  film_roll: "FILM ROLL",
  archive_box: "ARCHIVE BOX",
};

export default async function ShelfPage() {
  const user = await requireUser();
  await ensureDefaultShelves(user.id);

  const [shelves, ratings] = await Promise.all([
    prisma.shelf.findMany({
      where: { userId: user.id },
      include: { movies: { include: { movie: true }, orderBy: { addedAt: "desc" } } },
      orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
    }),
    prisma.rating.findMany({ where: { userId: user.id } }),
  ]);

  const ratingByMovie = new Map(ratings.map((r) => [r.movieId, r.score]));
  const totalItems = shelves.reduce((sum, shelf) => sum + shelf.movies.length, 0);

  return (
    <main className="flex flex-col gap-10 pt-10">
      <header className="flex items-end justify-between">
        <div>
          <span className="label">Shelf</span>
          <h1 className="display mt-2 text-2xl">{totalItems} 本の記録</h1>
        </div>
        <CreateShelfForm />
      </header>

      {shelves.map((shelf) => (
        <section key={shelf.id} className="flex flex-col gap-4">
          <SectionHeader
            title={shelf.name}
            caption={`${MOTIF_CAPTION[shelf.motif] ?? "SHELF"} · ${shelf.movies.length}`}
          />
          {shelf.movies.length === 0 ? (
            <p className="text-xs text-[var(--muted)]">まだ空の棚です。映画詳細から追加できます。</p>
          ) : (
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
          )}
        </section>
      ))}
    </main>
  );
}
