import { NextResponse } from "next/server";
import { getMovieProvider } from "@/lib/movies/provider";
import { popularMovies, searchMovies } from "@/lib/movies/repository";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
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
