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
  albumId: number;
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

    const { data: metadataProfiles } = await http.get<{ id: number; name: string }[]>('/metadataprofile');
    const metadataProfile =
      metadataProfiles.find((p) => p.name.toLowerCase() === 'standard') ?? metadataProfiles[0];
    if (!metadataProfile) throw new Error('No Lidarr metadata profile found');

    const { data: created } = await http.post<LidarrArtist>('/artist', {
      ...best,
      monitored: true,
      rootFolderPath: rootFolder.path,
      qualityProfileId: rootFolder.defaultQualityProfileId,
      metadataProfileId: metadataProfile.id,
      addOptions: { monitor: 'none', searchForMissingAlbums: false },
    });

    // Trigger a full refresh so Lidarr populates track records from MusicBrainz
    await http.post('/command', { name: 'RefreshArtist', artistId: created.id });
    this.logger.log(`RefreshArtist triggered for "${artistName}" (id=${created.id}), waiting for tracks…`);
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const { data: tracks } = await http.get<LidarrTrack[]>('/track', { params: { artistId: created.id } });
      if (tracks?.length) {
        this.logger.log(`Tracks ready after ${(i + 1) * 2}s — ${tracks.length} tracks`);
        break;
      }
    }

    return created;
  }

  async triggerArtistSearch(artistId: number): Promise<void> {
    const http = await this.client();
    await http.post('/command', { name: 'ArtistSearch', artistIds: [artistId] });
  }

  async findAlbumForTrack(artistId: number, trackTitle: string): Promise<number | null> {
    try {
      const http = await this.client();
      const normalizedTarget = normalize(trackTitle);

      // Fast path: works when the artist already has monitored albums with indexed tracks
      const { data: artistTracks } = await http.get<LidarrTrack[]>('/track', { params: { artistId } });
      if (artistTracks?.length) {
        const match = artistTracks.find((t) => normalize(t.title) === normalizedTarget);
        if (match) return match.albumId;
      }

      // Per-album path: for newly added artists, query each album's track list from Lidarr's DB
      const { data: albums } = await http.get<{ id: number }[]>('/album', { params: { artistId } });
      for (const album of albums ?? []) {
        const { data: tracks } = await http.get<LidarrTrack[]>('/track', { params: { albumId: album.id } });
        if (tracks?.some((t) => normalize(t.title) === normalizedTarget)) {
          return album.id;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  async triggerAlbumSearch(albumId: number): Promise<void> {
    const http = await this.client();
    await http.post('/command', { name: 'AlbumSearch', albumIds: [albumId] });
  }

  async monitorAlbum(albumId: number): Promise<void> {
    const http = await this.client();
    await http.put('/album/monitor', { albumIds: [albumId], monitored: true });
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
