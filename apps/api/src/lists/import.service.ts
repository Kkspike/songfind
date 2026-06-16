import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrackUpsertService } from './track-upsert.service';
import { parseCsvBuffer, parseTextList, type ParsedEntry } from './parsing';

@Injectable()
export class ImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trackUpsert: TrackUpsertService,
  ) {}

  async importText(listId: string, text: string) {
    return this.importEntries(listId, parseTextList(text));
  }

  async importCsv(listId: string, buffer: Buffer) {
    return this.importEntries(listId, parseCsvBuffer(buffer));
  }

  private async importEntries(listId: string, entries: ParsedEntry[]) {
    const list = await this.prisma.songList.findUnique({ where: { id: listId } });
    if (!list) throw new NotFoundException('List not found');

    const lastItem = await this.prisma.songListItem.findFirst({
      where: { listId },
      orderBy: { position: 'desc' },
    });
    let position = (lastItem?.position ?? -1) + 1;

    let added = 0;
    let skipped = 0;
    for (const entry of entries) {
      const track = await this.trackUpsert.upsertTrack(entry);
      try {
        await this.prisma.songListItem.create({
          data: { listId, trackId: track.id, position },
        });
        position += 1;
        added += 1;
      } catch {
        // unique constraint violation: track already in this list
        skipped += 1;
      }
    }

    return { parsed: entries.length, added, skipped };
  }
}
