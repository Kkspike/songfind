import { Controller, Get, InternalServerErrorException, Logger, NotFoundException, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { createReadStream, existsSync } from 'node:fs';
import { extname } from 'node:path';
import axios, { type AxiosError } from 'axios';
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
  private readonly logger = new Logger(LibraryController.name);

  constructor(
    private readonly library: LibraryService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('stats')
  stats() {
    return this.library.stats();
  }

  @Get()
  search(
    @Query('q') q?: string,
    @Query('source') source?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: string,
  ) {
    return this.library.search(
      q,
      (source as 'all' | 'nas' | 'azuracast') || 'all',
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 50,
      (sort as 'artist' | 'title' | 'album') || 'artist',
      (order as 'asc' | 'desc') || 'asc',
    );
  }

  @Get('azuracast/:id/download')
  async downloadAzuracast(@Param('id') id: string, @Res() res: Response) {
    const track = await this.prisma.azuracastTrack.findUnique({ where: { id } });
    if (!track) throw new NotFoundException('Track not found');
    if (!track.uniqueId) throw new NotFoundException('No file ID — re-run Azuracast poll');

    const settings = await this.prisma.settings.findUnique({ where: { id: 1 } });
    if (!settings?.azuracastUrl || !settings.azuracastApiKey) {
      throw new NotFoundException('Azuracast not configured');
    }

    const base = settings.azuracastUrl.replace(/\/$/, '');
    const authHeaders = { 'X-API-Key': settings.azuracastApiKey };

    // Resolve shortcode → numeric station ID (Azuracast's /file/{id}/play requires numeric ID)
    let stationId = track.stationId;
    try {
      const stations = await axios.get<Array<{ id: number; shortcode: string }>>(
        `${base}/api/stations`,
        { headers: authHeaders },
      );
      const match = stations.data.find(
        (s) => s.shortcode === track.stationId || String(s.id) === track.stationId,
      );
      if (match) stationId = String(match.id);
    } catch { /* fall back to stored stationId */ }

    // Correct Azuracast endpoint: /api/station/{numericId}/file/{fileId}/play
    const playUrl = `${base}/api/station/${stationId}/file/${track.uniqueId}/play`;
    this.logger.log(`Proxying Azuracast play: ${playUrl}`);

    let upstream: Awaited<ReturnType<typeof axios.get<import('stream').Readable>>>;
    try {
      upstream = await axios.get<import('stream').Readable>(playUrl, {
        headers: authHeaders,
        responseType: 'stream',
      });
    } catch (err) {
      const axErr = err as AxiosError;
      const status = axErr.response?.status;
      this.logger.error(`Azuracast play failed: HTTP ${status ?? String(err)} — ${playUrl}`);
      throw new InternalServerErrorException(`Azuracast returned HTTP ${status ?? 'error'}`);
    }

    const contentType = upstream.headers['content-type'] as string | undefined;
    res.setHeader('Content-Type', contentType ?? 'application/octet-stream');
    const filename = track.filePath?.split('/').pop() ?? `${track.title}.mp3`;
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    upstream.data.pipe(res);
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
