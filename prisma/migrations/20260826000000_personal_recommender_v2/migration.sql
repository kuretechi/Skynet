-- Separate factual content signatures from the auxiliary 8-axis vectors.
ALTER TABLE "Movie" ADD COLUMN "mediaType" TEXT NOT NULL DEFAULT 'movie';
ALTER TABLE "Movie" ADD COLUMN "genreIdsJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Movie" ADD COLUMN "keywordIdsJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Movie" ADD COLUMN "castIdsJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Movie" ADD COLUMN "directorId" TEXT;
ALTER TABLE "Movie" ADD COLUMN "writersJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Movie" ADD COLUMN "companiesJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Movie" ADD COLUMN "countriesJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Movie" ADD COLUMN "collectionId" TEXT;
ALTER TABLE "Movie" ADD COLUMN "collectionName" TEXT;

DROP INDEX "Movie_provider_providerId_key";
CREATE UNIQUE INDEX "Movie_provider_mediaType_providerId_key" ON "Movie"("provider", "mediaType", "providerId");

CREATE TABLE "MovieContentSignature" (
    "id" TEXT NOT NULL,
    "movieId" TEXT NOT NULL,
    "signatureVersion" TEXT NOT NULL,
    "metadataHash" TEXT NOT NULL,
    "themeJson" TEXT NOT NULL DEFAULT '{}',
    "creatorsJson" TEXT NOT NULL DEFAULT '{}',
    "contextJson" TEXT NOT NULL DEFAULT '{}',
    "formatJson" TEXT NOT NULL DEFAULT '{}',
    "relationsJson" TEXT NOT NULL DEFAULT '{}',
    "completeness" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovieContentSignature_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MovieContentSignature_movieId_signatureVersion_key"
ON "MovieContentSignature"("movieId", "signatureVersion");
CREATE INDEX "MovieContentSignature_signatureVersion_generatedAt_idx"
ON "MovieContentSignature"("signatureVersion", "generatedAt");
ALTER TABLE "MovieContentSignature" ADD CONSTRAINT "MovieContentSignature_movieId_fkey"
FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MovieFeature" ADD COLUMN "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "MovieFeature" ADD COLUMN "axisConfidenceJson" TEXT NOT NULL DEFAULT '{}';

-- These rows are derived and may contain Gemini/OpenAI output. The application
-- lazily regenerates deterministic experience-v2 rows and user DNA.
DELETE FROM "MovieFeature";
DELETE FROM "CinemaDna";

