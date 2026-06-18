import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, type ListSummary } from '../api';
import SpotifyImportModal from '../components/SpotifyImportModal';

export default function ListsPage() {
  const navigate = useNavigate();
  const [lists, setLists] = useState<ListSummary[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showSpotifyModal, setShowSpotifyModal] = useState(false);

  function refresh() {
    api.getLists().then(setLists).catch((e) => setError(String(e)));
  }

  useEffect(refresh, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api.createList(name.trim());
      setName('');
      refresh();
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleDelete(id: string) {
    await api.deleteList(id);
    refresh();
  }

  function handleSpotifyClose(newListId?: string) {
    setShowSpotifyModal(false);
    if (newListId) navigate(`/lists/${newListId}`);
  }

  return (
    <div>
      {showSpotifyModal && <SpotifyImportModal onClose={handleSpotifyClose} />}

      <h1>Lists</h1>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card" style={{ marginBottom: 24 }}>
        <form onSubmit={handleCreate} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New list name…"
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn-primary">Create list</button>
        </form>
        <div>
          <button type="button" onClick={() => setShowSpotifyModal(true)} style={{ background: '#1DB954', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 16px', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
            Import from Spotify
          </button>
        </div>
      </div>

      {lists.length === 0 ? (
        <p className="meta">No lists yet. Create one above.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Tracks</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lists.map((list) => (
                <tr key={list.id}>
                  <td>
                    <Link to={`/lists/${list.id}`} style={{ color: 'var(--text-heading)', fontWeight: 500 }}>
                      {list.name}
                    </Link>
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{list.itemCount}</td>
                  <td style={{ color: 'var(--text-muted)' }}>
                    {new Date(list.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn-danger" onClick={() => handleDelete(list.id)}>
                      Delete
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
