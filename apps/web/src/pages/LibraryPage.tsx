import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type LibraryEntry } from '../api';

type SourceFilter = 'all' | 'nas' | 'azuracast';
type SortKey = 'artist' | 'title' | 'album';
type SortOrder = 'asc' | 'desc';

const PAGE_SIZE = 50;

export default function LibraryPage() {
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<SourceFilter>('all');
  const [sort, setSort] = useState<SortKey>('artist');
  const [order, setOrder] = useState<SortOrder>('asc');
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<LibraryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ nasCount: number; azuracastCount: number } | null>(null);

  const fetchSeq = useRef(0);

  const doFetch = useCallback(async (
    q: string, src: SourceFilter, pg: number, sk: SortKey, so: SortOrder,
  ) => {
    const seq = ++fetchSeq.current;
    setLoading(true);
    setError(null);
    try {
      const res = await api.searchLibrary({ q: q || undefined, source: src, page: pg, pageSize: PAGE_SIZE, sort: sk, order: so });
      if (seq !== fetchSeq.current) return;
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      if (seq !== fetchSeq.current) return;
      setError(String(e));
    } finally {
      if (seq === fetchSeq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    api.getLibraryStats().then(setStats).catch(() => {});
  }, []);

  useEffect(() => { doFetch(query, source, page, sort, order); }, [source, page, sort, order]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    doFetch(query, source, 1, sort, order);
  }

  function handleClear() {
    setQuery('');
    setPage(1);
    doFetch('', source, 1, sort, order);
  }

  function handleSource(s: SourceFilter) {
    setSource(s);
    setPage(1);
  }

  function handleSort(key: SortKey) {
    if (sort === key) {
      setOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSort(key);
      setOrder('asc');
    }
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function SortHeader({ col, label }: { col: SortKey; label: string }) {
    const active = sort === col;
    return (
      <th
        style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
        onClick={() => handleSort(col)}
      >
        {label} {active ? (order === 'asc' ? '↑' : '↓') : <span style={{ opacity: 0.3 }}>↕</span>}
      </th>
    );
  }

  const fmt = (n: number) => n.toLocaleString();

  return (
    <div>
      <h1>Library</h1>

      {stats && (
        <div style={{ display: 'flex', gap: 24, marginBottom: 16, fontSize: 13, color: 'var(--text-muted)' }}>
          <span>NAS <strong style={{ color: 'var(--text-heading)' }}>{fmt(stats.nasCount)}</strong></span>
          <span>Azuracast <strong style={{ color: 'var(--text-heading)' }}>{fmt(stats.azuracastCount)}</strong></span>
          <span>Total <strong style={{ color: 'var(--text-heading)' }}>{fmt(stats.nasCount + stats.azuracastCount)}</strong></span>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search artist or title…"
          style={{ flex: 1 }}
        />
        <button type="submit">Search</button>
        {query && <button type="button" onClick={handleClear}>Clear</button>}
      </form>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
        <div className="btn-row" style={{ gap: 4 }}>
          {([
            { key: 'all', label: stats ? `All (${fmt(stats.nasCount + stats.azuracastCount)})` : 'All' },
            { key: 'nas', label: stats ? `NAS (${fmt(stats.nasCount)})` : 'NAS' },
            { key: 'azuracast', label: stats ? `Azuracast (${fmt(stats.azuracastCount)})` : 'Azuracast' },
          ] as { key: SourceFilter; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={source === key ? 'btn-primary btn-sm' : 'btn-sm'}
              onClick={() => handleSource(key)}
            >
              {label}
            </button>
          ))}
        </div>
        {!loading && total > 0 && (
          <span className="meta" style={{ marginBottom: 0 }}>
            {fmt(total)} result{total !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <p className="meta">Loading…</p>}

      {!loading && items.length > 0 && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 100 }}>Source</th>
                  <SortHeader col="artist" label="Artist" />
                  <SortHeader col="title" label="Title" />
                  <SortHeader col="album" label="Album" />
                  <th style={{ width: 130 }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => {
                  const streamUrl = r.source === 'nas'
                    ? api.nasStreamUrl(r.id)
                    : r.uniqueId ? api.azuracastStreamUrl(r.id) : null;
                  const downloadUrl = r.source === 'nas'
                    ? api.nasDownloadUrl(r.id)
                    : r.uniqueId ? api.azuracastDownloadUrl(r.id) : null;
                  return (
                    <tr key={`${r.source}-${r.id}`}>
                      <td><SourceBadgeWithTooltip entry={r} /></td>
                      <td style={{ color: 'var(--text-heading)' }}>{r.artist}</td>
                      <td>{r.title}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{r.album ?? '—'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                          {streamUrl && <PlayButton url={streamUrl} />}
                          {downloadUrl && (
                            <a href={downloadUrl} download={r.filename ?? undefined}>
                              <button type="button" className="btn-sm">↓</button>
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
              <button type="button" className="btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
              <span className="meta" style={{ marginBottom: 0 }}>Page {page} / {totalPages}</span>
              <button type="button" className="btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next →</button>
            </div>
          )}
        </>
      )}

      {!loading && items.length === 0 && total === 0 && (
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
    <span className={`badge ${isNas ? 'badge-nas' : 'badge-azuracast'}`} title={tooltip} style={{ cursor: 'default' }}>
      {isNas ? 'NAS' : 'Azuracast'}
    </span>
  );
}

function PlayButton({ url }: { url: string }) {
  const [open, setOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  function toggle() {
    if (!open) {
      setOpen(true);
      // autoplay after mount — give React a tick to render the element
      setTimeout(() => audioRef.current?.play(), 0);
    } else {
      audioRef.current?.pause();
      setOpen(false);
    }
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <button type="button" className="btn-sm" onClick={toggle} title={open ? 'Stop' : 'Play'}>
        {open ? '⏹' : '▶'}
      </button>
      {open && (
        <audio
          ref={audioRef}
          src={url}
          controls
          onEnded={() => setOpen(false)}
          style={{ height: 28, width: 180, verticalAlign: 'middle' }}
        />
      )}
    </span>
  );
}
