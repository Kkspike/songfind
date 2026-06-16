export function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/\(feat\.?[^)]*\)/g, '')
    .replace(/\(remaster(ed)?[^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
