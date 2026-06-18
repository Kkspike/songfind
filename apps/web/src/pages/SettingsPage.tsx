import { useEffect, useState } from 'react';
import { api, type Settings, type TestResult } from '../api';

type FormState = Partial<Settings>;

export default function SettingsPage() {
  const [form, setForm] = useState<FormState | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [saveMsg, setSaveMsg] = useState('');
  const [testResults, setTestResults] = useState<Record<string, TestResult | 'loading'>>({});
  const [triggerStatus, setTriggerStatus] = useState<string | null>(null);

  useEffect(() => {
    api.getSettings().then(setForm).catch((e) => setSaveMsg(String(e)));
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
      setSaveStatus('saved');
      setSaveMsg('Settings saved.');
    } catch (e) {
      setSaveStatus('error');
      setSaveMsg(String(e));
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

  function TestResult({ name }: { name: string }) {
    const r = testResults[name];
    if (!r) return null;
    if (r === 'loading') return <span className="test-loading">Testing…</span>;
    return <span className={r.ok ? 'test-ok' : 'test-fail'}>{r.ok ? '✓' : '✗'} {r.message}</span>;
  }

  async function runTrigger(label: string, fn: () => Promise<unknown>) {
    setTriggerStatus(`Running ${label}…`);
    try {
      const result = await fn();
      setTriggerStatus(`${label} done: ${JSON.stringify(result)}`);
    } catch (e) {
      setTriggerStatus(`Error: ${String(e)}`);
    }
  }

  if (!form) return <p className="meta">Loading…</p>;

  return (
    <div>
      <h1>Settings</h1>

      {saveStatus === 'saved' && <div className="alert alert-success">{saveMsg}</div>}
      {saveStatus === 'error' && <div className="alert alert-error">{saveMsg}</div>}

      <form onSubmit={handleSave}>

        <div className="card">
          <h2>Lidarr</h2>
          <div className="form-grid-2">
            <div className="form-field">
              <label>URL</label>
              <input {...field('lidarrUrl')} placeholder="https://lidarr.example.com" />
            </div>
            <div className="form-field">
              <label>API Key</label>
              <input {...field('lidarrApiKey')} placeholder="••••••••••••••••••••" />
            </div>
          </div>
          <div className="btn-row">
            <button type="button" className="btn-sm" onClick={() => testConnection('lidarr', api.testLidarr)}>
              Test connection
            </button>
            <TestResult name="lidarr" />
          </div>
        </div>

        <div className="card">
          <h2>Prowlarr</h2>
          <div className="form-grid-2">
            <div className="form-field">
              <label>URL</label>
              <input {...field('prowlarrUrl')} placeholder="https://prowlarr.example.com" />
            </div>
            <div className="form-field">
              <label>API Key</label>
              <input {...field('prowlarrApiKey')} placeholder="••••••••••••••••••••" />
            </div>
          </div>
          <div className="btn-row">
            <button type="button" className="btn-sm" onClick={() => testConnection('prowlarr', api.testProwlarr)}>
              Test connection
            </button>
            <TestResult name="prowlarr" />
          </div>
        </div>

        <div className="card">
          <h2>Azuracast</h2>
          <div className="form-grid-2">
            <div className="form-field">
              <label>URL</label>
              <input {...field('azuracastUrl')} placeholder="https://radio.example.com" />
            </div>
            <div className="form-field">
              <label>API Key</label>
              <input {...field('azuracastApiKey')} placeholder="••••••••••••••••••••" />
            </div>
          </div>
          <div className="form-field" style={{ maxWidth: 360 }}>
            <label>Station IDs (comma-separated)</label>
            <input {...field('azuracastStationIds')} placeholder="smj, station2" />
          </div>
          <div className="btn-row">
            <button type="button" className="btn-sm" onClick={() => testConnection('azuracast', api.testAzuracast)}>
              Test connection
            </button>
            <TestResult name="azuracast" />
          </div>
        </div>

        <div className="card">
          <h2>NAS</h2>
          <div className="form-field" style={{ maxWidth: 400 }}>
            <label>Mount path (inside the container)</label>
            <input {...field('nasMountPath')} placeholder="/mnt/nas-music" />
          </div>
        </div>

        <div className="card">
          <h2>Spotify</h2>
          <p className="meta" style={{ marginBottom: 12 }}>
            Status: {form.spotifyConnected
              ? <span className="test-ok">Connected</span>
              : <span style={{ color: 'var(--text-muted)' }}>Not connected</span>}
          </p>
          <div className="form-grid-2">
            <div className="form-field">
              <label>Client ID</label>
              <input {...field('spotifyClientId')} />
            </div>
            <div className="form-field">
              <label>Client Secret</label>
              <input {...field('spotifyClientSecret')} placeholder="••••••••••••••••••••" />
            </div>
          </div>
          <div className="form-field" style={{ maxWidth: 480 }}>
            <label>Redirect URI</label>
            <input {...field('spotifyRedirectUri')} placeholder="http://localhost:3000/spotify/callback" />
          </div>
          <div className="btn-row">
            <a href={api.spotifyLoginUrl()} target="_blank" rel="noreferrer">
              <button type="button" className="btn-sm">Connect Spotify</button>
            </a>
          </div>
        </div>

        <div className="card">
          <h2>Acquisition</h2>
          <div className="form-field" style={{ maxWidth: 200 }}>
            <label>YouTube fallback timeout (minutes)</label>
            <input type="number" {...field('fallbackTimeoutMins')} min={1} />
          </div>
          <div className="form-field" style={{ maxWidth: 360 }}>
            <label>
              Match confidence threshold — <strong>{Number(form.matchThreshold ?? 0.82).toFixed(2)}</strong>
              <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> (lower = more matches, higher = stricter)</span>
            </label>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.01}
              value={form.matchThreshold ?? 0.82}
              onChange={(e) => setForm((f) => ({ ...f, matchThreshold: parseFloat(e.target.value) }))}
              style={{ width: '100%' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
              <span>0.10 (loose)</span>
              <span>1.00 (exact)</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h2>Scheduling</h2>
          <p className="meta" style={{ marginBottom: 12 }}>Set to 0 to disable automatic runs.</p>
          <div className="form-grid-2">
            <div className="form-field">
              <label>NAS scan interval (minutes)</label>
              <input type="number" {...field('scanIntervalMins')} min={0} />
            </div>
            <div className="form-field">
              <label>Azuracast poll interval (minutes)</label>
              <input type="number" {...field('azuracastPollIntervalMins')} min={0} />
            </div>
            <div className="form-field">
              <label>Acquiring recheck interval (minutes)</label>
              <input type="number" {...field('recheckIntervalMins')} min={0} />
            </div>
          </div>
        </div>

        <div className="btn-row" style={{ marginBottom: 32 }}>
          <button type="submit" className="btn-primary">Save settings</button>
        </div>
      </form>

      <div className="card">
        <h2>Manual actions</h2>
        {triggerStatus && (
          <div className="alert alert-info" style={{ marginBottom: 14 }}>{triggerStatus}</div>
        )}
        <div className="btn-row">
          <button type="button" onClick={() => runTrigger('NAS scan', api.triggerNasScan)}>
            Scan NAS now
          </button>
          <button type="button" onClick={() => runTrigger('Azuracast poll', api.triggerAzuracastPoll)}>
            Poll Azuracast now
          </button>
          <button type="button" onClick={() => runTrigger('Timeout check', api.triggerAcquisitionTimeoutCheck)}>
            Check acquisition timeouts
          </button>
          <button type="button" onClick={() => runTrigger('Recheck acquiring', api.recheckAcquiring)}>
            Recheck acquiring tracks
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Data</h2>
        <p className="meta" style={{ marginBottom: 12 }}>
          Find duplicate artists and tracks (same normalized name) and merge them into a single record.
        </p>
        <div className="btn-row">
          <button type="button" onClick={() => runTrigger('Merge duplicates', api.mergeDuplicates)}>
            Find &amp; merge duplicate tracks
          </button>
        </div>
      </div>
    </div>
  );
}
