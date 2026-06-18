import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SCOPES = 'user-library-read playlist-read-private';

interface SpotifyTrackItem {
  track: { name: string; artists: { name: string }[] } | null;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  trackCount: number;
}

export interface SpotifyImportEntry {
  artist: string;
  title: string;
}

@Injectable()
export class SpotifyService {
  constructor(private readonly prisma: PrismaService) {}

  async getAuthorizeUrl(): Promise<string> {
    const settings = await this.requireSettings();
    const params = new URLSearchParams({
      client_id: settings.spotifyClientId!,
      response_type: 'code',
      redirect_uri: settings.spotifyRedirectUri!,
      scope: SCOPES,
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
  }

  async handleCallback(code: string): Promise<void> {
    const settings = await this.requireSettings();
    const { data } = await axios.post(
      TOKEN_URL,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: settings.spotifyRedirectUri!,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${settings.spotifyClientId}:${settings.spotifyClientSecret}`).toString('base64')}`,
        },
      },
    );

    await this.prisma.settings.update({
      where: { id: 1 },
      data: { spotifyAccessToken: data.access_token, spotifyRefreshToken: data.refresh_token },
    });
  }

  async listPlaylists(): Promise<SpotifyPlaylist[]> {
    const http = await this.authedClient();
    const { data } = await http.get('/me/playlists', { params: { limit: 50 } });
    return data.items.map((p: any) => ({ id: p.id, name: p.name, trackCount: p.tracks.total }));
  }

  async getPlaylistTracks(playlistId: string): Promise<SpotifyImportEntry[]> {
    const http = await this.authedClient();
    return this.paginateTracks(http, `/playlists/${playlistId}/tracks`);
  }

  async getLikedSongs(): Promise<SpotifyImportEntry[]> {
    const http = await this.authedClient();
    return this.paginateTracks(http, '/me/tracks');
  }

  private async paginateTracks(
    http: Awaited<ReturnType<SpotifyService['authedClient']>>,
    initialPath: string,
  ): Promise<SpotifyImportEntry[]> {
    const entries: SpotifyImportEntry[] = [];
    let url: string | null = `${initialPath}?limit=50`;

    while (url) {
      const { data } = await http.get(url);
      for (const item of data.items as SpotifyTrackItem[]) {
        if (!item.track) continue;
        const artist = item.track.artists[0]?.name;
        if (artist && item.track.name) entries.push({ artist, title: item.track.name });
      }
      url = data.next ? data.next.replace('https://api.spotify.com/v1', '') : null;
    }

    return entries;
  }

  private async requireSettings() {
    const settings = await this.prisma.settings.findUnique({ where: { id: 1 } });
    if (!settings?.spotifyClientId || !settings.spotifyClientSecret || !settings.spotifyRedirectUri) {
      throw new Error('Spotify is not configured');
    }
    return settings;
  }

  private async authedClient() {
    const settings = await this.refreshAccessTokenIfNeeded();
    return axios.create({
      baseURL: 'https://api.spotify.com/v1',
      headers: { Authorization: `Bearer ${settings.spotifyAccessToken}` },
    });
  }

  private async refreshAccessTokenIfNeeded() {
    const settings = await this.requireSettings();
    if (!settings.spotifyRefreshToken) throw new Error('Spotify is not authorized yet');

    try {
      const { data } = await axios.post(
        TOKEN_URL,
        new URLSearchParams({ grant_type: 'refresh_token', refresh_token: settings.spotifyRefreshToken }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${Buffer.from(`${settings.spotifyClientId}:${settings.spotifyClientSecret}`).toString('base64')}`,
          },
        },
      );

      return this.prisma.settings.update({
        where: { id: 1 },
        data: {
          spotifyAccessToken: data.access_token,
          ...(data.refresh_token ? { spotifyRefreshToken: data.refresh_token } : {}),
        },
      });
    } catch (err: any) {
      if (err?.response?.data?.error === 'invalid_grant') {
        await this.prisma.settings.update({
          where: { id: 1 },
          data: { spotifyAccessToken: null, spotifyRefreshToken: null },
        });
        throw new Error('Spotify session expired — please reconnect Spotify in Settings');
      }
      throw err;
    }
  }
}
