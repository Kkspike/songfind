import { useCallback, useEffect, useState } from 'react';
import { api, type JobEntry, type PendingApproval, type YoutubeCandidate } from '../api';
import { JobStatusBadge } from '../components/Badge';

function fmt(sec: number | null) {
  if (sec == null) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function ActivityPage() {
  const [jobs, setJobs] = useState<JobEntry[]>([]);
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [approving, setApproving] = useState<Record<string, boolean>>({});
  const [approveResult, setApproveResult] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [j, a] = await Promise.all([api.getJobs(), api.listPendingApprovals()]);
      setJobs(j);
      setApprovals(a);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function handleApprove(jobId: string, videoId: string) {
    setApproving((p) => ({ ...p, [jobId]: true }));
    setApproveResult((p) => ({ ...p, [jobId]: 'Downloading… this may take a minute' }));
    try {
      const result = await api.approveCandidate(jobId, videoId);
      setApproveResult((p) => ({
        ...p,
        [jobId]: result.trackStatus === 'owned' ? '✓ Downloaded and matched!' : `Done (track status: ${result.trackStatus})`,
      }));
      refresh();
    } catch (e) {
      setApproveResult((p) => ({ ...p, [jobId]: `Error: ${String(e)}` }));
    } finally {
      setApproving((p) => ({ ...p, [jobId]: false }));
    }
  }

  return (
    <div>
      <div className="section-header">
        <h1 style={{ margin: 0 }}>Activity</h1>
        <div className="btn-row">
          <button onClick={refresh} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          {jobs.length > 0 && (
            <button
              className="btn-danger"
              disabled={clearing}
              onClick={async () => {
                if (!window.confirm(`Clear all ${jobs.length} job(s)? Affected tracks will be reset to missing.`)) return;
                setClearing(true);
                try { await api.clearJobs(); await refresh(); }
                catch (e) { setError(String(e)); }
                finally { setClearing(false); }
              }}
            >
              {clearing ? 'Clearing…' : 'Clear all jobs'}
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* ── Jobs table ── */}
      <div className="card" style={{ marginTop: 20 }}>
        <h2>Acquisition Jobs</h2>
        {jobs.length === 0 && !loading && (
          <p className="meta">No jobs yet. Click "Acquire" on a missing track to start.</p>
        )}
        {jobs.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Track</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Started</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td style={{ color: 'var(--text-heading)' }}>
                      {job.track.artist} — {job.track.title}
                      {job.errorMessage && (
                        <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
                          {job.errorMessage}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${job.source === 'lidarr' ? 'badge-lidarr' : 'badge-youtube'}`}>
                        {job.source === 'lidarr' ? 'Lidarr' : 'YouTube'}
                      </span>
                    </td>
                    <td><JobStatusBadge status={job.status} /></td>
                    <td style={{ color: 'var(--text-muted)' }}>{timeAgo(job.createdAt)}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{timeAgo(job.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── YouTube approval queue ── */}
      <div className="card">
        <h2>YouTube Approval Queue</h2>
        {approvals.length === 0 && (
          <p className="meta">No pending approvals. When Lidarr can't find a track after the timeout, YouTube candidates will appear here.</p>
        )}
        {approvals.map((approval) => (
          <div key={approval.jobId} style={{ marginBottom: 24 }}>
            <p style={{ color: 'var(--text-heading)', fontWeight: 600, marginBottom: 10 }}>
              {approval.track.artist} — {approval.track.title}
            </p>

            {approveResult[approval.jobId] && (
              <div className="alert alert-info" style={{ marginBottom: 10 }}>
                {approveResult[approval.jobId]}
              </div>
            )}

            {!approval.candidates?.length && (
              <p className="meta">No candidates found for this track.</p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {approval.candidates?.map((c: YoutubeCandidate) => (
                <CandidateRow
                  key={c.videoId}
                  candidate={c}
                  disabled={!!approving[approval.jobId]}
                  onApprove={() => handleApprove(approval.jobId, c.videoId)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CandidateRow({
  candidate,
  disabled,
  onApprove,
}: {
  candidate: YoutubeCandidate;
  disabled: boolean;
  onApprove: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 6,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: 'var(--text-heading)', fontWeight: 500, fontSize: 13, marginBottom: 2 }}>
          {candidate.title}
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
          {candidate.uploader} · {fmt(candidate.durationSec)}
        </div>
      </div>
      <button
        className="btn-sm btn-primary"
        onClick={onApprove}
        disabled={disabled}
        style={{ flexShrink: 0 }}
      >
        Approve
      </button>
    </div>
  );
}
