-- AlterTable
ALTER TABLE "Rating" ADD COLUMN     "masterpiece" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "MovieNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "movieId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MovieNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MovieNote_movieId_idx" ON "MovieNote"("movieId");

-- CreateIndex
CREATE UNIQUE INDEX "MovieNote_userId_movieId_key" ON "MovieNote"("userId", "movieId");

-- AddForeignKey
ALTER TABLE "MovieNote" ADD CONSTRAINT "MovieNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovieNote" ADD CONSTRAINT "MovieNote_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

