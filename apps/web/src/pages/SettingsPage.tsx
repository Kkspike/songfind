import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Settings, type TestResult } from '../api';

type FormState = Partial<Settings>;

export default function SettingsPage() {
  const [form, setForm] = useState<FormState | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult | 'loading'>>({});

  useEffect(() => {
    api.getSettings().then(setForm).catch((e) => setError(String(e)));
  }, []);

  function field(name: keyof FormState) {
    return {
      value: (form?.[name] as string | number | null) ?? '',
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((f) => ({ ...f, [name]: e.target.value })),
    };
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    try {
      const { spotifyConnected, id, ...dto } = form;
      const updated = await api.updateSettings(dto);
      setForm(updated);
      setStatus('Saved.');
    } catch (e) {
      setError(String(e));
    }
  }

  async function testConnection(key: string, fn: () => Promise<TestResult>) {
    setTestResults((prev) => ({ ...prev, [key]: 'loading' }));
    try {
      const result = await fn();
      setTestResults((prev) => ({ ...prev, [key]: result }));
    } catch (e) {
      setTestResults((prev) => ({ ...prev, [key]: { ok: false, message: String(e) } }));
    }
  }

  function TestBadge({ name }: { name: string }) {
    const r = testResults[name];
    if (!r) return null;
    if (r === 'loading') return <span style={{ marginLeft: 8, color: '#888' }}>Testing…</span>;
    return (
      <span style={{ marginLeft: 8, color: r.ok ? 'green' : 'red', fontSize: 13 }}>
        {r.ok ? '✓' : '✗'} {r.message}
      </span>
    );
  }

  async function runTrigger(label: string, fn: () => Promise<unknown>) {
    setStatus(`Running ${label}…`);
    setError(null);
    try {
      const result = await fn();
      setStatus(`${label} done: ${JSON.stringify(result)}`);
    } catch (e) {
      setError(String(e));
    }
  }

  if (!form) return <p>Loading…</p>;

  return (
    <div>
      <p>
        <Link to="/">&larr; Back to lists</Link>
      </p>
      <h1>Settings</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {status && <p>{status}</p>}

      <form onSubmit={handleSave}>
        <h2>Lidarr / Prowlarr</h2>
        <label>Lidarr URL <input {...field('lidarrUrl')} /></label>
        <br />
        <label>Lidarr API Key <input {...field('lidarrApiKey')} /></label>
        <br />
        <button type="button" onClick={() => testConnection('lidarr', api.testLidarr)}>
          Test Lidarr
        </button>
        <TestBadge name="lidarr" />
        <br /><br />
        <label>Prowlarr URL <input {...field('prowlarrUrl')} /></label>
        <br />
        <label>Prowlarr API Key <input {...field('prowlarrApiKey')} /></label>
        <br />
        <button type="button" onClick={() => testConnection('prowlarr', api.testProwlarr)}>
          Test Prowlarr
        </button>
        <TestBadge name="prowlarr" />

        <h2>Azuracast</h2>
        <label>Azuracast URL <input {...field('azuracastUrl')} /></label>
        <br />
        <label>Azuracast API Key <input {...field('azuracastApiKey')} /></label>
        <br />
        <label>Station IDs (comma-separated) <input {...field('azuracastStationIds')} /></label>
        <br />
        <button type="button" onClick={() => testConnection('azuracast', api.testAzuracast)}>
          Test Azuracast
        </button>
        <TestBadge name="azuracast" />

        <h2>NAS</h2>
        <label>NAS mount path <input {...field('nasMountPath')} /></label>

        <h2>Spotify</h2>
        <p>Status: {form.spotifyConnected ? 'Connected' : 'Not connected'}</p>
        <label>Client ID <input {...field('spotifyClientId')} /></label>
        <br />
        <label>Client Secret <input {...field('spotifyClientSecret')} /></label>
        <br />
        <label>Redirect URI <input {...field('spotifyRedirectUri')} /></label>
        <br />
        <a href={api.spotifyLoginUrl()}>
          <button type="button">Connect Spotify</button>
        </a>

        <h2>Acquisition</h2>
        <label>Fallback timeout (minutes) <input type="number" {...field('fallbackTimeoutMins')} /></label>

        <div>
          <button type="submit">Save settings</button>
        </div>
      </form>

      <h2>Manual actions</h2>
      <button type="button" onClick={() => runTrigger('NAS scan', api.triggerNasScan)}>
        Scan NAS now
      </button>{' '}
      <button type="button" onClick={() => runTrigger('Azuracast poll', api.triggerAzuracastPoll)}>
        Poll Azuracast now
      </button>{' '}
      <button
        type="button"
        onClick={() => runTrigger('Acquisition timeout check', api.triggerAcquisitionTimeoutCheck)}
      >
        Check acquisition timeouts
      </button>
    </div>
  );
}
