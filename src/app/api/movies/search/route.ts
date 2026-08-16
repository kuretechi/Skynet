import { NextResponse } from "next/server";
import { getMovieProvider } from "@/lib/movies/provider";
import { popularMovies, searchMovies } from "@/lib/movies/repository";

/** TMDB rejects long queries outright, so cap them before we ask. */
const MAX_QUERY_LENGTH = 200;

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ error: "QUERY_TOO_LONG" }, { status: 400 });
  }
  const provider = getMovieProvider();
  const results = query ? await searchMovies(query) : (await popularMovies()).slice(0, 12);

  return NextResponse.json({
    provider: provider.name,
    results: results.slice(0, 20).map((m) => ({
      providerId: m.providerId,
      title: m.title,
      year: m.releaseDate?.slice(0, 4) ?? null,
      posterUrl: provider.imageUrl(m.posterPath, "poster"),
      genres: m.genres.slice(0, 3),
    })),
  });
}
