export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    owned:                  { cls: 'badge-owned',     label: 'Owned' },
    missing:                { cls: 'badge-missing',   label: 'Missing' },
    available_on_azuracast: { cls: 'badge-azuracast', label: 'On Air' },
    acquiring:              { cls: 'badge-acquiring', label: 'Acquiring' },
    needs_approval:         { cls: 'badge-approval',  label: 'Review' },
  };
  const { cls, label } = map[status] ?? { cls: 'badge-missing', label: status };
  return <span className={`badge ${cls}`}>{label}</span>;
}

export function SourceBadge({ source }: { source: 'nas' | 'azuracast' }) {
  return source === 'nas'
    ? <span className="badge badge-nas">NAS</span>
    : <span className="badge badge-azuracast">Azuracast</span>;
}
