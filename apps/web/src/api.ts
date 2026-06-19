const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';

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
  libraryFiles: Array<{ id: string }>;
  azuracastTracks: Array<{ id: string }>;
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

export interface JobEntry {
  id: string;
  source: 'lidarr' | 'youtube';
  status: string;
  track: { id: string; title: string; artist: string };
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface YoutubeCandidate {
  videoId: string;
  title: string;
  uploader: string;
  durationSec: number | null;
}

export interface PendingApproval {
  jobId: string;
  track: { id: string; title: string; artist: string };
  candidates: YoutubeCandidate[] | undefined;
}

export interface LibraryEntry {
  id: string;
  source: 'nas' | 'azuracast';
  artist: string;
  title: string;
  album: string | null;
  filename: string | null;
  path: string | null;
  stationId: string | null;
  uniqueId?: string | null;
  azuracastBaseUrl?: string | null;
}

export interface TestResult {
  ok: boolean;
  message: string;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  trackCount: number;
}

export interface SpotifyImportResult {
  listId: string;
  listName: string;
  parsed: number;
  added: number;
  skipped: number;
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
  matchThreshold: number;
  scanIntervalMins: number;
  azuracastPollIntervalMins: number;
  recheckIntervalMins: number;
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
  exportZipUrl: (listId: string, includeAzuracast = false) =>
    `${API_BASE}/lists/${listId}/export${includeAzuracast ? '?includeAzuracast=true' : ''}`,

  getSettings: () => request<Settings>('/settings'),
  updateSettings: (dto: Partial<Settings>) =>
    request<Settings>('/settings', { method: 'PUT', body: JSON.stringify(dto) }),
  spotifyLoginUrl: () => `${API_BASE}/spotify/login`,
  getSpotifyPlaylists: () => request<SpotifyPlaylist[]>('/spotify/playlists'),
  importSpotifyLikedSongs: () => request<SpotifyImportResult>('/spotify/import/liked-songs', { method: 'POST' }),
  importSpotifyPlaylist: (playlistId: string) =>
    request<SpotifyImportResult>(`/spotify/import/playlist/${playlistId}`, { method: 'POST' }),

  acquireTrack: (trackId: string) =>
    request<{ status: string; attempts: Array<{ message?: string }> }>(
      `/lidarr/acquire/${trackId}`, { method: 'POST' },
    ),
  checkTrackStatus: (trackId: string) =>
    request<{ status: string; hasFile: boolean }>(`/lidarr/check/${trackId}`, { method: 'POST' }),

  getJobs: () => request<JobEntry[]>('/acquisition/jobs'),
  clearJobs: () => request<{ deleted: number }>('/acquisition/jobs', { method: 'DELETE' }),
  listPendingApprovals: () => request<PendingApproval[]>('/acquisition/pending'),
  approveCandidate: (jobId: string, videoId: string) =>
    request<{ status: string; trackStatus: string }>(
      `/acquisition/${jobId}/approve`,
      { method: 'POST', body: JSON.stringify({ videoId }) },
    ),

  searchLibrary: (params?: {
    q?: string;
    source?: 'all' | 'nas' | 'azuracast';
    page?: number;
    pageSize?: number;
    sort?: 'artist' | 'title' | 'album';
    order?: 'asc' | 'desc';
  }) => {
    const p = new URLSearchParams();
    if (params?.q) p.set('q', params.q);
    if (params?.source) p.set('source', params.source);
    if (params?.page) p.set('page', String(params.page));
    if (params?.pageSize) p.set('pageSize', String(params.pageSize));
    if (params?.sort) p.set('sort', params.sort);
    if (params?.order) p.set('order', params.order);
    const qs = p.toString();
    return request<{ items: LibraryEntry[]; total: number; page: number; pageSize: number }>(
      `/library${qs ? `?${qs}` : ''}`,
    );
  },
  nasDownloadUrl: (id: string) => `${API_BASE}/library/${id}/download`,
  azuracastDownloadUrl: (id: string) => `${API_BASE}/library/azuracast/${id}/download`,
  // Same URLs work for streaming playback — browsers play audio regardless of Content-Disposition
  nasStreamUrl: (id: string) => `${API_BASE}/library/${id}/download`,
  azuracastStreamUrl: (id: string) => `${API_BASE}/library/azuracast/${id}/download`,
  getLibraryStats: () => request<{ nasCount: number; azuracastCount: number }>('/library/stats'),

  testLidarr: () => request<TestResult>('/settings/test/lidarr', { method: 'POST' }),
  testProwlarr: () => request<TestResult>('/settings/test/prowlarr', { method: 'POST' }),
  testAzuracast: () => request<TestResult>('/settings/test/azuracast', { method: 'POST' }),

  triggerNasScan: () => request<unknown>('/nas-scanner/scan', { method: 'POST' }),
  triggerAzuracastPoll: () => request<unknown>('/azuracast/poll', { method: 'POST' }),
  triggerAcquisitionTimeoutCheck: () =>
    request<unknown>('/acquisition/check-timeouts', { method: 'POST' }),
  recheckAcquiring: () =>
    request<{ checked: number; nowOwned: number; stillAcquiring: number; errors: number }>(
      '/acquisition/recheck', { method: 'POST' },
    ),

  mergeDuplicates: () =>
    request<{ mergedArtists: number; mergedTracks: number }>('/settings/merge-duplicates', { method: 'POST' }),
};
