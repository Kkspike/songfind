import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type SongListDetail } from '../api';
import { StatusBadge } from '../components/Badge';

export default function ListDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [list, setList] = useState<SongListDetail | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
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
    try {
      await api.acquireTrack(trackId);
      refresh();
    } catch (e) { setError(String(e)); }
    finally { setBusy((b) => ({ ...b, [trackId]: false })); }
  }

  async function handleCheckStatus(trackId: string) {
    setBusy((b) => ({ ...b, [trackId]: true }));
    try {
      await api.checkTrackStatus(trackId);
      refresh();
    } catch (e) { setError(String(e)); }
    finally { setBusy((b) => ({ ...b, [trackId]: false })); }
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
        <h2 style={{ marginBottom: 0, textTransform: 'none', letterSpacing: 0, fontSize: 15 }}>
          Tracks <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({list.items.length})</span>
        </h2>
        <div className="btn-row">
          <a href={api.exportZipUrl(list.id)}>
            <button type="button">Export zip</button>
          </a>
        </div>
      </div>

      {list.items.length === 0 ? (
        <p className="meta">No tracks yet — import some above.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }}>#</th>
                <th>Artist</th>
                <th>Title</th>
                <th>Status</th>
                <th style={{ width: 180 }}></th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((item) => (
                <tr key={item.id}>
                  <td style={{ color: 'var(--text-muted)' }}>{item.position}</td>
                  <td style={{ color: 'var(--text-heading)' }}>{item.track.artist.name}</td>
                  <td>{item.track.title}</td>
                  <td><StatusBadge status={item.track.status} /></td>
                  <td>
                    {item.track.status === 'missing' && (
                      <button
                        className="btn-sm btn-primary"
                        onClick={() => handleAcquire(item.track.id)}
                        disabled={busy[item.track.id]}
                      >
                        {busy[item.track.id] ? 'Starting…' : 'Acquire'}
                      </button>
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
