import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { MatchingService } from '../matching/matching.service';
import { AUDIO_EXTENSIONS, parseFileInfo } from './file-tag-parser';

@Injectable()
export class NasScannerService {
  private readonly logger = new Logger(NasScannerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly matching: MatchingService,
  ) {}

  async getMountPath(): Promise<string> {
    const settings = await this.prisma.settings.findUnique({ where: { id: 1 } });
    const mountPath = settings?.nasMountPath || process.env.NAS_MOUNT_PATH;
    if (!mountPath) throw new Error('NAS mount path is not configured');
    return mountPath;
  }

  async scan() {
    const mountPath = await this.getMountPath();
    const filePaths = await this.walk(mountPath);

    let scanned = 0;
    let parsedOk = 0;
    let parseFailed = 0;

    for (const filePath of filePaths) {
      scanned++;
      const filename = path.basename(filePath);
      const stat = await fs.stat(filePath);
      const info = await parseFileInfo(filePath, filename);

      if (!info) {
        parseFailed++;
        this.logger.warn(`Could not determine artist/title for ${filePath}`);
        continue;
      }
      parsedOk++;

      await this.prisma.libraryFile.upsert({
        where: { path: filePath },
        create: {
          path: filePath,
          filename,
          sizeBytes: stat.size,
          tags: {
            artist: info.artist,
            title: info.title,
            album: info.album ?? null,
            normalizedArtist: info.normalizedArtist,
            normalizedTitle: info.normalizedTitle,
          },
        },
        update: {
          sizeBytes: stat.size,
          tags: {
            artist: info.artist,
            title: info.title,
            album: info.album ?? null,
            normalizedArtist: info.normalizedArtist,
            normalizedTitle: info.normalizedTitle,
          },
          scannedAt: new Date(),
        },
      });
    }

    await this.removeStaleEntries(filePaths);
    const matchResult = await this.matching.rematchAllMissingTracks();

    return { scanned, parsedOk, parseFailed, ...matchResult };
  }

  private async removeStaleEntries(currentPaths: string[]) {
    const currentSet = new Set(currentPaths);
    const existing = await this.prisma.libraryFile.findMany({ select: { id: true, path: true } });
    const staleIds = existing.filter((f) => !currentSet.has(f.path)).map((f) => f.id);
    if (staleIds.length > 0) {
      await this.prisma.libraryFile.deleteMany({ where: { id: { in: staleIds } } });
    }
  }

  private async walk(dir: string): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await this.walk(fullPath)));
      } else if (AUDIO_EXTENSIONS.includes(path.extname(entry.name).toLowerCase())) {
        files.push(fullPath);
      }
    }

    return files;
  }
}
