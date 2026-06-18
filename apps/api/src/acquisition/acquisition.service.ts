import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as path from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { MatchingService } from '../matching/matching.service';
import { NasScannerService } from '../nas-scanner/nas-scanner.service';
import { YoutubeService, type YoutubeCandidate } from '../youtube-fallback/youtube.service';
import { LidarrAcquisitionService } from '../lidarr/lidarr-acquisition.service';

const YOUTUBE_IMPORTS_SUBFOLDER = '_YouTube Imports';

@Injectable()
export class AcquisitionService {
  private readonly logger = new Logger(AcquisitionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly matching: MatchingService,
    private readonly nasScanner: NasScannerService,
    private readonly youtube: YoutubeService,
    private readonly lidarrAcquisition: LidarrAcquisitionService,
  ) {}

  async clearAllJobs() {
    await this.prisma.track.updateMany({
      where: { status: { in: ['acquiring', 'needs_approval'] } },
      data: { status: 'missing' },
    });
    const { count } = await this.prisma.acquisitionJob.deleteMany({});
    return { deleted: count };
  }

  async recheckAcquiring() {
    const tracks = await this.prisma.track.findMany({
      where: { status: 'acquiring' },
      select: { id: true },
    });

    let nowOwned = 0;
    let stillAcquiring = 0;
    let errors = 0;

    for (const track of tracks) {
      try {
        const result = await this.lidarrAcquisition.checkStatus(track.id);
        if (result.hasFile) nowOwned++;
        else stillAcquiring++;
      } catch {
        errors++;
      }
    }

    return { checked: tracks.length, nowOwned, stillAcquiring, errors };
  }

  async checkTimeouts() {
    const settings = await this.prisma.settings.findUnique({ where: { id: 1 } });
    const timeoutMins = settings?.fallbackTimeoutMins ?? 30;
    const cutoff = new Date(Date.now() - timeoutMins * 60_000);

    const staleJobs = await this.prisma.acquisitionJob.findMany({
      where: { source: 'lidarr', status: 'searching', createdAt: { lt: cutoff } },
      include: { track: { include: { artist: true } } },
    });

    const proposed: string[] = [];
    for (const job of staleJobs) {
      await this.prisma.acquisitionJob.update({ where: { id: job.id }, data: { status: 'failed' } });
      await this.proposeYoutubeCandidates(job.trackId);
      proposed.push(job.trackId);
    }

    return { checked: staleJobs.length, proposed };
  }

  async proposeYoutubeCandidates(trackId: string) {
    const track = await this.prisma.track.findUnique({ where: { id: trackId }, include: { artist: true } });
    if (!track) throw new NotFoundException('Track not found');

    const query = `${track.artist.name} ${track.title}`;
    const candidates = await this.youtube.search(query, 5);

    const job = await this.prisma.acquisitionJob.create({
      data: {
        trackId,
        source: 'youtube',
        status: 'awaiting_approval',
        attempts: [
          { at: new Date().toISOString(), action: 'proposed_candidates', candidates: candidates as object },
        ] as object[],
      },
    });

    await this.prisma.track.update({ where: { id: trackId }, data: { status: 'needs_approval' } });
    return job;
  }

  async listJobs() {
    const jobs = await this.prisma.acquisitionJob.findMany({
      include: { track: { include: { artist: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    return jobs.map((job) => {
      const attempts = job.attempts as any[];
      const lastAttempt = attempts?.at(-1);
      const errorMessage = job.status === 'failed' ? (lastAttempt?.message ?? null) : null;
      return {
        id: job.id,
        source: job.source,
        status: job.status,
        track: { id: job.track.id, title: job.track.title, artist: job.track.artist.name },
        errorMessage,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      };
    });
  }

  async listPendingApprovals() {
    const jobs = await this.prisma.acquisitionJob.findMany({
      where: { source: 'youtube', status: 'awaiting_approval' },
      include: { track: { include: { artist: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return jobs.map((job) => ({
      jobId: job.id,
      track: { id: job.track.id, title: job.track.title, artist: job.track.artist.name },
      candidates: (job.attempts as any[]).at(-1)?.candidates as YoutubeCandidate[] | undefined,
    }));
  }

  async approveCandidate(jobId: string, videoId: string) {
    const job = await this.prisma.acquisitionJob.findUnique({
      where: { id: jobId },
      include: { track: { include: { artist: true } } },
    });
    if (!job) throw new NotFoundException('Acquisition job not found');

    const candidates = (job.attempts as any[]).at(-1)?.candidates as YoutubeCandidate[] | undefined;
    const candidate = candidates?.find((c) => c.videoId === videoId);
    if (!candidate) throw new NotFoundException('Candidate not found on this job');

    const settings = await this.prisma.settings.findUnique({ where: { id: 1 } });
    if (!settings?.nasMountPath) throw new Error('NAS mount path is not configured');
    const destDir = path.join(settings.nasMountPath, YOUTUBE_IMPORTS_SUBFOLDER);

    await this.prisma.acquisitionJob.update({ where: { id: jobId }, data: { status: 'downloading' } });

    try {
      await this.youtube.download(videoId, destDir, job.track.artist.name, job.track.title);
    } catch (err) {
      this.logger.error(`YouTube download failed for job ${jobId}`, err);
      await this.prisma.acquisitionJob.update({ where: { id: jobId }, data: { status: 'failed' } });
      throw err;
    }

    await this.nasScanner.scan();

    const refreshedTrack = await this.prisma.track.findUnique({ where: { id: job.trackId } });
    const status = refreshedTrack?.status === 'owned' ? 'done' : 'importing';
    await this.prisma.acquisitionJob.update({ where: { id: jobId }, data: { status } });

    return { status, trackStatus: refreshedTrack?.status };
  }
}
