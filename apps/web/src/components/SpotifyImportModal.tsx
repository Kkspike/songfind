import { useEffect, useState } from 'react';
import { api, type SpotifyPlaylist } from '../api';

interface Props {
  onClose: (newListId?: string) => void;
}

export default function SpotifyImportModal({ onClose }: Props) {
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [importing, setImporting] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    api.getSpotifyPlaylists()
      .then(setPlaylists)
      .catch((e) => setLoadError(String(e)));
  }, []);

  async function doImport(key: string, fn: () => ReturnType<typeof api.importSpotifyLikedSongs>) {
    setImporting(key);
    setImportError(null);
    try {
      const result = await fn();
      onClose(result.listId);
    } catch (e) {
      setImportError(String(e));
      setImporting(null);
    }
  }

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Import from Spotify</h2>
          <button
            type="button"
            onClick={() => onClose()}
            style={{ background: 'none', border: 'none', fontSize: 22, lineHeight: 1, cursor: 'pointer', color: 'var(--text-muted)', padding: '0 4px' }}
          >
            ✕
          </button>
        </div>

        {importError && <div className="alert alert-error" style={{ marginBottom: 16 }}>{importError}</div>}

        {loadError && (
          <div className="alert alert-error">
            {loadError.includes('not authorized')
              ? 'Spotify is not connected. Go to Settings to connect your account.'
              : loadError}
          </div>
        )}

        {!playlists && !loadError && <p className="meta">Loading…</p>}

        {playlists && (
          <>
            <div style={{ marginBottom: 20 }}>
              <button
                type="button"
                className="btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                disabled={!!importing}
                onClick={() => doImport('liked', api.importSpotifyLikedSongs)}
              >
                {importing === 'liked' ? 'Importing…' : 'Import Liked Songs'}
              </button>
            </div>

            {playlists.length > 0 && (
              <>
                <p style={{ fontWeight: 600, marginBottom: 10, color: 'var(--text-heading)', fontSize: 14 }}>
                  Your Playlists
                </p>
                <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {playlists.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      disabled={!!importing}
                      onClick={() => doImport(p.id, () => api.importSpotifyPlaylist(p.id))}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        textAlign: 'left', padding: '8px 12px', borderRadius: 6,
                        background: importing === p.id ? 'var(--bg-hover)' : 'var(--bg-row)',
                        border: '1px solid var(--border)',
                        cursor: importing ? 'not-allowed' : 'pointer',
                        opacity: importing && importing !== p.id ? 0.5 : 1,
                      }}
                    >
                      <span style={{ color: 'var(--text-heading)', fontWeight: 500 }}>
                        {importing === p.id ? 'Importing…' : p.name}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 12, flexShrink: 0 }}>
                        {p.trackCount} tracks
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {playlists.length === 0 && (
              <p className="meta">No playlists found on your account.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.55)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 100,
};

const modalStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  borderRadius: 10,
  padding: 28,
  width: '100%',
  maxWidth: 480,
  maxHeight: '80vh',
  overflowY: 'auto',
  boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
};
