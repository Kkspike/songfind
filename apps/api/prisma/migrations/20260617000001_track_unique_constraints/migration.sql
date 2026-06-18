-- Deduplicate Artist rows: merge same-normalizedName artists, keeping earliest-created
WITH ranked AS (
  SELECT id,
    FIRST_VALUE(id) OVER (PARTITION BY "normalizedName" ORDER BY "createdAt") AS canonical_id,
    ROW_NUMBER() OVER (PARTITION BY "normalizedName" ORDER BY "createdAt") AS rn
  FROM "Artist"
)
UPDATE "Track" SET "artistId" = ranked.canonical_id
FROM ranked
WHERE "Track"."artistId" = ranked.id AND ranked.rn > 1;

DELETE FROM "Artist"
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY "normalizedName" ORDER BY "createdAt") AS rn
    FROM "Artist"
  ) sub WHERE rn > 1
);

-- Deduplicate Track rows: merge same-(artistId, normalizedTitle) tracks, keeping earliest-created
-- Remove conflicting SongListItems first (dup track in same list as canonical)
DELETE FROM "SongListItem"
WHERE id IN (
  SELECT sli.id
  FROM "SongListItem" sli
  JOIN (
    SELECT id,
      FIRST_VALUE(id) OVER (PARTITION BY "artistId", "normalizedTitle" ORDER BY "createdAt") AS canonical_id,
      ROW_NUMBER() OVER (PARTITION BY "artistId", "normalizedTitle" ORDER BY "createdAt") AS rn
    FROM "Track"
  ) ranked ON sli."trackId" = ranked.id AND ranked.rn > 1
  WHERE EXISTS (
    SELECT 1 FROM "SongListItem" sli2
    WHERE sli2."listId" = sli."listId" AND sli2."trackId" = ranked.canonical_id
  )
);

-- Repoint remaining SongListItems to canonical track
UPDATE "SongListItem" SET "trackId" = ranked.canonical_id
FROM (
  SELECT id,
    FIRST_VALUE(id) OVER (PARTITION BY "artistId", "normalizedTitle" ORDER BY "createdAt") AS canonical_id,
    ROW_NUMBER() OVER (PARTITION BY "artistId", "normalizedTitle" ORDER BY "createdAt") AS rn
  FROM "Track"
) ranked
WHERE "SongListItem"."trackId" = ranked.id AND ranked.rn > 1;

-- Repoint LibraryFile to canonical track
UPDATE "LibraryFile" SET "trackId" = ranked.canonical_id
FROM (
  SELECT id,
    FIRST_VALUE(id) OVER (PARTITION BY "artistId", "normalizedTitle" ORDER BY "createdAt") AS canonical_id,
    ROW_NUMBER() OVER (PARTITION BY "artistId", "normalizedTitle" ORDER BY "createdAt") AS rn
  FROM "Track"
) ranked
WHERE "LibraryFile"."trackId" = ranked.id AND ranked.rn > 1;

-- Repoint AzuracastTrack to canonical track
UPDATE "AzuracastTrack" SET "trackId" = ranked.canonical_id
FROM (
  SELECT id,
    FIRST_VALUE(id) OVER (PARTITION BY "artistId", "normalizedTitle" ORDER BY "createdAt") AS canonical_id,
    ROW_NUMBER() OVER (PARTITION BY "artistId", "normalizedTitle" ORDER BY "createdAt") AS rn
  FROM "Track"
) ranked
WHERE "AzuracastTrack"."trackId" = ranked.id AND ranked.rn > 1;

-- Repoint AcquisitionJob to canonical track
UPDATE "AcquisitionJob" SET "trackId" = ranked.canonical_id
FROM (
  SELECT id,
    FIRST_VALUE(id) OVER (PARTITION BY "artistId", "normalizedTitle" ORDER BY "createdAt") AS canonical_id,
    ROW_NUMBER() OVER (PARTITION BY "artistId", "normalizedTitle" ORDER BY "createdAt") AS rn
  FROM "Track"
) ranked
WHERE "AcquisitionJob"."trackId" = ranked.id AND ranked.rn > 1;

-- Delete duplicate track rows
DELETE FROM "Track"
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY "artistId", "normalizedTitle" ORDER BY "createdAt") AS rn
    FROM "Track"
  ) sub WHERE rn > 1
);

-- Replace Artist lookup index with unique constraint
DROP INDEX "Artist_normalizedName_idx";
CREATE UNIQUE INDEX "Artist_normalizedName_key" ON "Artist"("normalizedName");

-- Replace Track normalizedTitle index with compound unique on (artistId, normalizedTitle)
DROP INDEX "Track_normalizedTitle_idx";
CREATE UNIQUE INDEX "Track_artistId_normalizedTitle_key" ON "Track"("artistId", "normalizedTitle");
