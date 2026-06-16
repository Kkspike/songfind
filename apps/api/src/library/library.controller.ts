import { Controller, Get, NotFoundException, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { createReadStream, existsSync } from 'node:fs';
import { extname } from 'node:path';
import { LibraryService } from './library.service';
import { PrismaService } from '../prisma/prisma.service';

const MIME: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.wav': 'audio/wav',
  '.aac': 'audio/aac',
};

@Controller('library')
export class LibraryController {
  constructor(
    private readonly library: LibraryService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  search(@Query('q') q?: string) {
    return this.library.search(q);
  }

  @Get(':id/download')
  async download(@Param('id') id: string, @Res() res: Response) {
    const file = await this.prisma.libraryFile.findUnique({ where: { id } });
    if (!file) throw new NotFoundException('File not found');
    if (!existsSync(file.path)) throw new NotFoundException('File missing on disk');

    const mime = MIME[extname(file.filename).toLowerCase()] ?? 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`);
    createReadStream(file.path).pipe(res);
  }
}
