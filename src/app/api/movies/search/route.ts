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

const textContains = (value: string) =>
  /^postgres(ql)?:\/\//.test(process.env.DATABASE_URL ?? "")
    ? { contains: value, mode: "insensitive" as const }
    : { contains: value };

const numberParam = (params: URLSearchParams, key: string, fallback: number) => {
  const value = Number(params.get(key));
  return Number.isFinite(value) ? value : fallback;
};

const seriesKey = (title: string) =>
  title
    .normalize("NFKC")
    .toLocaleLowerCase()
    .split(/[：:／/—–~-]/)[0]
    .replace(/[0-9０-９]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Keep ranked results useful without allowing one franchise, director or genre to occupy the page. */
function diversify<T extends { title: string; director?: string | null; genres: string[] }>(items: T[]) {
  const remaining = [...items];
  const output: T[] = [];
  const directors = new Map<string, number>();
  const genres = new Map<string, number>();
  const series = new Map<string, number>();

  while (remaining.length > 0 && output.length < RESULT_LIMIT) {
    let bestIndex = 0;
    let bestCost = Number.POSITIVE_INFINITY;
    remaining.forEach((item, index) => {
      const director = item.director?.toLocaleLowerCase() ?? "";
      const genre = item.genres[0] ?? "";
      const franchise = seriesKey(item.title);
      const cost = index
        + (director ? (directors.get(director) ?? 0) * 10 : 0)
        + (genre ? Math.max(0, (genres.get(genre) ?? 0) - 1) * 5 : 0)
        + (franchise ? (series.get(franchise) ?? 0) * 14 : 0);
      if (cost < bestCost) {
        bestCost = cost;
        bestIndex = index;
      }
    });
    const [chosen] = remaining.splice(bestIndex, 1);
    output.push(chosen);
    if (chosen.director) directors.set(chosen.director.toLocaleLowerCase(), (directors.get(chosen.director.toLocaleLowerCase()) ?? 0) + 1);
    if (chosen.genres[0]) genres.set(chosen.genres[0], (genres.get(chosen.genres[0]) ?? 0) + 1);
    const franchise = seriesKey(chosen.title);
    if (franchise) series.set(franchise, (series.get(franchise) ?? 0) + 1);
  }
  return output;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = params.get("q")?.trim() ?? "";
  const mood = getMood(params.get("mood"));
  const sort = (params.get("sort") ?? "for-you") as Sort;
  const unwatchedOnly = params.get("unwatched") === "1";
  const genre = params.get("genre")?.trim() ?? "";
  const country = params.get("country")?.trim().toUpperCase() ?? "";
  const yearFrom = numberParam(params, "yearFrom", 0);
  const yearTo = numberParam(params, "yearTo", 9999);
  const runtimeMin = numberParam(params, "runtimeMin", 0);
  const runtimeMax = numberParam(params, "runtimeMax", 9999);
  if (query.length > MAX_QUERY_LENGTH) return NextResponse.json({ error: "QUERY_TOO_LONG" }, { status: 400 });

  const user = await getCurrentUser();
  const watchedIds = user && unwatchedOnly
    ? new Set([
        ...(await prisma.watchHistory.findMany({ where: { userId: user.id }, select: { movieId: true } })).map((row) => row.movieId),
        ...(await prisma.shelfMovie.findMany({ where: { shelf: { userId: user.id, kind: "watched" } }, select: { movieId: true } })).map((row) => row.movieId),
      ])
    : new Set<string>();
  const filters = {
    releaseDate: { gte: yearFrom ? `${yearFrom}-01-01` : undefined, lte: yearTo < 9999 ? `${yearTo}-12-31` : undefined },
    runtime: { gte: runtimeMin || undefined, lte: runtimeMax < 9999 ? runtimeMax : undefined },
    ...(genre ? { genresJson: textContains(genre) } : {}),
    ...(country ? { country } : {}),
    ...(watchedIds.size ? { id: { notIn: [...watchedIds] } } : {}),
  };
  const where = {
    ...filters,
    ...(query ? { OR: [
      { title: textContains(query) },
      { originalTitle: textContains(query) },
      { director: textContains(query) },
      { overview: textContains(query) },
      { keywordsJson: textContains(query) },
    ] } : {}),
  };
  const localMovies = await prisma.movie.findMany({ where, orderBy: { popularity: "desc" }, take: 180 });
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
      providerId: movie.providerId, title: movie.title, originalTitle: movie.originalTitle, year: movie.releaseDate?.slice(0, 4) ?? null,
      releaseDate: movie.releaseDate, posterUrl: posterUrl(movie), genres: movieGenres(movie).slice(0, 3),
      runtime: movie.runtime, country: movie.country, director: movie.director, forYou: item?.score.predicted ?? null, match: item?.score.match ?? null,
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
  local = diversify(local);

  const hasDetailFilters = Boolean(genre || country || yearFrom || yearTo < 9999 || runtimeMin || runtimeMax < 9999 || unwatchedOnly);
  if (query && !mood && !hasDetailFilters && local.length < 12) {
    const provider = getMovieProvider();
    const external = await searchMovies(query).catch(() => []);
    const known = new Set(local.map((movie) => movie.providerId));
    for (const movie of external) {
      if (known.has(movie.providerId) || local.length >= RESULT_LIMIT) continue;
      local.push({ providerId: movie.providerId, title: movie.title, originalTitle: movie.originalTitle ?? null, year: movie.releaseDate?.slice(0, 4) ?? null,
        releaseDate: movie.releaseDate ?? null, posterUrl: provider.imageUrl(movie.posterPath, "poster"), genres: movie.genres.slice(0, 3),
        runtime: null, country: null, director: null, forYou: null, match: null, moodMatch: null, analyzed: false });
    }
  }
  return NextResponse.json({ results: local });
}
