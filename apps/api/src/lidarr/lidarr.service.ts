import { Injectable, Logger } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { normalize } from '../common/normalize';

interface LidarrArtist {
  id: number;
  artistName: string;
  foreignArtistId: string;
  monitored: boolean;
}

interface LidarrRootFolder {
  id: number;
  path: string;
  defaultQualityProfileId: number;
  defaultMetadataProfileId: number;
}

interface LidarrTrack {
  id: number;
  title: string;
  hasFile: boolean;
  artistId: number;
}

@Injectable()
export class LidarrService {
  private readonly logger = new Logger(LidarrService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async client(): Promise<AxiosInstance> {
    const settings = await this.prisma.settings.findUnique({ where: { id: 1 } });
    if (!settings?.lidarrUrl || !settings.lidarrApiKey) {
      throw new Error('Lidarr is not configured');
    }
    return axios.create({
      baseURL: `${settings.lidarrUrl.replace(/\/$/, '')}/api/v1`,
      headers: { 'X-Api-Key': settings.lidarrApiKey },
    });
  }

  async findLocalArtist(artistName: string): Promise<LidarrArtist | null> {
    const http = await this.client();
    const { data } = await http.get<LidarrArtist[]>('/artist');
    const normalizedTarget = normalize(artistName);
    return data.find((a) => normalize(a.artistName) === normalizedTarget) ?? null;
  }

  async ensureArtistMonitored(artistName: string): Promise<LidarrArtist> {
    const http = await this.client();
    const existing = await this.findLocalArtist(artistName);

    if (existing) {
      if (!existing.monitored) {
        await http.put(`/artist/${existing.id}`, { ...existing, monitored: true });
      }
      return existing;
    }

    const { data: lookupResults } = await http.get('/artist/lookup', { params: { term: artistName } });
    if (!lookupResults?.length) {
      throw new Error(`No Lidarr lookup result for artist "${artistName}"`);
    }
    const best = lookupResults[0];

    const { data: rootFolders } = await http.get<LidarrRootFolder[]>('/rootfolder');
    if (!rootFolders.length) throw new Error('No Lidarr root folder configured');
    const rootFolder = rootFolders[0];

    const { data: created } = await http.post<LidarrArtist>('/artist', {
      ...best,
      monitored: true,
      rootFolderPath: rootFolder.path,
      qualityProfileId: rootFolder.defaultQualityProfileId,
      metadataProfileId: rootFolder.defaultMetadataProfileId,
      addOptions: { monitor: 'all', searchForMissingAlbums: true },
    });

    return created;
  }

  async triggerArtistSearch(artistId: number): Promise<void> {
    const http = await this.client();
    await http.post('/command', { name: 'ArtistSearch', artistIds: [artistId] });
  }

  async findTrackImportStatus(
    artistId: number,
    trackTitle: string,
  ): Promise<{ hasFile: boolean } | null> {
    const http = await this.client();
    const { data } = await http.get<LidarrTrack[]>('/track', { params: { artistId } });
    const normalizedTarget = normalize(trackTitle);
    const matches = data.filter((t) => normalize(t.title) === normalizedTarget);
    if (matches.length === 0) return null;
    return { hasFile: matches.some((t) => t.hasFile) };
  }
}
