import { Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { SpotifyService } from './spotify.service';
import { SpotifyImportService } from './spotify-import.service';

@Controller('spotify')
export class SpotifyController {
  constructor(
    private readonly spotify: SpotifyService,
    private readonly spotifyImport: SpotifyImportService,
  ) {}

  @Get('login')
  async login(@Res() res: Response) {
    const url = await this.spotify.getAuthorizeUrl();
    res.redirect(url);
  }

  @Get('callback')
  async callback(@Query('code') code: string, @Res() res: Response) {
    await this.spotify.handleCallback(code);
    res.send('Spotify connected. You can close this tab.');
  }

  @Get('playlists')
  listPlaylists() {
    return this.spotify.listPlaylists();
  }

  @Post('import/liked-songs')
  importLikedSongs() {
    return this.spotifyImport.importLikedSongs();
  }

  @Post('import/playlist/:playlistId')
  importPlaylist(@Param('playlistId') playlistId: string) {
    return this.spotifyImport.importPlaylist(playlistId);
  }
}
