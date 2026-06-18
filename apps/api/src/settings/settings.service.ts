import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

export interface TestResult {
  ok: boolean;
  message: string;
}

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    const settings = await this.prisma.settings.findUnique({ where: { id: 1 } });
    if (settings) {
      const { spotifyAccessToken, spotifyRefreshToken, ...rest } = settings;
      return { ...rest, spotifyConnected: !!spotifyAccessToken && !!spotifyRefreshToken };
    }
    return { id: 1, fallbackTimeoutMins: 30, spotifyConnected: false };
  }

  async update(dto: UpdateSettingsDto) {
    await this.prisma.settings.upsert({
      where: { id: 1 },
      create: { id: 1, ...dto },
      update: dto,
    });
    return this.get();
  }

  async testLidarr(): Promise<TestResult> {
    const s = await this.prisma.settings.findUnique({ where: { id: 1 } });
    if (!s?.lidarrUrl || !s.lidarrApiKey)
      return { ok: false, message: 'Lidarr URL or API key not configured' };
    try {
      const { data } = await axios.get(`${s.lidarrUrl.replace(/\/$/, '')}/api/v1/system/status`, {
        headers: { 'X-Api-Key': s.lidarrApiKey },
        timeout: 5000,
      });
      return { ok: true, message: `Connected — Lidarr v${data.version}` };
    } catch (e: any) {
      return { ok: false, message: e?.response?.data?.message ?? e.message };
    }
  }

  async testProwlarr(): Promise<TestResult> {
    const s = await this.prisma.settings.findUnique({ where: { id: 1 } });
    if (!s?.prowlarrUrl || !s.prowlarrApiKey)
      return { ok: false, message: 'Prowlarr URL or API key not configured' };
    try {
      const { data } = await axios.get(`${s.prowlarrUrl.replace(/\/$/, '')}/api/v1/system/status`, {
        headers: { 'X-Api-Key': s.prowlarrApiKey },
        timeout: 5000,
      });
      return { ok: true, message: `Connected — Prowlarr v${data.version}` };
    } catch (e: any) {
      return { ok: false, message: e?.response?.data?.message ?? e.message };
    }
  }

  async findAndMergeDuplicates(): Promise<{ mergedArtists: number; mergedTracks: number }> {
    let mergedArtists = 0;
    let mergedTracks = 0;

    // Merge duplicate artists (same normalizedName, keep earliest-created)
    const artistGroups = await this.prisma.$queryRaw<
      Array<{ name: string; ids: string }>
    >`
      SELECT "normalizedName" AS name, STRING_AGG(id, ',' ORDER BY "createdAt") AS ids
      FROM "Artist"
      GROUP BY "normalizedName"
      HAVING COUNT(*) > 1
    `;

    for (const row of artistGroups) {
      const [canonical, ...dups] = row.ids.split(',');
      await this.prisma.track.updateMany({ where: { artistId: { in: dups } }, data: { artistId: canonical } });
      await this.prisma.artist.deleteMany({ where: { id: { in: dups } } });
      mergedArtists += dups.length;
    }

    // Merge duplicate tracks (same artistId+normalizedTitle, keep earliest-created)
    const trackGroups = await this.prisma.$queryRaw<
      Array<{ artistid: string; ntitle: string; ids: string }>
    >`
      SELECT "artistId" AS artistid, "normalizedTitle" AS ntitle, STRING_AGG(id, ',' ORDER BY "createdAt") AS ids
      FROM "Track"
      GROUP BY "artistId", "normalizedTitle"
      HAVING COUNT(*) > 1
    `;

    for (const row of trackGroups) {
      const [canonical, ...dups] = row.ids.split(',');

      const dupItems = await this.prisma.songListItem.findMany({
        where: { trackId: { in: dups } },
        select: { id: true, listId: true },
      });
      const canonicalLists = new Set(
        (await this.prisma.songListItem.findMany({
          where: { trackId: canonical },
          select: { listId: true },
        })).map((i) => i.listId),
      );
      const conflicts = dupItems.filter((i) => canonicalLists.has(i.listId)).map((i) => i.id);
      if (conflicts.length > 0) {
        await this.prisma.songListItem.deleteMany({ where: { id: { in: conflicts } } });
      }

      await this.prisma.songListItem.updateMany({ where: { trackId: { in: dups } }, data: { trackId: canonical } });
      await this.prisma.libraryFile.updateMany({ where: { trackId: { in: dups } }, data: { trackId: canonical } });
      await this.prisma.azuracastTrack.updateMany({ where: { trackId: { in: dups } }, data: { trackId: canonical } });
      await this.prisma.acquisitionJob.updateMany({ where: { trackId: { in: dups } }, data: { trackId: canonical } });
      await this.prisma.track.deleteMany({ where: { id: { in: dups } } });
      mergedTracks += dups.length;
    }

    return { mergedArtists, mergedTracks };
  }

  async testAzuracast(): Promise<TestResult> {
    const s = await this.prisma.settings.findUnique({ where: { id: 1 } });
    if (!s?.azuracastUrl)
      return { ok: false, message: 'Azuracast URL not configured' };
    try {
      const { data } = await axios.get(`${s.azuracastUrl.replace(/\/$/, '')}/api/status`, {
        timeout: 5000,
      });
      return { ok: true, message: `Connected — Azuracast v${data.version ?? 'unknown'}` };
    } catch (e: any) {
      return { ok: false, message: e?.response?.data?.message ?? e.message };
    }
  }
}
