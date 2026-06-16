import { Injectable, NotFoundException } from '@nestjs/common';
import * as path from 'node:path';
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
          include: { track: { include: { libraryFiles: true } } },
        },
      },
    });
    if (!list) throw new NotFoundException('List not found');

    const filePaths = list.items
      .flatMap((item) => item.track.libraryFiles)
      .filter((f) => f.path);

    const usedNames = new Set<string>();
    const archive = new ZipArchive({ zlib: { level: 9 } });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${sanitizeFilename(list.name)}.zip"`,
    );

    archive.on('error', (err) => {
      res.destroy(err);
    });
    archive.pipe(res);

    for (const file of filePaths) {
      const entryName = uniqueEntryName(file.filename, usedNames);
      archive.file(file.path, { name: entryName });
    }

    await archive.finalize();
  }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '_');
}

function uniqueEntryName(filename: string, used: Set<string>): string {
  if (!used.has(filename)) {
    used.add(filename);
    return filename;
  }
  const ext = path.extname(filename);
  const base = filename.slice(0, filename.length - ext.length);
  let i = 2;
  let candidate = `${base} (${i})${ext}`;
  while (used.has(candidate)) {
    i++;
    candidate = `${base} (${i})${ext}`;
  }
  used.add(candidate);
  return candidate;
}
