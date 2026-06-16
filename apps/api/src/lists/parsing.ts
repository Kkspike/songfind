import { parse } from 'csv-parse/sync';

export interface ParsedEntry {
  artist: string;
  title: string;
}

const LINE_SEPARATORS = [' - ', ' – ', ' — ', '\t'];

export function parseTextList(text: string): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    let split: [string, string] | null = null;
    for (const sep of LINE_SEPARATORS) {
      const idx = line.indexOf(sep);
      if (idx > 0) {
        split = [line.slice(0, idx).trim(), line.slice(idx + sep.length).trim()];
        break;
      }
    }
    if (!split) continue;

    const [artist, title] = split;
    if (artist && title) entries.push({ artist, title });
  }
  return entries;
}

export function parseCsvBuffer(buffer: Buffer): ParsedEntry[] {
  const rows: Record<string, string>[] = parse(buffer, {
    columns: (header: string[]) => header.map((h) => h.trim().toLowerCase()),
    skip_empty_lines: true,
    trim: true,
  });

  const entries: ParsedEntry[] = [];
  for (const row of rows) {
    const artist = row['artist'] ?? Object.values(row)[0];
    const title = row['title'] ?? row['song'] ?? row['track'] ?? Object.values(row)[1];
    if (artist && title) entries.push({ artist: artist.trim(), title: title.trim() });
  }
  return entries;
}
