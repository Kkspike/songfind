/*
  Warnings:

  - Added the required column `normalizedArtist` to the `AzuracastTrack` table without a default value. This is not possible if the table is not empty.
  - Added the required column `normalizedTitle` to the `AzuracastTrack` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AzuracastTrack" ADD COLUMN     "normalizedArtist" TEXT NOT NULL,
ADD COLUMN     "normalizedTitle" TEXT NOT NULL;
