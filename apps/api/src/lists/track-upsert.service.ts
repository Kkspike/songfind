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

    let artist = await this.prisma.artist.findFirst({ where: { normalizedName } });
    if (!artist) {
      artist = await this.prisma.artist.create({
        data: { name: entry.artist, normalizedName },
      });
    }

    let track = await this.prisma.track.findFirst({
      where: { artistId: artist.id, normalizedTitle },
    });
    if (!track) {
      track = await this.prisma.track.create({
        data: {
          artistId: artist.id,
          title: entry.title,
          normalizedTitle,
        },
      });
    }

    return track;
  }
}
