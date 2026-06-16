import { useCallback, useEffect, useState } from 'react';
import { api, type LibraryEntry } from '../api';
import { SourceBadge } from '../components/Badge';

export default function LibraryPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LibraryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const nasCount = results.filter((r) => r.source === 'nas').length;
  const azCount = results.filter((r) => r.source === 'azuracast').length;

  return (
    <div>
      <h1>Library</h1>

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
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

      {error && <div className="alert alert-error">{error}</div>}

      {!loading && (
        <p className="meta">
          {results.length} result{results.length !== 1 ? 's' : ''} — {nasCount} on NAS, {azCount} on Azuracast
          {results.length >= 200 && ' (showing up to 200 per source — refine your search to narrow down)'}
        </p>
      )}
      {loading && <p className="meta">Searching…</p>}

      {!loading && results.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Source</th>
                <th>Artist</th>
                <th>Title</th>
                <th>Album</th>
                <th>File / Station</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={`${r.source}-${r.id}`}>
                  <td><SourceBadge source={r.source} /></td>
                  <td style={{ color: 'var(--text-heading)' }}>{r.artist}</td>
                  <td>{r.title}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{r.album ?? '—'}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    {r.filename ?? (r.stationId ? `Station: ${r.stationId}` : '—')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && results.length === 0 && (
        <p className="meta">No results. Try scanning your NAS or polling Azuracast in Settings.</p>
      )}
    </div>
  );
}
