/**
 * api.ts — Thin client for the HouseHill Flask backend.
 *
 * Configure the backend URL with VITE_API_BASE_URL at build/dev time
 * (e.g. `VITE_API_BASE_URL=http://192.168.1.10:5000 npm run dev`).
 * Falls back to `http://localhost:5000` for local development.
 */

// Production default: the public App Engine backend. Override locally with
//   VITE_API_BASE_URL=http://localhost:5000 npm run dev
const API_BASE: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ??
  'https://househill.de.r.appspot.com';

const TOKEN_KEY = 'summit_token';
const USERNAME_KEY = 'summit_username';

export const auth = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },
  getUsername(): string | null {
    return localStorage.getItem(USERNAME_KEY);
  },
  set(token: string, username: string) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USERNAME_KEY, username);
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USERNAME_KEY);
  },
  isAdmin(): boolean {
    return localStorage.getItem(USERNAME_KEY) === 'admin';
  },
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  signal?: AbortSignal
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = auth.getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  if (res.status === 204) return undefined as T;

  let payload: unknown = null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) payload = await res.json().catch(() => null);

  if (!res.ok) {
    const msg =
      (payload && typeof payload === 'object' && 'error' in payload
        ? (payload as { error?: string }).error
        : null) || `${method} ${path} failed (${res.status})`;
    throw new ApiError(res.status, msg);
  }

  return payload as T;
}

export const api = {
  base: API_BASE,
  get: <T>(path: string, signal?: AbortSignal) => request<T>('GET', path, undefined, signal),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};

// ── Typed endpoint helpers ────────────────────────────────────────────

export interface LoginResponse {
  token: string;
  username: string;
}

export const login = (username: string, password: string) =>
  api.post<LoginResponse>('/api/auth/login', { username, password });

export interface ConfigItem {
  section: string;
  key: string;
  description: string;
  attribute: string;
  options: string;
  default: string;
  ui_settable: string;
}

export type WorkbookData = Record<string, ConfigItem[]>;

export const fetchConfig = (signal?: AbortSignal) =>
  api.get<WorkbookData>('/api/config', signal);

export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type IssueStatus = 'open' | 'in-progress' | 'resolved';

export interface Issue {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  related_config_key: string;
  status: IssueStatus;
  created_at: string;
  updated_at: string;
}

export interface IssueStats {
  total: number;
  by_status: Record<string, number>;
  by_severity: Record<string, number>;
  recent: Issue[];
}

export const fetchIssues = (
  params: { q?: string; severity?: string; status?: string } = {},
  signal?: AbortSignal
) => {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.severity) search.set('severity', params.severity);
  if (params.status) search.set('status', params.status);
  const qs = search.toString();
  return api.get<Issue[]>(`/api/issues${qs ? `?${qs}` : ''}`, signal);
};

export const fetchIssueStats = (signal?: AbortSignal) =>
  api.get<IssueStats>('/api/issues/stats', signal);

export const createIssue = (data: {
  title: string;
  description: string;
  severity: Severity;
  related_config_key?: string;
}) => api.post<Issue>('/api/issues', data);

export const updateIssue = (id: string, data: Partial<Pick<Issue, 'title' | 'description' | 'severity' | 'status' | 'related_config_key'>>) =>
  api.patch<Issue>(`/api/issues/${id}`, data);

export interface ArticleListItem {
  slug: string;
  title: string;
  category: string;
  tags: string[];
  related_config_keys: string[];
  snippet: string;
}

export interface ArticleAttachment {
  name: string;
  size: number;
  size_display: string;
  extension: string;
  is_image: boolean;
}

export interface ArticleFull extends ArticleListItem {
  raw_body: string;
  html_body: string;
  attachments: ArticleAttachment[];
}

export const fetchArticles = (
  params: { q?: string; category?: string } = {},
  signal?: AbortSignal
) => {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.category && params.category !== '全部') search.set('category', params.category);
  const qs = search.toString();
  return api.get<ArticleListItem[]>(`/api/troubleshooting/articles${qs ? `?${qs}` : ''}`, signal);
};

export const fetchArticle = (slug: string, signal?: AbortSignal) =>
  api.get<ArticleFull>(`/api/troubleshooting/articles/${slug}`, signal);

export const fetchCategories = (signal?: AbortSignal) =>
  api.get<string[]>('/api/troubleshooting/categories', signal);

export interface ReleaseVersionListItem {
  version: string;
  slug: string;
  date: string;
  summary: string;
}

export interface ReleaseVersionFull extends ReleaseVersionListItem {
  html_body: string;
}

export const fetchVersions = (signal?: AbortSignal) =>
  api.get<ReleaseVersionListItem[]>('/api/release-notes', signal);

export const fetchVersion = (slug: string, signal?: AbortSignal) =>
  api.get<ReleaseVersionFull>(`/api/release-notes/${slug}`, signal);

export const fetchUsers = (signal?: AbortSignal) =>
  api.get<string[]>('/api/users', signal);

export const createUser = (username: string, password: string) =>
  api.post<{ username: string }>('/api/users', { username, password });

export const deleteUser = (username: string) =>
  api.del<void>(`/api/users/${encodeURIComponent(username)}`);

export const resetUserPassword = (username: string, new_password: string) =>
  api.post<{ ok: true }>(`/api/users/${encodeURIComponent(username)}/password`, {
    new_password,
  });
