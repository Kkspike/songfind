import { useCallback, useEffect, useState } from 'react';
import { api, type LibraryEntry } from '../api';

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

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search artist or title…"
          style={{ flexGrow: 1 }}
        />
        <button type="submit">Search</button>
        {query && (
          <button type="button" onClick={() => { setQuery(''); doSearch(''); }}>
            Clear
          </button>
        )}
      </form>

      {error && <p style={{ color: 'red' }}>{error}</p>}
      {loading && <p>Loading…</p>}

      {!loading && (
        <p style={{ color: '#888', marginBottom: 8 }}>
          {results.length} result{results.length !== 1 ? 's' : ''} — {nasCount} on NAS,{' '}
          {azCount} on Azuracast
          {results.length === 200 && ' (showing first 200 per source — refine your search)'}
        </p>
      )}

      {!loading && results.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={th}>Source</th>
              <th style={th}>Artist</th>
              <th style={th}>Title</th>
              <th style={th}>Album</th>
              <th style={th}>File / Station</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={`${r.source}-${r.id}`} style={{ borderTop: '1px solid #eee' }}>
                <td style={td}>
                  <span
                    style={{
                      background: r.source === 'nas' ? '#d1e7dd' : '#cfe2ff',
                      color: r.source === 'nas' ? '#0a3622' : '#084298',
                      padding: '2px 6px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {r.source === 'nas' ? 'NAS' : 'Azuracast'}
                  </span>
                </td>
                <td style={td}>{r.artist}</td>
                <td style={td}>{r.title}</td>
                <td style={{ ...td, color: '#666' }}>{r.album ?? '—'}</td>
                <td style={{ ...td, color: '#888', fontSize: 12 }}>
                  {r.filename ?? (r.stationId ? `Station: ${r.stationId}` : '—')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!loading && results.length === 0 && (
        <p>No results. Try scanning your NAS or polling Azuracast in Settings.</p>
      )}
    </div>
  );
}

const th: React.CSSProperties = { textAlign: 'left', padding: '6px 8px', fontWeight: 600 };
const td: React.CSSProperties = { padding: '5px 8px' };
