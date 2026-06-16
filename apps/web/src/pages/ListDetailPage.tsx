import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type SongListDetail } from '../api';

export default function ListDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [list, setList] = useState<SongListDetail | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const requestSeq = useRef(0);

  function refresh() {
    if (!id) return;
    const seq = ++requestSeq.current;
    api
      .getList(id)
      .then((data) => {
        if (seq === requestSeq.current) setList(data);
      })
      .catch((e) => {
        if (seq === requestSeq.current) setError(String(e));
      });
  }

  useEffect(refresh, [id]);

  async function handlePasteImport(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !pastedText.trim()) return;
    try {
      const result = await api.importText(id, pastedText);
      setImportSummary(`Parsed ${result.parsed}, added ${result.added}, skipped ${result.skipped}`);
      setPastedText('');
      refresh();
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleCsvImport(e: React.ChangeEvent<HTMLInputElement>) {
    if (!id) return;
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await api.importCsv(id, file);
      setImportSummary(`Parsed ${result.parsed}, added ${result.added}, skipped ${result.skipped}`);
      refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleRemoveItem(itemId: string) {
    if (!id) return;
    await api.removeItem(id, itemId);
    refresh();
  }

  if (!list) return <p>Loading…</p>;

  return (
    <div>
      <p>
        <Link to="/">&larr; Back to lists</Link>
      </p>
      <h1>{list.name}</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {importSummary && <p>{importSummary}</p>}

      <section>
        <h2>Import</h2>
        <form onSubmit={handlePasteImport}>
          <textarea
            rows={6}
            cols={50}
            placeholder={'Artist - Title\nArtist - Title'}
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
          />
          <div>
            <button type="submit">Import pasted list</button>
          </div>
        </form>
        <div>
          <label>
            Or upload CSV (artist,title columns):{' '}
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleCsvImport} />
          </label>
        </div>
      </section>

      <section>
        <h2>Tracks ({list.items.length})</h2>
        <a href={api.exportZipUrl(list.id)}>
          <button type="button">Export zip</button>
        </a>
        <table>
          <thead>
            <tr>
              <th>Artist</th>
              <th>Title</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.items.map((item) => (
              <tr key={item.id}>
                <td>{item.track.artist.name}</td>
                <td>{item.track.title}</td>
                <td>{item.track.status}</td>
                <td>
                  <button onClick={() => handleRemoveItem(item.id)}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
