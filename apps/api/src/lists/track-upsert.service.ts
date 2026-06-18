import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { normalize } from '../common/normalize';
import type { ParsedEntry } from './parsing';

@Injectable()
export class TrackUpsertService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertTrack(entry: ParsedEntry) {
    const normalizedName = normalize(entry.artist);
    const normalizedTitle = normalize(entry.title);

    const artist = await this.prisma.artist.upsert({
      where: { normalizedName },
      create: { name: entry.artist, normalizedName },
      update: {},
    });

    const track = await this.prisma.track.upsert({
      where: { artistId_normalizedTitle: { artistId: artist.id, normalizedTitle } },
      create: { artistId: artist.id, title: entry.title, normalizedTitle, album: entry.album },
      update: entry.album ? { album: entry.album } : {},
    });

    // Reset stuck transient states so matching can re-evaluate on re-import
    if (track.status === 'acquiring' || track.status === 'needs_approval') {
      return this.prisma.track.update({ where: { id: track.id }, data: { status: 'missing' } });
    }

    return track;
  }
}
