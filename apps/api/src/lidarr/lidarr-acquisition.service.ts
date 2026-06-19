import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LidarrService } from './lidarr.service';
import { AlbumLookupService } from './album-lookup.service';

@Injectable()
export class LidarrAcquisitionService {
  private readonly logger = new Logger(LidarrAcquisitionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lidarr: LidarrService,
    private readonly albumLookup: AlbumLookupService,
  ) {}

  async acquire(trackId: string) {
    let track = await this.prisma.track.findUnique({ where: { id: trackId }, include: { artist: true } });
    if (!track) throw new NotFoundException('Track not found');
    if (track.status !== 'missing') {
      throw new BadRequestException(`Track is already "${track.status}" — only missing tracks can be acquired`);
    }

    const job = await this.prisma.acquisitionJob.create({
      data: { trackId, source: 'lidarr', status: 'searching' },
    });

    try {
      // If album name is unknown, look it up from Spotify / MusicBrainz and persist it
      if (!track.album) {
        const albumName = await this.albumLookup.lookupAlbumName(track.artist.name, track.title);
        if (albumName) {
          await this.prisma.track.update({ where: { id: trackId }, data: { album: albumName } });
          track = { ...track, album: albumName };
        }
      }

      const artist = await this.lidarr.ensureArtistMonitored(track.artist.name);
      const albumId = await this.lidarr.findAlbumForTrack(artist.id, track.title, track.album);

      if (albumId === null) {
        const albumNote = track.album
          ? ` (looked up album "${track.album}" but it didn't match any Lidarr album)`
          : ' (album unknown — Spotify/MusicBrainz lookup returned nothing)';
        throw new Error(`Could not find album for "${track.title}"${albumNote}`);
      }

      await this.lidarr.monitorOnlyAlbum(artist.id, albumId);
      await this.lidarr.triggerAlbumSearch(albumId);
      const action = 'triggered_album_search';

      await this.prisma.track.update({ where: { id: trackId }, data: { status: 'acquiring' } });
      return this.prisma.acquisitionJob.update({
        where: { id: job.id },
        data: { attempts: [{ at: new Date().toISOString(), action, lidarrArtistId: artist.id, lidarrAlbumId: albumId }] },
      });
    } catch (err) {
      this.logger.error(`Lidarr acquisition failed for track ${trackId}`, err);
      return this.prisma.acquisitionJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          attempts: [{ at: new Date().toISOString(), action: 'error', message: String(err) }],
        },
      });
    }
  }

  async checkStatus(trackId: string) {
    const track = await this.prisma.track.findUnique({ where: { id: trackId }, include: { artist: true } });
    if (!track) throw new NotFoundException('Track not found');

    const job = await this.prisma.acquisitionJob.findFirst({
      where: { trackId, source: 'lidarr' },
      orderBy: { createdAt: 'desc' },
    });
    if (!job) throw new NotFoundException('No Lidarr acquisition job found for this track');

    const localArtist = await this.lidarr.findLocalArtist(track.artist.name);
    if (!localArtist) {
      return { status: job.status, hasFile: false };
    }

    const importStatus = await this.lidarr.findTrackImportStatus(localArtist.id, track.title);
    if (importStatus?.hasFile) {
      await this.prisma.$transaction([
        this.prisma.track.update({ where: { id: trackId }, data: { status: 'owned' } }),
        this.prisma.acquisitionJob.update({ where: { id: job.id }, data: { status: 'done' } }),
      ]);
      return { status: 'done', hasFile: true };
    }

    return { status: job.status, hasFile: false };
  }
}
