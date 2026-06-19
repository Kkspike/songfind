import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type SongListDetail, type SongListItem } from '../api';
import { StatusBadge } from '../components/Badge';

function PlayButton({ url }: { url: string }) {
  const [open, setOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  function toggle() {
    if (!open) {
      setOpen(true);
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
          style={{ height: 28, width: 160, verticalAlign: 'middle' }}
        />
      )}
    </span>
  );
}

type SortKey = 'position' | 'artist' | 'title' | 'status';
type SortOrder = 'asc' | 'desc';

export default function ListDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [list, setList] = useState<SongListDetail | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [acquireErrors, setAcquireErrors] = useState<Record<string, string>>({});
  const [acquireAll, setAcquireAll] = useState<{ done: number; total: number } | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('position');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [includeAzuracast, setIncludeAzuracast] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const requestSeq = useRef(0);

  function refresh() {
    if (!id) return;
    const seq = ++requestSeq.current;
    api
      .getList(id)
      .then((data) => { if (seq === requestSeq.current) setList(data); })
      .catch((e) => { if (seq === requestSeq.current) setError(String(e)); });
  }

  useEffect(refresh, [id]);

  async function handlePasteImport(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !pastedText.trim()) return;
    try {
      const result = await api.importText(id, pastedText);
      setImportSummary(`Parsed ${result.parsed} · Added ${result.added} · Skipped ${result.skipped}`);
      setPastedText('');
      refresh();
    } catch (e) { setError(String(e)); }
  }

  async function handleCsvImport(e: React.ChangeEvent<HTMLInputElement>) {
    if (!id) return;
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await api.importCsv(id, file);
      setImportSummary(`Parsed ${result.parsed} · Added ${result.added} · Skipped ${result.skipped}`);
      refresh();
    } catch (e) { setError(String(e)); }
    finally { if (fileInputRef.current) fileInputRef.current.value = ''; }
  }

  async function handleRemoveItem(itemId: string) {
    if (!id) return;
    await api.removeItem(id, itemId);
    refresh();
  }

  async function handleAcquire(trackId: string) {
    setBusy((b) => ({ ...b, [trackId]: true }));
    setAcquireErrors((e) => { const next = { ...e }; delete next[trackId]; return next; });
    try {
      const result = await api.acquireTrack(trackId);
      if (result.status === 'failed') {
        const msg = result.attempts?.[0]?.message ?? 'Acquisition failed';
        setAcquireErrors((e) => ({ ...e, [trackId]: msg }));
      }
      refresh();
    } catch (e) { setError(String(e)); }
    finally { setBusy((b) => ({ ...b, [trackId]: false })); }
  }

  async function handleAcquireAll() {
    if (!list) return;
    const missing = list.items.filter((i) => i.track.status === 'missing');
    if (!missing.length) return;
    setAcquireAll({ done: 0, total: missing.length });
    for (const item of missing) {
      try { await api.acquireTrack(item.track.id); } catch { /* keep going */ }
      setAcquireAll((p) => p ? { ...p, done: p.done + 1 } : null);
    }
    refresh();
    setAcquireAll(null);
  }

  async function handleCheckStatus(trackId: string) {
    setBusy((b) => ({ ...b, [trackId]: true }));
    try {
      await api.checkTrackStatus(trackId);
      refresh();
    } catch (e) { setError(String(e)); }
    finally { setBusy((b) => ({ ...b, [trackId]: false })); }
  }

  const sortedItems = useMemo<SongListItem[]>(() => {
    if (!list) return [];
    return [...list.items].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'position') cmp = a.position - b.position;
      else if (sortKey === 'artist') cmp = a.track.artist.name.localeCompare(b.track.artist.name);
      else if (sortKey === 'title') cmp = a.track.title.localeCompare(b.track.title);
      else if (sortKey === 'status') cmp = a.track.status.localeCompare(b.track.status);
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [list, sortKey, sortOrder]);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortOrder('asc'); }
  }

  function SortTh({ col, label, width }: { col: SortKey; label: string; width?: number }) {
    const active = sortKey === col;
    return (
      <th style={{ cursor: 'pointer', userSelect: 'none', width }} onClick={() => handleSort(col)}>
        {label} {active ? (sortOrder === 'asc' ? '↑' : '↓') : <span style={{ opacity: 0.3 }}>↕</span>}
      </th>
    );
  }

  if (!list) return <p className="meta">Loading…</p>;

  return (
    <div>
      <Link to="/" className="back-link">← Back to lists</Link>
      <h1>{list.name}</h1>

      {error && <div className="alert alert-error">{error}</div>}
      {importSummary && <div className="alert alert-success">{importSummary}</div>}

      <div className="card">
        <h2>Import</h2>
        <form onSubmit={handlePasteImport} style={{ marginBottom: 16 }}>
          <textarea
            rows={5}
            placeholder={'Artist - Title\nArtist - Title\n…'}
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            style={{ marginBottom: 10 }}
          />
          <button type="submit" className="btn-primary">Import pasted list</button>
        </form>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Or upload a CSV file (columns: artist, title):&nbsp;
          <input ref={fileInputRef} type="file" accept=".csv" onChange={handleCsvImport} />
        </div>
      </div>

      <div className="section-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ marginBottom: 0, textTransform: 'none', letterSpacing: 0, fontSize: 15 }}>
            Tracks <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({list.items.length})</span>
          </h2>
          {list.items.some((i) => i.track.status === 'missing') && (
            <button
              type="button"
              className="btn-primary"
              onClick={handleAcquireAll}
              disabled={!!acquireAll}
            >
              {acquireAll
                ? `Acquiring ${acquireAll.done}/${acquireAll.total}…`
                : `Acquire all missing (${list.items.filter((i) => i.track.status === 'missing').length})`}
            </button>
          )}
        </div>
        <div className="btn-row">
          {(() => {
            const ownedCount = list.items.filter((i) => i.track.status === 'owned').length;
            const azCount = list.items.filter((i) => i.track.status === 'available_on_azuracast').length;
            const exportCount = ownedCount + (includeAzuracast ? azCount : 0);
            const label = includeAzuracast
              ? `Export zip (${ownedCount} NAS + ${azCount} Azuracast)`
              : `Export zip (${ownedCount} owned)`;
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={includeAzuracast}
                    onChange={(e) => setIncludeAzuracast(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  Include Azuracast
                </label>
                <a href={api.exportZipUrl(list.id, includeAzuracast)} title={exportCount === 0 ? 'No exportable tracks in this list' : undefined}>
                  <button type="button" disabled={exportCount === 0}>{label}</button>
                </a>
              </div>
            );
          })()}
        </div>
      </div>

      {list.items.length === 0 ? (
        <p className="meta">No tracks yet — import some above.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <SortTh col="position" label="#" width={36} />
                <SortTh col="artist" label="Artist" />
                <SortTh col="title" label="Title" />
                <SortTh col="status" label="Status" />
                <th style={{ width: 180 }}></th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item) => (
                <tr key={item.id}>
                  <td style={{ color: 'var(--text-muted)' }}>{item.position}</td>
                  <td style={{ color: 'var(--text-heading)' }}>{item.track.artist.name}</td>
                  <td>{item.track.title}</td>
                  <td><StatusBadge status={item.track.status} /></td>
                  <td>
                    {item.track.status === 'missing' && (
                      <div>
                        <button
                          className="btn-sm btn-primary"
                          onClick={() => handleAcquire(item.track.id)}
                          disabled={busy[item.track.id]}
                        >
                          {busy[item.track.id] ? 'Starting…' : 'Acquire'}
                        </button>
                        {acquireErrors[item.track.id] && (
                          <div style={{ color: 'var(--red, #e05)', fontSize: 11, marginTop: 4, maxWidth: 180 }}>
                            {acquireErrors[item.track.id]}
                          </div>
                        )}
                      </div>
                    )}
                    {item.track.status === 'acquiring' && (
                      <button
                        className="btn-sm"
                        onClick={() => handleCheckStatus(item.track.id)}
                        disabled={busy[item.track.id]}
                      >
                        {busy[item.track.id] ? 'Checking…' : 'Check status'}
                      </button>
                    )}
                    {item.track.status === 'owned' && item.track.libraryFiles[0] && (
                      <PlayButton url={api.nasStreamUrl(item.track.libraryFiles[0].id)} />
                    )}
                    {item.track.status === 'available_on_azuracast' && item.track.azuracastTracks[0] && (
                      <PlayButton url={api.azuracastStreamUrl(item.track.azuracastTracks[0].id)} />
                    )}
                    {item.track.status === 'needs_approval' && (
                      <Link to="/activity" style={{ fontSize: 13 }}>
                        Review YouTube candidates →
                      </Link>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn-danger btn-sm" onClick={() => handleRemoveItem(item.id)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
