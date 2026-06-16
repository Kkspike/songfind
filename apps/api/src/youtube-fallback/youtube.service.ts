import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const execFileAsync = promisify(execFile);

export interface YoutubeCandidate {
  videoId: string;
  title: string;
  uploader: string;
  durationSec: number | null;
}

@Injectable()
export class YoutubeService {
  private readonly logger = new Logger(YoutubeService.name);

  async search(query: string, count = 5): Promise<YoutubeCandidate[]> {
    const { stdout } = await execFileAsync('yt-dlp', [
      `ytsearch${count}:${query}`,
      '--dump-json',
      '--no-playlist',
      '--skip-download',
      '--no-warnings',
    ], { maxBuffer: 1024 * 1024 * 20 });

    return stdout
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        const data = JSON.parse(line);
        return {
          videoId: data.id,
          title: data.title,
          uploader: data.uploader ?? data.channel ?? '',
          durationSec: data.duration ?? null,
        } satisfies YoutubeCandidate;
      });
  }

  async download(
    videoId: string,
    destDir: string,
    artist: string,
    title: string,
  ): Promise<string> {
    await fs.mkdir(destDir, { recursive: true });
    const safeArtist = sanitizeForFilename(artist);
    const safeTitle = sanitizeForFilename(title);
    const outputTemplate = path.join(destDir, `${safeArtist} - ${safeTitle}.%(ext)s`);

    await execFileAsync('yt-dlp', [
      `https://www.youtube.com/watch?v=${videoId}`,
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', '0',
      '-o', outputTemplate,
      '--postprocessor-args',
      `ffmpeg:-metadata artist=${shlexQuote(artist)} -metadata title=${shlexQuote(title)}`,
      '--no-warnings',
    ], { maxBuffer: 1024 * 1024 * 20 });

    return path.join(destDir, `${safeArtist} - ${safeTitle}.mp3`);
  }
}

function sanitizeForFilename(value: string): string {
  return value.replace(/[/\\?%*:|"<>]/g, '_').trim();
}

function shlexQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}
