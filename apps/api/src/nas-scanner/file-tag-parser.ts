import { parseFile } from 'music-metadata';
import { normalize } from '../common/normalize';

export const AUDIO_EXTENSIONS = ['.flac', '.mp3', '.m4a', '.ogg', '.opus', '.wav', '.aac'];

export interface ParsedFileInfo {
  artist: string;
  title: string;
  album?: string;
  normalizedArtist: string;
  normalizedTitle: string;
}

export async function parseFileInfo(filePath: string, filename: string): Promise<ParsedFileInfo | null> {
  let artist: string | undefined;
  let title: string | undefined;
  let album: string | undefined;

  try {
    const meta = await parseFile(filePath, { duration: false, skipCovers: true });
    artist = meta.common.artist ?? meta.common.albumartist;
    title = meta.common.title;
    album = meta.common.album;
  } catch {
    // fall through to filename parsing
  }

  if (!artist || !title) {
    const fromName = parseFilename(filename);
    artist = artist ?? fromName?.artist;
    title = title ?? fromName?.title;
  }

  if (!artist || !title) return null;

  return {
    artist,
    title,
    album,
    normalizedArtist: normalize(artist),
    normalizedTitle: normalize(title),
  };
}

// Expects "Artist - Album - 01 - Title.ext" or "Artist - Title.ext"
function parseFilename(filename: string): { artist: string; title: string } | null {
  const withoutExt = filename.replace(/\.[^.]+$/, '');
  const parts = withoutExt.split(' - ').map((p) => p.trim());

  if (parts.length >= 3) {
    const artist = parts[0];
    const title = parts[parts.length - 1].replace(/^\d+\s*/, '');
    if (artist && title) return { artist, title };
  }
  if (parts.length === 2) {
    return { artist: parts[0], title: parts[1] };
  }
  return null;
}
