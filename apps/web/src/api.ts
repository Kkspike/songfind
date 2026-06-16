const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface ListSummary {
  id: string;
  name: string;
  createdAt: string;
  itemCount: number;
}

export interface Artist {
  id: string;
  name: string;
}

export interface Track {
  id: string;
  title: string;
  status: 'missing' | 'owned' | 'available_on_azuracast' | 'acquiring' | 'needs_approval';
  artist: Artist;
}

export interface SongListItem {
  id: string;
  position: number;
  track: Track;
}

export interface SongListDetail {
  id: string;
  name: string;
  createdAt: string;
  items: SongListItem[];
}

export interface Settings {
  id: number;
  prowlarrUrl: string | null;
  prowlarrApiKey: string | null;
  lidarrUrl: string | null;
  lidarrApiKey: string | null;
  azuracastUrl: string | null;
  azuracastApiKey: string | null;
  azuracastStationIds: string | null;
  nasMountPath: string | null;
  spotifyClientId: string | null;
  spotifyClientSecret: string | null;
  spotifyRedirectUri: string | null;
  fallbackTimeoutMins: number;
  spotifyConnected: boolean;
}

export const api = {
  getLists: () => request<ListSummary[]>('/lists'),
  createList: (name: string) =>
    request<ListSummary>('/lists', { method: 'POST', body: JSON.stringify({ name }) }),
  getList: (id: string) => request<SongListDetail>(`/lists/${id}`),
  deleteList: (id: string) => request<void>(`/lists/${id}`, { method: 'DELETE' }),
  removeItem: (listId: string, itemId: string) =>
    request<void>(`/lists/${listId}/items/${itemId}`, { method: 'DELETE' }),
  importText: (listId: string, text: string) =>
    request<{ parsed: number; added: number; skipped: number }>(
      `/lists/${listId}/import/text`,
      { method: 'POST', body: JSON.stringify({ text }) },
    ),
  importCsv: async (listId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/lists/${listId}/import/csv`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json() as Promise<{ parsed: number; added: number; skipped: number }>;
  },
  exportZipUrl: (listId: string) => `${API_BASE}/lists/${listId}/export`,

  getSettings: () => request<Settings>('/settings'),
  updateSettings: (dto: Partial<Settings>) =>
    request<Settings>('/settings', { method: 'PUT', body: JSON.stringify(dto) }),
  spotifyLoginUrl: () => `${API_BASE}/spotify/login`,

  triggerNasScan: () => request<unknown>('/nas-scanner/scan', { method: 'POST' }),
  triggerAzuracastPoll: () => request<unknown>('/azuracast/poll', { method: 'POST' }),
  triggerAcquisitionTimeoutCheck: () =>
    request<unknown>('/acquisition/check-timeouts', { method: 'POST' }),
};
