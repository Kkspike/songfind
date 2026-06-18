import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LidarrService } from './lidarr.service';

@Injectable()
export class LidarrAcquisitionService {
  private readonly logger = new Logger(LidarrAcquisitionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lidarr: LidarrService,
  ) {}

  async acquire(trackId: string) {
    const track = await this.prisma.track.findUnique({ where: { id: trackId }, include: { artist: true } });
    if (!track) throw new NotFoundException('Track not found');
    if (track.status !== 'missing') {
      throw new BadRequestException(`Track is already "${track.status}" — only missing tracks can be acquired`);
    }

    const job = await this.prisma.acquisitionJob.create({
      data: { trackId, source: 'lidarr', status: 'searching' },
    });

    try {
      const artist = await this.lidarr.ensureArtistMonitored(track.artist.name);
      const albumId = await this.lidarr.findAlbumForTrack(artist.id, track.title);

      let action: string;
      if (albumId !== null) {
        await this.lidarr.triggerAlbumSearch(albumId);
        action = 'triggered_album_search';
      } else {
        await this.lidarr.triggerArtistSearch(artist.id);
        action = 'triggered_artist_search';
      }

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
