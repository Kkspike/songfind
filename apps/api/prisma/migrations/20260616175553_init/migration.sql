-- CreateEnum
CREATE TYPE "TrackStatus" AS ENUM ('missing', 'owned', 'available_on_azuracast', 'acquiring', 'needs_approval');

-- CreateEnum
CREATE TYPE "AcquisitionSource" AS ENUM ('lidarr', 'youtube');

-- CreateEnum
CREATE TYPE "AcquisitionStatus" AS ENUM ('pending', 'searching', 'downloading', 'importing', 'done', 'failed', 'awaiting_approval');

-- CreateTable
CREATE TABLE "Artist" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "spotifyId" TEXT,
    "musicbrainzId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Artist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Track" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "normalizedTitle" TEXT NOT NULL,
    "album" TEXT,
    "durationSec" INTEGER,
    "isrc" TEXT,
    "status" "TrackStatus" NOT NULL DEFAULT 'missing',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Track_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SongList" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SongList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SongListItem" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "SongListItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryFile" (
    "id" TEXT NOT NULL,
    "trackId" TEXT,
    "path" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "tags" JSONB,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LibraryFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AzuracastTrack" (
    "id" TEXT NOT NULL,
    "trackId" TEXT,
    "azuracastSongId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artistName" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AzuracastTrack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcquisitionJob" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "source" "AcquisitionSource" NOT NULL,
    "status" "AcquisitionStatus" NOT NULL DEFAULT 'pending',
    "attempts" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcquisitionJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "prowlarrUrl" TEXT,
    "prowlarrApiKey" TEXT,
    "lidarrUrl" TEXT,
    "lidarrApiKey" TEXT,
    "azuracastUrl" TEXT,
    "azuracastApiKey" TEXT,
    "azuracastStationIds" TEXT,
    "nasMountPath" TEXT,
    "spotifyAccessToken" TEXT,
    "spotifyRefreshToken" TEXT,
    "fallbackTimeoutMins" INTEGER NOT NULL DEFAULT 30,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Artist_normalizedName_idx" ON "Artist"("normalizedName");

-- CreateIndex
CREATE INDEX "Track_normalizedTitle_idx" ON "Track"("normalizedTitle");

-- CreateIndex
CREATE INDEX "Track_artistId_idx" ON "Track"("artistId");

-- CreateIndex
CREATE INDEX "SongListItem_listId_idx" ON "SongListItem"("listId");

-- CreateIndex
CREATE UNIQUE INDEX "SongListItem_listId_trackId_key" ON "SongListItem"("listId", "trackId");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryFile_path_key" ON "LibraryFile"("path");

-- CreateIndex
CREATE INDEX "LibraryFile_trackId_idx" ON "LibraryFile"("trackId");

-- CreateIndex
CREATE INDEX "AzuracastTrack_trackId_idx" ON "AzuracastTrack"("trackId");

-- CreateIndex
CREATE UNIQUE INDEX "AzuracastTrack_azuracastSongId_stationId_key" ON "AzuracastTrack"("azuracastSongId", "stationId");

-- CreateIndex
CREATE INDEX "AcquisitionJob_trackId_idx" ON "AcquisitionJob"("trackId");

-- CreateIndex
CREATE INDEX "AcquisitionJob_status_idx" ON "AcquisitionJob"("status");

-- AddForeignKey
ALTER TABLE "Track" ADD CONSTRAINT "Track_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SongListItem" ADD CONSTRAINT "SongListItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "SongList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SongListItem" ADD CONSTRAINT "SongListItem_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryFile" ADD CONSTRAINT "LibraryFile_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AzuracastTrack" ADD CONSTRAINT "AzuracastTrack_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcquisitionJob" ADD CONSTRAINT "AcquisitionJob_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
