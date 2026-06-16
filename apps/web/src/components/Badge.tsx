export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string; tip: string }> = {
    owned: {
      cls: 'badge-owned',
      label: 'Owned',
      tip: 'File found in your NAS library',
    },
    missing: {
      cls: 'badge-missing',
      label: 'Missing',
      tip: 'Not found anywhere — click Acquire to search via Lidarr',
    },
    available_on_azuracast: {
      cls: 'badge-azuracast',
      label: 'On Air',
      tip: 'Available on your Azuracast station but not in your NAS',
    },
    acquiring: {
      cls: 'badge-acquiring',
      label: 'Acquiring',
      tip: 'Lidarr is searching — click Check Status to update',
    },
    needs_approval: {
      cls: 'badge-approval',
      label: 'Review',
      tip: 'Lidarr timed out — YouTube candidates are waiting in Activity',
    },
  };
  const { cls, label, tip } = map[status] ?? { cls: 'badge-missing', label: status, tip: '' };
  return (
    <span className={`badge ${cls}`} data-tooltip={tip || undefined}>
      {label}
    </span>
  );
}

export function SourceBadge({ source }: { source: 'nas' | 'azuracast' }) {
  return source === 'nas'
    ? <span className="badge badge-nas">NAS</span>
    : <span className="badge badge-azuracast">Azuracast</span>;
}

const JOB_STATUS: Record<string, { cls: string; tip: string }> = {
  pending:           { cls: 'badge-missing',   tip: 'Queued, not yet started' },
  searching:         { cls: 'badge-acquiring', tip: 'Lidarr is searching for this track' },
  downloading:       { cls: 'badge-azuracast', tip: 'Downloading audio from YouTube' },
  importing:         { cls: 'badge-azuracast', tip: 'Download complete, waiting for NAS rescan' },
  done:              { cls: 'badge-owned',     tip: 'Successfully acquired and matched' },
  failed:            { cls: 'badge-error',     tip: 'Search or download failed' },
  awaiting_approval: { cls: 'badge-approval',  tip: 'YouTube candidates found — your approval needed' },
};

export function JobStatusBadge({ status }: { status: string }) {
  const { cls, tip } = JOB_STATUS[status] ?? { cls: 'badge-missing', tip: '' };
  return (
    <span className={`badge ${cls}`} data-tooltip={tip || undefined}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
