import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { normalize } from '../common/normalize';

export interface LibraryEntry {
  id: string;
  source: 'nas' | 'azuracast';
  artist: string;
  title: string;
  album: string | null;
  filename: string | null;
  path: string | null;
  stationId: string | null;
  uniqueId?: string | null;
  azuracastBaseUrl?: string | null;
}

export interface LibraryPage {
  items: LibraryEntry[];
  total: number;
  page: number;
  pageSize: number;
}

interface RawLibraryFile {
  id: string;
  filename: string;
  path: string;
  tags: unknown;
}

type SortKey = 'artist' | 'title' | 'album';
type SortOrder = 'asc' | 'desc';
type SourceFilter = 'all' | 'nas' | 'azuracast';

@Injectable()
export class LibraryService {
  constructor(private readonly prisma: PrismaService) {}

  async search(
    q?: string,
    source: SourceFilter = 'all',
    page = 1,
    pageSize = 50,
    sort: SortKey = 'artist',
    order: SortOrder = 'asc',
  ): Promise<LibraryPage> {
    const nq = q && q.trim().length > 0 ? normalize(q.trim()) : null;
    const like = nq ? `%${nq}%` : '%';

    const settings = await this.prisma.settings.findUnique({ where: { id: 1 } });
    const azuracastBaseUrl = settings?.azuracastUrl?.replace(/\/$/, '') ?? null;

    const [nasFiles, azTracks] = await Promise.all([
      source !== 'azuracast'
        ? this.prisma.$queryRaw<RawLibraryFile[]>`
            SELECT id, filename, path, tags
            FROM "LibraryFile"
            WHERE tags->>'normalizedArtist' LIKE ${like}
               OR tags->>'normalizedTitle'  LIKE ${like}
            LIMIT 5000
          `
        : Promise.resolve([] as RawLibraryFile[]),
      source !== 'nas'
        ? this.prisma.azuracastTrack.findMany({
            where: nq
              ? { OR: [{ normalizedArtist: { contains: nq } }, { normalizedTitle: { contains: nq } }] }
              : {},
            take: 5000,
            orderBy: { lastSeenAt: 'desc' },
          })
        : Promise.resolve([]),
    ]);

    const nasEntries: LibraryEntry[] = nasFiles.map((f) => {
      const tags = f.tags as Record<string, string> | null;
      return {
        id: f.id,
        source: 'nas',
        artist: tags?.artist ?? '',
        title: tags?.title ?? '',
        album: tags?.album ?? null,
        filename: f.filename,
        path: f.path,
        stationId: null,
      };
    });

    const azEntries: LibraryEntry[] = azTracks.map((t) => ({
      id: t.id,
      source: 'azuracast' as const,
      artist: t.artistName,
      title: t.title,
      album: null,
      filename: null,
      path: t.filePath ?? null,
      stationId: t.stationId,
      uniqueId: t.uniqueId ?? null,
      azuracastBaseUrl,
    }));

    const all = [...nasEntries, ...azEntries];

    all.sort((a, b) => {
      const va = (a[sort] ?? '').toLowerCase();
      const vb = (b[sort] ?? '').toLowerCase();
      return order === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });

    const total = all.length;
    const offset = (page - 1) * pageSize;
    return { items: all.slice(offset, offset + pageSize), total, page, pageSize };
  }
}
