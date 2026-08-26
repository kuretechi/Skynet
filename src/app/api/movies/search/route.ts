import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getMovieProvider } from "@/lib/movies/provider";
import { ensureMoviesByProviderIds, movieGenres, posterUrl } from "@/lib/movies/repository";
import { getMood } from "@/lib/recommend/moods";
import { getUserTasteContext, scoreMoviesForUser } from "@/lib/recommend/engine";

const MAX_QUERY_LENGTH = 200;
const RESULT_LIMIT = 40;
const LOCAL_RESULT_FLOOR = 12;
const ON_DEMAND_INGEST_LIMIT = 12;
type Sort = "for-you" | "match" | "release";

const TMDB_GENRE_IDS: Record<string, string> = {
  "アクション": "28", "アドベンチャー": "12", "アニメーション": "16", "コメディ": "35",
  "犯罪": "80", "ドラマ": "18", "ファミリー": "10751", "ファンタジー": "14",
  "ホラー": "27", "ミステリー": "9648", "ロマンス": "10749", "サイエンスフィクション": "878",
  "スリラー": "53", "ドキュメンタリー": "99",
};

const textContains = (value: string) =>
  /^postgres(ql)?:\/\//.test(process.env.DATABASE_URL ?? "")
    ? { contains: value, mode: "insensitive" as const }
    : { contains: value };

const numberParam = (params: URLSearchParams, key: string, fallback: number) => {
  const raw = params.get(key);
  if (raw === null || raw.trim() === "") return fallback;
  const value = Number(raw);
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
  const genreId = TMDB_GENRE_IDS[genre];
  if (query.length > MAX_QUERY_LENGTH) return NextResponse.json({ error: "QUERY_TOO_LONG" }, { status: 400 });

  const user = await getCurrentUser();
  const watchedIds = user && unwatchedOnly
    ? new Set([
        ...(await prisma.watchHistory.findMany({ where: { userId: user.id }, select: { movieId: true } })).map((row) => row.movieId),
        ...(await prisma.shelfMovie.findMany({ where: { shelf: { userId: user.id, kind: "watched" } }, select: { movieId: true } })).map((row) => row.movieId),
      ])
    : new Set<string>();
  const filters: Prisma.MovieWhereInput[] = [];
  if (yearFrom || yearTo < 9999) {
    filters.push({ releaseDate: { gte: yearFrom ? `${yearFrom}-01-01` : undefined, lte: yearTo < 9999 ? `${yearTo}-12-31` : undefined } });
  }
  if (runtimeMin || runtimeMax < 9999) {
    filters.push({ runtime: { gte: runtimeMin || undefined, lte: runtimeMax < 9999 ? runtimeMax : undefined } });
  }
  if (genre) {
    filters.push({ OR: [
      ...(genreId ? [{ genreIdsJson: textContains(`\"${genreId}\"`) }] : []),
      { genresJson: textContains(genre) },
    ] });
  }
  if (country) {
    filters.push({ OR: [
      { countriesJson: textContains(`\"${country}\"`) },
      { country },
    ] });
  }
  if (watchedIds.size) filters.push({ id: { notIn: [...watchedIds] } });
  const where: Prisma.MovieWhereInput = {
    AND: [
      ...filters,
      ...(query ? [{ OR: [
      { title: textContains(query) },
      { originalTitle: textContains(query) },
      { director: textContains(query) },
      { overview: textContains(query) },
      { keywordsJson: textContains(query) },
      ] }] : []),
    ],
  };
  let localMovies = await prisma.movie.findMany({ where, orderBy: { popularity: "desc" }, take: 180 });

  // A sparse cache should not make provider-backed filters look empty. Fetch at
  // most one provider page and persist a small bounded set of full details.
  if (user && localMovies.length < LOCAL_RESULT_FLOOR && !mood) {
    const provider = getMovieProvider();
    const hasMetadataFilters = Boolean(genre || country || yearFrom || yearTo < 9999 || runtimeMin || runtimeMax < 9999);
    const candidates = query
      ? await provider.search(query).catch(() => [])
      : hasMetadataFilters
        ? await provider.discover({
            genreIds: genreId ? [genreId] : undefined,
            genres: !genreId && genre ? [genre] : undefined,
            country: country || undefined,
            yearFrom: yearFrom || undefined,
            yearTo: yearTo < 9999 ? yearTo : undefined,
            runtimeMin: runtimeMin || undefined,
            runtimeMax: runtimeMax < 9999 ? runtimeMax : undefined,
          }).catch(() => [])
        : [];
    const cachedIds = new Set(localMovies.map((movie) => movie.providerId));
    const missingIds = candidates
      .map((movie) => movie.providerId)
      .filter((providerId) => !cachedIds.has(providerId))
      .slice(0, ON_DEMAND_INGEST_LIMIT);
    if (missingIds.length > 0) {
      await ensureMoviesByProviderIds(missingIds);
      localMovies = await prisma.movie.findMany({ where, orderBy: { popularity: "desc" }, take: 180 });
    }
  }
  const ctx = user ? await getUserTasteContext(user.id) : null;
  // Derived data is deterministic and local; search can safely score every cached title.
  const scored = ctx ? await scoreMoviesForUser(localMovies, ctx, { mood }) : [];
  const scoredById = new Map(scored.map((item) => [item.movie.id, item]));

  let local = localMovies.map((movie) => {
    const item = scoredById.get(movie.id);
    return {
      providerId: movie.providerId, title: movie.title, originalTitle: movie.originalTitle, year: movie.releaseDate?.slice(0, 4) ?? null,
      releaseDate: movie.releaseDate, posterUrl: posterUrl(movie), genres: movieGenres(movie).slice(0, 3),
      runtime: movie.runtime, country: movie.country, director: movie.director, forYou: item?.score.predicted ?? null, match: item?.score.match ?? null,
      moodMatch: item?.score.moodMatch ?? null,
      analyzed: Boolean(item),
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

  return NextResponse.json({ results: local });
}
