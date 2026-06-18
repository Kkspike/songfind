import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { extname } from 'node:path';
import { ZipArchive } from 'archiver';
import axios from 'axios';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(private readonly prisma: PrismaService) {}

  async streamZip(listId: string, res: Response, includeAzuracast = false) {
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
                azuracastTracks: { take: 1 },
              },
            },
          },
        },
      },
    });
    if (!list) throw new NotFoundException('List not found');

    const nasItems = list.items.filter((i) => i.track.libraryFiles.length > 0);
    const azItems = includeAzuracast
      ? list.items.filter((i) => i.track.libraryFiles.length === 0 && i.track.azuracastTracks.length > 0)
      : [];

    if (nasItems.length === 0 && azItems.length === 0) {
      const msg = includeAzuracast
        ? 'No exportable tracks (no NAS files and no Azuracast tracks) in this list'
        : 'No owned NAS tracks in this list to export';
      throw new BadRequestException(msg);
    }

    // Resolve Azuracast station shortcodes → numeric IDs once
    const stationIdMap = new Map<string, string>();
    if (azItems.length > 0) {
      const settings = await this.prisma.settings.findUnique({ where: { id: 1 } });
      if (settings?.azuracastUrl && settings.azuracastApiKey) {
        try {
          const base = settings.azuracastUrl.replace(/\/$/, '');
          const { data } = await axios.get<Array<{ id: number; shortcode: string }>>(
            `${base}/api/stations`,
            { headers: { 'X-API-Key': settings.azuracastApiKey } },
          );
          for (const s of data) stationIdMap.set(s.shortcode, String(s.id));
        } catch { /* fall back to stored stationId */ }
      }
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

    for (const item of nasItems) {
      const file = item.track.libraryFiles[0];
      const ext = extname(file.filename);
      const base = `${sanitize(item.track.artist.name)} - ${sanitize(item.track.title)}`;
      archive.file(file.path, { name: dedup(`${base}${ext}`, usedNames) });
    }

    const settings = azItems.length > 0
      ? await this.prisma.settings.findUnique({ where: { id: 1 } })
      : null;

    for (const item of azItems) {
      const azTrack = item.track.azuracastTracks[0];
      if (!azTrack.uniqueId || !settings?.azuracastUrl || !settings.azuracastApiKey) continue;

      const base = settings.azuracastUrl.replace(/\/$/, '');
      const numericId = stationIdMap.get(azTrack.stationId) ?? azTrack.stationId;
      const playUrl = `${base}/api/station/${numericId}/file/${azTrack.uniqueId}/play`;

      try {
        const upstream = await axios.get<import('stream').Readable>(playUrl, {
          headers: { 'X-API-Key': settings.azuracastApiKey },
          responseType: 'stream',
        });
        const ext = extname(azTrack.filePath ?? '') || '.mp3';
        const entryBase = `${sanitize(item.track.artist.name)} - ${sanitize(item.track.title)}`;
        archive.append(upstream.data, { name: dedup(`${entryBase}${ext}`, usedNames) });
      } catch (err) {
        this.logger.error(`Failed to fetch Azuracast file for ${item.track.title}`, err);
      }
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
