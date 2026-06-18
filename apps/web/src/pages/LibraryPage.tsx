import { useCallback, useEffect, useState } from 'react';
import { api, type LibraryEntry } from '../api';

type SourceFilter = 'all' | 'nas' | 'azuracast';

export default function LibraryPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LibraryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<SourceFilter>('all');

  const doSearch = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      setResults(await api.searchLibrary(q || undefined));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { doSearch(''); }, [doSearch]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    doSearch(query);
  }

  const filtered = filter === 'all' ? results : results.filter((r) => r.source === filter);
  const nasCount = results.filter((r) => r.source === 'nas').length;
  const azCount = results.filter((r) => r.source === 'azuracast').length;

  return (
    <div>
      <h1>Library</h1>

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search artist or title…"
          style={{ flex: 1 }}
        />
        <button type="submit">Search</button>
        {query && (
          <button type="button" onClick={() => { setQuery(''); doSearch(''); }}>Clear</button>
        )}
      </form>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
        <div className="btn-row" style={{ gap: 4 }}>
          {(['all', 'nas', 'azuracast'] as SourceFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              className={filter === f ? 'btn-primary btn-sm' : 'btn-sm'}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? `All (${results.length})` : f === 'nas' ? `NAS (${nasCount})` : `Azuracast (${azCount})`}
            </button>
          ))}
        </div>
        {!loading && results.length >= 200 && (
          <span className="meta" style={{ marginBottom: 0 }}>
            Showing up to 200 per source — refine your search
          </span>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <p className="meta">Searching…</p>}

      {!loading && filtered.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 100 }}>Source</th>
                <th>Artist</th>
                <th>Title</th>
                <th>Album</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={`${r.source}-${r.id}`}>
                  <td>
                    <SourceBadgeWithTooltip entry={r} />
                  </td>
                  <td style={{ color: 'var(--text-heading)' }}>{r.artist}</td>
                  <td>{r.title}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{r.album ?? '—'}</td>
                  <td style={{ textAlign: 'right', width: 90 }}>
                    {r.source === 'nas' && (
                      <a href={api.nasDownloadUrl(r.id)} download={r.filename ?? undefined}>
                        <button type="button" className="btn-sm">Download</button>
                      </a>
                    )}
                    {r.source === 'azuracast' && r.uniqueId && (
                      <a href={api.azuracastDownloadUrl(r.id)} download>
                        <button type="button" className="btn-sm">Download</button>
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && filtered.length === 0 && results.length > 0 && (
        <p className="meta">No {filter} entries. Try a different filter.</p>
      )}

      {!loading && results.length === 0 && (
        <p className="meta">No results. Try scanning your NAS or polling Azuracast in Settings.</p>
      )}
    </div>
  );
}

function SourceBadgeWithTooltip({ entry }: { entry: LibraryEntry }) {
  const isNas = entry.source === 'nas';
  let tooltip: string;
  if (isNas) {
    tooltip = entry.path ?? entry.filename ?? 'NAS file';
  } else {
    const parts: string[] = [];
    if (entry.stationId) parts.push(`Station: ${entry.stationId}`);
    if (entry.path) parts.push(`Path: ${entry.path}`);
    tooltip = parts.length > 0 ? parts.join('\n') : 'Azuracast';
  }

  return (
    <span
      className={`badge ${isNas ? 'badge-nas' : 'badge-azuracast'}`}
      title={tooltip}
      style={{ cursor: 'default' }}
    >
      {isNas ? 'NAS' : 'Azuracast'}
    </span>
  );
}
