import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { extname } from 'node:path';
import { ZipArchive } from 'archiver';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExportService {
  constructor(private readonly prisma: PrismaService) {}

  async streamZip(listId: string, res: Response) {
    const list = await this.prisma.songList.findUnique({
      where: { id: listId },
      include: {
        items: {
          orderBy: { position: 'asc' },
          include: {
            track: {
              include: {
                artist: true,
                libraryFiles: { take: 1 },
              },
            },
          },
        },
      },
    });
    if (!list) throw new NotFoundException('List not found');

    const ownedItems = list.items.filter((i) => i.track.libraryFiles.length > 0);
    if (ownedItems.length === 0) {
      throw new BadRequestException('No owned NAS tracks in this list to export');
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(sanitize(list.name))}.zip`,
    );

    const archive = new ZipArchive({ zlib: { level: 6 } });
    archive.on('error', (err) => res.destroy(err));
    archive.pipe(res);

    const usedNames = new Set<string>();
    for (const item of ownedItems) {
      const file = item.track.libraryFiles[0];
      const ext = extname(file.filename);
      const base = `${sanitize(item.track.artist.name)} - ${sanitize(item.track.title)}`;
      const entryName = dedup(`${base}${ext}`, usedNames);
      archive.file(file.path, { name: entryName });
    }

    await archive.finalize();
  }
}

function sanitize(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '_').trim();
}

function dedup(filename: string, used: Set<string>): string {
  if (!used.has(filename)) {
    used.add(filename);
    return filename;
  }
  const ext = extname(filename);
  const base = filename.slice(0, filename.length - ext.length);
  let i = 2;
  let candidate = `${base} (${i})${ext}`;
  while (used.has(candidate)) candidate = `${base} (${++i})${ext}`;
  used.add(candidate);
  return candidate;
}
