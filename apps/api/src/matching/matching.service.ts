import { Injectable } from '@nestjs/common';
import compareTwoStrings from 'string-similarity-js';
import { PrismaService } from '../prisma/prisma.service';

const MATCH_THRESHOLD = 0.82;

@Injectable()
export class MatchingService {
  constructor(private readonly prisma: PrismaService) {}

  async rematchAllMissingTracks() {
    const tracks = await this.prisma.track.findMany({
      where: { status: 'missing' },
      include: { artist: true },
    });

    let matchedToLibrary = 0;
    let matchedToAzuracast = 0;

    for (const track of tracks) {
      const libraryMatch = await this.findLibraryMatch(track.artist.normalizedName, track.normalizedTitle);
      if (libraryMatch) {
        await this.prisma.$transaction([
          this.prisma.libraryFile.update({ where: { id: libraryMatch.id }, data: { trackId: track.id } }),
          this.prisma.track.update({ where: { id: track.id }, data: { status: 'owned' } }),
        ]);
        matchedToLibrary++;
        continue;
      }

      const azuracastMatch = await this.findAzuracastMatch(track.artist.normalizedName, track.normalizedTitle);
      if (azuracastMatch) {
        await this.prisma.$transaction([
          this.prisma.azuracastTrack.update({ where: { id: azuracastMatch.id }, data: { trackId: track.id } }),
          this.prisma.track.update({ where: { id: track.id }, data: { status: 'available_on_azuracast' } }),
        ]);
        matchedToAzuracast++;
      }
    }

    return { checked: tracks.length, matchedToLibrary, matchedToAzuracast };
  }

  private async findLibraryMatch(normalizedArtist: string, normalizedTitle: string) {
    const candidates = await this.prisma.libraryFile.findMany({ where: { trackId: null } });
    return this.bestMatch(candidates, normalizedArtist, normalizedTitle, (c) => {
      const tags = (c.tags as Record<string, string> | null) ?? {};
      return { artist: tags.normalizedArtist ?? '', title: tags.normalizedTitle ?? '' };
    });
  }

  private async findAzuracastMatch(normalizedArtist: string, normalizedTitle: string) {
    const candidates = await this.prisma.azuracastTrack.findMany({ where: { trackId: null } });
    return this.bestMatch(candidates, normalizedArtist, normalizedTitle, (c) => ({
      artist: c.normalizedArtist,
      title: c.normalizedTitle,
    }));
  }

  private bestMatch<T>(
    candidates: T[],
    normalizedArtist: string,
    normalizedTitle: string,
    extract: (c: T) => { artist: string; title: string },
  ): T | null {
    let best: T | null = null;
    let bestScore = 0;

    for (const candidate of candidates) {
      const { artist, title } = extract(candidate);
      if (!artist || !title) continue;
      const artistScore = compareTwoStrings(artist, normalizedArtist);
      const titleScore = compareTwoStrings(title, normalizedTitle);
      const score = artistScore * 0.4 + titleScore * 0.6;
      if (artistScore > 0.6 && score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }

    return bestScore >= MATCH_THRESHOLD ? best : null;
  }
}
