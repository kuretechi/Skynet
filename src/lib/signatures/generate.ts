import { createHash } from "node:crypto";
import { cache } from "react";
import { Prisma, type Movie, type MovieContentSignature } from "@prisma/client";
import { mapWithConcurrency } from "@/lib/async/pool";
import { LruMap } from "@/lib/cache/process-cache";
import { prisma } from "@/lib/db";
import { canonicalGenre } from "@/lib/features/rules";
import { movieRowToDetail } from "@/lib/movies/repository";
import { CONTENT_SIGNATURE_VERSION } from "@/lib/recommend/config";
import type { ContentSignature, SignatureToken } from "./types";

const signatureCache = new LruMap<string, MovieContentSignature>(4000);

const normalise = (value: string) => value.normalize("NFKC").trim().toLocaleLowerCase();

const token = (namespace: string, id: string | undefined, label: string): SignatureToken => ({
  key: `${namespace}:${id || normalise(label)}`,
  label,
});

const uniqueTokens = (values: SignatureToken[]) =>
  [...new Map(values.map((value) => [value.key, value])).values()].sort((a, b) => a.key.localeCompare(b.key));

const metadataPayload = (movie: Movie) => {
  const detail = movieRowToDetail(movie);
  const genreIds = detail.genreIds ?? [];
  const keywordIds = detail.keywordIds ?? [];
  const genres = uniqueTokens(detail.genres.map((genre, index) =>
    token("genre", genreIds[index], canonicalGenre(genre)),
  ));
  const keywords = uniqueTokens(detail.keywords.map((keyword, index) =>
    token("keyword", keywordIds[index], keyword),
  ));
  const canonicalGenres = new Set(detail.genres.map(canonicalGenre));
  const forms = uniqueTokens([
    ...(canonicalGenres.has("Animation") ? [token("form", "animation", "Animation")] : []),
    ...(canonicalGenres.has("Documentary") ? [token("form", "documentary", "Documentary")] : []),
  ]);
  const countries = uniqueTokens((detail.countries ?? (detail.country ? [detail.country] : []))
    .map((country) => token("country", country, country)));
  const languages = detail.language ? [token("language", detail.language, detail.language)] : [];

  return {
    theme: { genres, keywords, forms },
    creators: {
      director: detail.director ? token("person", detail.directorId, detail.director) : undefined,
      writers: uniqueTokens((detail.writers ?? []).map((writer) => token("person", writer.id, writer.name))),
      cast: uniqueTokens(detail.cast.map((name, index) => token("person", detail.castIds?.[index], name))),
      companies: uniqueTokens((detail.companies ?? []).map((company) => token("company", company.id, company.name))),
    },
    context: {
      year: Number(detail.releaseDate?.slice(0, 4)) || undefined,
      countries,
      languages,
    },
    format: {
      runtime: detail.runtime,
      mediaType: detail.mediaType ?? "movie",
    },
    relations: {
      collection: detail.collection ? token("collection", detail.collection.id, detail.collection.name) : undefined,
    },
  } satisfies Omit<ContentSignature, "movieId" | "version" | "metadataHash" | "completeness">;
};

const completenessOf = (payload: ReturnType<typeof metadataPayload>) => {
  const theme = payload.theme.genres.length > 0 || payload.theme.keywords.length > 0 ? 1 : 0;
  const creators = payload.creators.director || payload.creators.writers.length || payload.creators.cast.length ? 1 : 0;
  const context = payload.context.year || payload.context.countries.length || payload.context.languages.length ? 1 : 0;
  const format = payload.format.runtime || payload.format.mediaType ? 1 : 0;
  const relations = payload.relations.collection || payload.creators.companies.length ? 1 : 0;
  return Number((theme * 0.3 + creators * 0.25 + context * 0.2 + format * 0.15 + relations * 0.1).toFixed(3));
};

const serialise = (movie: Movie) => {
  const payload = metadataPayload(movie);
  const json = JSON.stringify(payload);
  return {
    payload,
    metadataHash: createHash("sha256").update(json).digest("hex"),
    completeness: completenessOf(payload),
  };
};

export const contentSignatureFromRow = (row: MovieContentSignature): ContentSignature => ({
  movieId: row.movieId,
  version: row.signatureVersion,
  metadataHash: row.metadataHash,
  theme: JSON.parse(row.themeJson) as ContentSignature["theme"],
  creators: JSON.parse(row.creatorsJson) as ContentSignature["creators"],
  context: JSON.parse(row.contextJson) as ContentSignature["context"],
  format: JSON.parse(row.formatJson) as ContentSignature["format"],
  relations: JSON.parse(row.relationsJson) as ContentSignature["relations"],
  completeness: row.completeness,
});

async function generateContentSignature(movie: Movie, overwrite = false) {
  const { payload, metadataHash, completeness } = serialise(movie);
  const row = {
    metadataHash,
    themeJson: JSON.stringify(payload.theme),
    creatorsJson: JSON.stringify(payload.creators),
    contextJson: JSON.stringify(payload.context),
    formatJson: JSON.stringify(payload.format),
    relationsJson: JSON.stringify(payload.relations),
    completeness,
  };
  const where = { movieId_signatureVersion: { movieId: movie.id, signatureVersion: CONTENT_SIGNATURE_VERSION } };
  try {
    const saved = await prisma.movieContentSignature.upsert({
      where,
      update: overwrite ? { ...row, generatedAt: new Date() } : {},
      create: { movieId: movie.id, signatureVersion: CONTENT_SIGNATURE_VERSION, ...row },
    });
    signatureCache.set(movie.id, saved);
    return saved;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const raced = await prisma.movieContentSignature.findUnique({ where });
      if (raced) return raced;
    }
    throw error;
  }
}

export const getOrCreateContentSignature = cache(async (movie: Movie): Promise<ContentSignature> => {
  const known = signatureCache.get(movie.id);
  if (known) return contentSignatureFromRow(known);
  const cached = await prisma.movieContentSignature.findUnique({
    where: { movieId_signatureVersion: { movieId: movie.id, signatureVersion: CONTENT_SIGNATURE_VERSION } },
  });
  const row = cached ?? await generateContentSignature(movie);
  signatureCache.set(movie.id, row);
  return contentSignatureFromRow(row);
});

export async function getOrCreateContentSignaturesMany(movies: readonly Movie[]) {
  const byId = new Map(movies.map((movie) => [movie.id, movie]));
  const output = new Map<string, ContentSignature>();
  if (byId.size === 0) return output;

  const unknownIds: string[] = [];
  for (const id of byId.keys()) {
    const known = signatureCache.get(id);
    if (known) output.set(id, contentSignatureFromRow(known));
    else unknownIds.push(id);
  }
  if (unknownIds.length > 0) {
    const rows = await prisma.movieContentSignature.findMany({
      where: { movieId: { in: unknownIds }, signatureVersion: CONTENT_SIGNATURE_VERSION },
    });
    for (const row of rows) {
      signatureCache.set(row.movieId, row);
      output.set(row.movieId, contentSignatureFromRow(row));
    }
  }
  const missing = [...byId.values()].filter((movie) => !output.has(movie.id));
  const generated = await mapWithConcurrency(missing, 6, (movie) => generateContentSignature(movie));
  for (const row of generated) output.set(row.movieId, contentSignatureFromRow(row));
  return output;
}

export async function regenerateContentSignature(movie: Movie) {
  signatureCache.delete(movie.id);
  return contentSignatureFromRow(await generateContentSignature(movie, true));
}

