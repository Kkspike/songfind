import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { normalize } from '../common/normalize';

@Injectable()
export class AlbumLookupService {
  private readonly logger = new Logger(AlbumLookupService.name);

  constructor(private readonly prisma: PrismaService) {}

  async lookupAlbumName(artist: string, title: string): Promise<string | null> {
    const fromSpotify = await this.fromSpotify(artist, title);
    if (fromSpotify) {
      this.logger.log(`Album for "${title}" resolved via Spotify: "${fromSpotify}"`);
      return fromSpotify;
    }
    const fromMb = await this.fromMusicBrainz(artist, title);
    if (fromMb) {
      this.logger.log(`Album for "${title}" resolved via MusicBrainz: "${fromMb}"`);
    }
    return fromMb;
  }

  private async fromSpotify(artist: string, title: string): Promise<string | null> {
    try {
      const settings = await this.prisma.settings.findUnique({ where: { id: 1 } });
      if (!settings?.spotifyAccessToken) return null;

      const { data } = await axios.get('https://api.spotify.com/v1/search', {
        params: { q: `track:${title} artist:${artist}`, type: 'track', limit: 5 },
        headers: { Authorization: `Bearer ${settings.spotifyAccessToken}` },
        timeout: 8000,
      });

      const tracks: any[] = data.tracks?.items ?? [];
      const na = normalize(artist);
      const nt = normalize(title);

      const exact = tracks.find(
        (t) => normalize(t.artists[0]?.name ?? '') === na && normalize(t.name ?? '') === nt,
      );
      return (exact ?? tracks[0])?.album?.name ?? null;
    } catch {
      return null;
    }
  }

  private async fromMusicBrainz(artist: string, title: string): Promise<string | null> {
    try {
      const safeArtist = artist.replace(/"/g, '');
      const safeTitle = title.replace(/"/g, '');
      const { data } = await axios.get('https://musicbrainz.org/ws/2/recording/', {
        params: {
          query: `recording:"${safeTitle}" AND artist:"${safeArtist}"`,
          fmt: 'json',
          limit: 5,
        },
        headers: { 'User-Agent': 'SongFind/1.0 (self-hosted)' },
        timeout: 10000,
      });

      const recordings: any[] = data.recordings ?? [];
      const na = normalize(artist);
      const nt = normalize(title);

      const exact = recordings.find(
        (r) =>
          normalize(r['artist-credit']?.[0]?.artist?.name ?? '') === na &&
          normalize(r.title ?? '') === nt,
      );
      return (exact ?? recordings[0])?.releases?.[0]?.title ?? null;
    } catch {
      return null;
    }
  }
}
