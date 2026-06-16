import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { MatchingService } from '../matching/matching.service';
import { normalize } from '../common/normalize';

interface AzuracastFile {
  song_id: string;
  artist: string | null;
  title: string | null;
  album: string | null;
}

const NULL_CHAR = String.fromCharCode(0);

function sanitize(value: string): string {
  return value.split(NULL_CHAR).join('').trim();
}

@Injectable()
export class AzuracastService {
  private readonly logger = new Logger(AzuracastService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly matching: MatchingService,
  ) {}

  async poll() {
    const settings = await this.prisma.settings.findUnique({ where: { id: 1 } });
    if (!settings?.azuracastUrl || !settings.azuracastApiKey || !settings.azuracastStationIds) {
      throw new Error('Azuracast is not configured');
    }

    const stationIds = settings.azuracastStationIds.split(',').map((s) => s.trim()).filter(Boolean);
    let upserted = 0;
    let skipped = 0;

    for (const stationId of stationIds) {
      const { data } = await axios.get<AzuracastFile[]>(
        `${settings.azuracastUrl.replace(/\/$/, '')}/api/station/${stationId}/files`,
        { headers: { Authorization: `Bearer ${settings.azuracastApiKey}` } },
      );

      const seenSongIds: string[] = [];
      for (const file of data) {
        const artist = file.artist ? sanitize(file.artist) : '';
        const title = file.title ? sanitize(file.title) : '';
        if (!artist || !title) {
          skipped++;
          continue;
        }
        seenSongIds.push(file.song_id);

        await this.prisma.azuracastTrack.upsert({
          where: { azuracastSongId_stationId: { azuracastSongId: file.song_id, stationId } },
          create: {
            azuracastSongId: file.song_id,
            stationId,
            title,
            artistName: artist,
            normalizedTitle: normalize(title),
            normalizedArtist: normalize(artist),
          },
          update: {
            title,
            artistName: artist,
            normalizedTitle: normalize(title),
            normalizedArtist: normalize(artist),
            lastSeenAt: new Date(),
          },
        });
        upserted++;
      }

      await this.removeStale(stationId, seenSongIds);
    }

    const matchResult = await this.matching.rematchAllMissingTracks();
    return { upserted, skipped, ...matchResult };
  }

  private async removeStale(stationId: string, seenSongIds: string[]) {
    await this.prisma.azuracastTrack.deleteMany({
      where: { stationId, azuracastSongId: { notIn: seenSongIds } },
    });
  }
}
