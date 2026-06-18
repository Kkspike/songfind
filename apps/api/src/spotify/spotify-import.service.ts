import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrackUpsertService } from '../lists/track-upsert.service';
import { MatchingService } from '../matching/matching.service';
import { AzuracastService } from '../azuracast/azuracast.service';
import { SpotifyService } from './spotify.service';

@Injectable()
export class SpotifyImportService {
  private readonly logger = new Logger(SpotifyImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly trackUpsert: TrackUpsertService,
    private readonly matching: MatchingService,
    private readonly azuracast: AzuracastService,
    private readonly spotify: SpotifyService,
  ) {}

  async importLikedSongs() {
    const entries = await this.spotify.getLikedSongs();
    return this.importAsNewList('Spotify Liked Songs', entries);
  }

  async importPlaylist(playlistId: string) {
    const playlists = await this.spotify.listPlaylists();
    const playlist = playlists.find((p) => p.id === playlistId);
    const entries = await this.spotify.getPlaylistTracks(playlistId);
    return this.importAsNewList(playlist?.name ?? `Spotify Playlist ${playlistId}`, entries);
  }

  private async importAsNewList(name: string, entries: { artist: string; title: string }[]) {
    const list = await this.prisma.songList.create({ data: { name } });

    let position = 0;
    let added = 0;
    let skipped = 0;
    for (const entry of entries) {
      const track = await this.trackUpsert.upsertTrack(entry);
      try {
        await this.prisma.songListItem.create({ data: { listId: list.id, trackId: track.id, position } });
        position += 1;
        added += 1;
      } catch {
        skipped += 1;
      }
    }

    try {
      await this.azuracast.poll();
    } catch (err) {
      this.logger.warn('Azuracast poll failed during Spotify import — matching may be incomplete', err);
    }
    await this.matching.rematchAllMissingTracks();
    return { listId: list.id, listName: list.name, parsed: entries.length, added, skipped };
  }
}
