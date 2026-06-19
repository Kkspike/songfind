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
        // GET /artist/{id} for the full object — the list endpoint may omit fields Lidarr requires for PUT
        const { data: full } = await http.get<LidarrArtist>(`/artist/${existing.id}`);
        this.logger.log(`Artist "${artistName}" is unmonitored — setting monitored=true`);
        await http.put(`/artist/${existing.id}`, { ...full, monitored: true });
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

    // monitor:'none' so no albums are auto-monitored and no searches fire.
    // We will set artist.monitored=true ourselves — but only AFTER RefreshArtist completes,
    // because RefreshArtist resets the flag while it's running.
    const { data: created } = await http.post<LidarrArtist>('/artist', {
      ...best,
      monitored: true,
      rootFolderPath: rootFolder.path,
      qualityProfileId: rootFolder.defaultQualityProfileId,
      metadataProfileId: metadataProfile.id,
      addOptions: { monitor: 'none', searchForMissingAlbums: false },
    });

    // Trigger RefreshArtist and poll until it completes — do NOT set monitored while it's running.
    const { data: refreshCmd } = await http.post<{ id: number; status: string }>(
      '/command',
      { name: 'RefreshArtist', artistId: created.id },
    );
    this.logger.log(`RefreshArtist triggered for "${artistName}" (commandId=${refreshCmd.id}), waiting for completion…`);
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const { data: cmd } = await http.get<{ status: string }>(`/command/${refreshCmd.id}`);
      if (cmd.status === 'completed' || cmd.status === 'failed') {
        this.logger.log(`RefreshArtist ${cmd.status} after ${(i + 1) * 2}s`);
        break;
      }
    }

    // Now that RefreshArtist is done, set artist as monitored — it won't get reset anymore.
    const { data: artistNow } = await http.get<LidarrArtist>(`/artist/${created.id}`);
    if (!artistNow.monitored) {
      this.logger.log(`Setting artist "${artistName}" as monitored after refresh completion`);
      await http.put(`/artist/${created.id}`, { ...artistNow, monitored: true });
    }

    return { ...created, monitored: true };
  }

  async triggerArtistSearch(artistId: number): Promise<void> {
    const http = await this.client();
    await http.post('/command', { name: 'ArtistSearch', artistIds: [artistId] });
  }

  async findAlbumForTrack(artistId: number, trackTitle: string, albumName?: string | null): Promise<number | null> {
    try {
      const http = await this.client();

      // Best path: match by album title — no track queries needed
      if (albumName) {
        const { data: albums } = await http.get<{ id: number; title: string }[]>('/album', { params: { artistId } });
        const normalizedAlbum = normalize(albumName);
        const match = albums?.find((a) => normalize(a.title) === normalizedAlbum);
        if (match) {
          this.logger.log(`Album matched by title: "${albumName}" → id=${match.id}`);
          return match.id;
        }
        this.logger.log(`Album name "${albumName}" not matched in Lidarr — falling through to track search`);
      }

      const normalizedTitle = normalize(trackTitle);

      // Fast path: works for monitored albums (new artists added with monitor:'all', or previously monitored)
      const { data: artistTracks } = await http.get<LidarrTrack[]>('/track', { params: { artistId } });
      if (artistTracks?.length) {
        const match = artistTracks.find((t) => normalize(t.title) === normalizedTitle);
        if (match) {
          this.logger.log(`Track "${trackTitle}" found via artist track index → albumId=${match.albumId}`);
          return match.albumId;
        }
      }

      // Last resort: temporarily monitor all albums + RefreshArtist to force track indexing.
      // Used for existing artists added with monitor:'none' (old behavior) whose albums are unmonitored.
      // PUT /album/monitor and RefreshArtist do not trigger indexer searches by themselves.
      const { data: albums } = await http.get<{ id: number }[]>('/album', { params: { artistId } });
      if (!albums?.length) return null;

      const albumIds = albums.map((a) => a.id);
      await http.put('/album/monitor', { albumIds, monitored: true });
      await http.post('/command', { name: 'RefreshArtist', artistId });
      this.logger.log(`Last-resort: monitoring all ${albumIds.length} albums + RefreshArtist for artistId=${artistId}`);

      let allTracks: LidarrTrack[] = [];
      for (let i = 0; i < 15; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const { data } = await http.get<LidarrTrack[]>('/track', { params: { artistId } });
        if (data?.length) { allTracks = data; break; }
      }

      const match = allTracks.find((t) => normalize(t.title) === normalizedTitle);
      if (!match) {
        // No match — unmonitor everything we just enabled
        await http.put('/album/monitor', { albumIds, monitored: false });
        return null;
      }

      this.logger.log(`Track "${trackTitle}" found via last-resort scan → albumId=${match.albumId}`);
      // Leave all albums monitored for now — monitorOnlyAlbum() in acquire() will clean up
      return match.albumId;
    } catch {
      return null;
    }
  }

  async triggerAlbumSearch(albumId: number): Promise<void> {
    const http = await this.client();
    await http.post('/command', { name: 'AlbumSearch', albumIds: [albumId] });
  }

  // Ensures exactly one album is monitored for the artist: the target. All others are unmonitored.
  async monitorOnlyAlbum(artistId: number, albumId: number): Promise<void> {
    const http = await this.client();
    const { data: albums } = await http.get<{ id: number }[]>('/album', { params: { artistId } });
    const allIds = albums.map((a) => a.id);
    const otherIds = allIds.filter((id) => id !== albumId);

    await http.put('/album/monitor', { albumIds: [albumId], monitored: true });
    if (otherIds.length) {
      await http.put('/album/monitor', { albumIds: otherIds, monitored: false });
    }
    this.logger.log(`monitorOnlyAlbum: album ${albumId} monitored, ${otherIds.length} others unmonitored`);
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
