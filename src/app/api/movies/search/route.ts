import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { euclideanDistance } from "@/lib/dna/axes";
import { FEATURE_VERSION, featureVector } from "@/lib/features/generate";
import { getMovieProvider } from "@/lib/movies/provider";
import { movieGenres, posterUrl, searchMovies } from "@/lib/movies/repository";
import { getMood } from "@/lib/recommend/moods";
import { getUserTasteContext, scoreMoviesForUser } from "@/lib/recommend/engine";

const MAX_QUERY_LENGTH = 200;
const RESULT_LIMIT = 40;
type Sort = "for-you" | "match" | "release";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = params.get("q")?.trim() ?? "";
  const mood = getMood(params.get("mood"));
  const sort = (params.get("sort") ?? "for-you") as Sort;
  if (query.length > MAX_QUERY_LENGTH) return NextResponse.json({ error: "QUERY_TOO_LONG" }, { status: 400 });

  const user = await getCurrentUser();
  const where = query ? { OR: [
    { title: { contains: query, mode: "insensitive" as const } },
    { originalTitle: { contains: query, mode: "insensitive" as const } },
    { director: { contains: query, mode: "insensitive" as const } },
    { overview: { contains: query, mode: "insensitive" as const } },
    { keywordsJson: { contains: query, mode: "insensitive" as const } },
  ] } : {};
  const localMovies = await prisma.movie.findMany({ where, orderBy: { popularity: "desc" }, take: mood ? 160 : 60 });
  const existingFeatures = await prisma.movieFeature.findMany({
    where: { featureVersion: FEATURE_VERSION, movieId: { in: localMovies.map((movie) => movie.id) } },
  });
  const featuredIds = new Set(existingFeatures.map((feature) => feature.movieId));
  const ctx = user ? await getUserTasteContext(user.id) : null;
  // Searching must never enqueue or generate AI analysis. Only score rows that
  // already have the current feature version; the rest remain visible as unanalysed.
  const scored = ctx ? await scoreMoviesForUser(localMovies.filter((movie) => featuredIds.has(movie.id)), ctx) : [];
  const scoredById = new Map(scored.map((item) => [item.movie.id, item]));
  const moodFeatures = mood ? existingFeatures : [];
  const moodDistance = new Map(moodFeatures.map((feature) => [feature.movieId, euclideanDistance(mood!.target, featureVector(feature))]));

  let local = localMovies.filter((movie) => !mood || moodDistance.has(movie.id)).map((movie) => {
    const item = scoredById.get(movie.id);
    return {
      providerId: movie.providerId, title: movie.title, year: movie.releaseDate?.slice(0, 4) ?? null,
      releaseDate: movie.releaseDate, posterUrl: posterUrl(movie), genres: movieGenres(movie).slice(0, 3),
      director: movie.director, forYou: item?.score.predicted ?? null, match: item?.score.match ?? null,
      moodMatch: mood ? Math.max(0, Math.round((1 - (moodDistance.get(movie.id) ?? 1) / Math.sqrt(8)) * 100)) : null,
      analyzed: featuredIds.has(movie.id),
    };
  });
  local.sort((a, b) => {
    if (sort === "release") return (b.releaseDate ?? "").localeCompare(a.releaseDate ?? "");
    if (sort === "match") {
      const aMatch = mood ? a.moodMatch : a.match;
      const bMatch = mood ? b.moodMatch : b.match;
      return (bMatch ?? -1) - (aMatch ?? -1);
    }
    return (b.forYou ?? -1) - (a.forYou ?? -1);
  });
  local = local.slice(0, RESULT_LIMIT);

  if (query && !mood && local.length < 12) {
    const provider = getMovieProvider();
    const external = await searchMovies(query).catch(() => []);
    const known = new Set(local.map((movie) => movie.providerId));
    for (const movie of external) {
      if (known.has(movie.providerId) || local.length >= RESULT_LIMIT) continue;
      local.push({ providerId: movie.providerId, title: movie.title, year: movie.releaseDate?.slice(0, 4) ?? null,
        releaseDate: movie.releaseDate ?? null, posterUrl: provider.imageUrl(movie.posterPath, "poster"), genres: movie.genres.slice(0, 3),
        director: null, forYou: null, match: null, moodMatch: null, analyzed: false });
    }
  }
  return NextResponse.json({ results: local });
}
