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
const ROLE_KEY = 'summit_role';

export type Role = 'user' | 'manager' | 'admin';

function readRole(): Role {
  const r = localStorage.getItem(ROLE_KEY);
  return r === 'admin' || r === 'manager' || r === 'user' ? r : 'user';
}

export const auth = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },
  getUsername(): string | null {
    return localStorage.getItem(USERNAME_KEY);
  },
  getRole: readRole,
  set(token: string, username: string, role: Role = 'user') {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USERNAME_KEY, username);
    localStorage.setItem(ROLE_KEY, role);
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USERNAME_KEY);
    localStorage.removeItem(ROLE_KEY);
  },
  // admin = 最高管理者；manager = 一般管理者（含 admin），可管理內容。
  isAdmin(): boolean {
    return readRole() === 'admin';
  },
  isManager(): boolean {
    return readRole() !== 'user';
  },
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// ── 登入逾時 ──────────────────────────────────────────────────────────
// token 存在 localStorage，關掉瀏覽器再打開仍會「看起來已登入」。token 一旦過期，
// 後端每個 API 都回 401，畫面就卡在載入失敗。所以：
//   1. 開頁、切回分頁、每分鐘檢查一次 token 的 exp，過期就登出（checkSessionExpiry）
//   2. 任何帶 token 的請求收到 401，也視為登入失效（handleUnauthorized）
// 兩者都會清掉登入資料並通知 App 回到登入頁。

/** 這些端點的 401 是「帳密錯誤」，不是登入逾時。 */
const CREDENTIAL_PATHS = new Set(['/api/auth/login', '/api/auth/change-password']);

const expiredListeners = new Set<() => void>();

/** App 訂閱登入失效事件；回傳取消訂閱的函式。 */
export function onSessionExpired(fn: () => void): () => void {
  expiredListeners.add(fn);
  return () => {
    expiredListeners.delete(fn);
  };
}

function expireSession() {
  // 同時有多個請求回 401 時只通知一次
  if (!auth.getToken()) return;
  auth.clear();
  expiredListeners.forEach((fn) => fn());
}

/** 讀 JWT 的 exp（毫秒）。只用來提早發現過期，不驗簽 —— 真正的驗證在後端。無法解析回 0。 */
function tokenExpiresAt(token: string): number {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '=')));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

/** token 已過期（或格式不對）就登出並通知 App；回傳是否因此登出。 */
export function checkSessionExpiry(): boolean {
  const token = auth.getToken();
  if (token && tokenExpiresAt(token) <= Date.now()) {
    expireSession();
    return true;
  }
  return false;
}

function handleUnauthorized(status: number, path: string, sentToken: boolean) {
  if (status === 401 && sentToken && !CREDENTIAL_PATHS.has(path)) expireSession();
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
    handleUnauthorized(res.status, path, !!token);
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

/** multipart 上傳：不可自行設 Content-Type，瀏覽器需自動帶 boundary。 */
async function sendForm<T>(method: 'POST' | 'PUT', path: string, form: FormData): Promise<T> {
  const token = auth.getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    handleUnauthorized(res.status, path, !!token);
    const msg = (payload as { error?: string } | null)?.error;
    throw new ApiError(res.status, msg || `上傳失敗（HTTP ${res.status}）`);
  }
  return payload as T;
}

function fileForm(file: File): FormData {
  const fd = new FormData();
  fd.append('file', file);
  return fd;
}

// ── Typed endpoint helpers ────────────────────────────────────────────

export interface LoginResponse {
  token: string;
  username: string;
  role: Role;
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

// ── 設定檔上傳（admin）──────────────────────────────────────────────
// 先 preview 看差異（不寫入），確認後再 PUT 取代。

/** cloud＝後台上傳、存在雲端；bundled＝隨部署提供的內建檔；local＝本機檔案。 */
export type ConfigSource = 'cloud' | 'bundled' | 'local';

export interface SheetCount {
  name: string;
  items: number;
}

export interface ConfigInfo {
  source: ConfigSource;
  storage: 'gcs' | 'local';
  filename: string;
  updated_at: string;
  updated_by: string;
  sheets: SheetCount[];
  total_items: number;
}

export interface ConfigDiff {
  added: number;
  removed: number;
  changed: number;
  /** 各列最多 50 筆，格式「分頁 / [區段] Key」 */
  added_keys: string[];
  removed_keys: string[];
  changed_keys: string[];
  sheets_added: string[];
  sheets_removed: string[];
}

export interface ConfigPreview {
  filename: string;
  size: number;
  sheets: SheetCount[];
  total_items: number;
  diff: ConfigDiff;
}

export const fetchConfigInfo = (signal?: AbortSignal) =>
  api.get<ConfigInfo>('/api/config/info', signal);

export const previewConfigUpload = (file: File) =>
  sendForm<ConfigPreview>('POST', '/api/config/preview', fileForm(file));

export const replaceConfig = (file: File) =>
  sendForm<ConfigInfo>('PUT', '/api/config', fileForm(file));

export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type IssueStatus = 'open' | 'in-progress' | 'resolved';

export interface IssueComment {
  id: string;
  author: string;
  text: string;
  created_at: string;
}

export interface Issue {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  related_config_key: string;
  status: IssueStatus;
  /** 留言存在 issue 文件內，列表即帶回，不需另外請求。 */
  comments?: IssueComment[];
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

/** 更新狀態需 manager 以上（後端 @manager_required）。 */
export const updateIssueStatus = (id: string, status: IssueStatus) =>
  api.patch<Issue>(`/api/issues/${id}`, { status });

/** 留言開放給任何登入者。 */
export const addIssueComment = (id: string, text: string) =>
  api.post<Issue>(`/api/issues/${id}/comments`, { text });

// ── 異常回報附件 ─────────────────────────────────────────────────────
// 下載路由不需驗證，可直接放進 img src。上傳開放登入者，刪除需 manager 以上。

export const issueAttachmentUrl = (issueId: string, name: string) =>
  `${API_BASE}/api/issues/attachments/${encodeURIComponent(issueId)}/${encodeURIComponent(name)}`;

export const fetchIssueAttachments = (issueId: string, signal?: AbortSignal) =>
  api.get<ArticleAttachment[]>(`/api/issues/${encodeURIComponent(issueId)}/attachments`, signal);

/** 後端一次收一個檔（欄位名 file）。 */
export async function uploadIssueAttachment(
  issueId: string,
  file: File
): Promise<{ filename: string }> {
  return sendForm<{ filename: string }>(
    'POST',
    `/api/issues/${encodeURIComponent(issueId)}/attachments`,
    fileForm(file)
  );
}

export const deleteIssueAttachment = (issueId: string, filename: string) =>
  api.del<void>(
    `/api/issues/${encodeURIComponent(issueId)}/attachments/${encodeURIComponent(filename)}`
  );

// ── Requirements (需求管理) ──────────────────────────────────────────
// 讀取開放給登入者；建立/更新/刪除限 manager 以上（後端 @manager_required，否則回 403）。
// App 是主檔：Excel 匯入只新增需求，之後的進度、負責人、預計完成日都在 App 裡維護。

export type RequirementStatus = 'pending' | 'in-progress' | 'done' | 'on-hold' | 'rejected';
export type RequirementPriority = 'high' | 'medium' | 'low';
export type RequirementSoftware = 'human' | 'vet' | 'hcr' | 'viewer';

/** 畫面顯示/編輯的 9 個欄位 */
export interface Requirement {
  id: string;
  /** 需求標題（內容） */
  content: string;
  submitted_date: string;
  priority: RequirementPriority;
  /** 版本 */
  target_version: string;
  /** 舊資料可能為空字串（未指定） */
  software: RequirementSoftware | '';
  /** 舊資料可能殘留 evaluating，顯示時用 reqmtStatusOf() 容錯 */
  status: RequirementStatus;
  assignee: string;
  /** 開發編號（JIRA） */
  dev_id: string;
  /** 預計完成日 YYYY-MM-DD */
  due_date: string;
  /** 匯入來源標記（由匯入寫入，UI 不顯示、不可修改） */
  source_file?: string;
  imported_at?: string;
  created_at: string;
  updated_at: string;
}

export interface RequirementStats {
  total: number;
  by_status: Record<string, number>;
  by_priority: Record<string, number>;
  by_software: Record<string, number>;
  recent: Requirement[];
}

export type RequirementInput = Partial<
  Omit<Requirement, 'id' | 'created_at' | 'updated_at' | 'source_file' | 'imported_at'>
>;

export const fetchRequirements = (
  params: { q?: string; status?: string; priority?: string } = {},
  signal?: AbortSignal
) => {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.status) search.set('status', params.status);
  if (params.priority) search.set('priority', params.priority);
  const qs = search.toString();
  return api.get<Requirement[]>(`/api/requirements${qs ? `?${qs}` : ''}`, signal);
};

export const fetchRequirementStats = (signal?: AbortSignal) =>
  api.get<RequirementStats>('/api/requirements/stats', signal);

export const createRequirement = (data: RequirementInput) =>
  api.post<Requirement>('/api/requirements', data);

export const updateRequirement = (id: string, data: RequirementInput) =>
  api.patch<Requirement>(`/api/requirements/${id}`, data);

export const deleteRequirement = (id: string) =>
  api.del<void>(`/api/requirements/${id}`);

// ── 需求 Excel 匯入（admin）─────────────────────────────────────────
// 只新增、不修改或刪除既有需求。疑似重複的列需明確勾選（include）才會匯入。
// 讀取所有分頁，分頁名稱決定「軟體」；列以「分頁!列號」(ref) 識別。

export interface ImportRow {
  /** 「分頁!列號」，例如 人醫!12 */
  ref: string;
  sheet: string;
  excel_row: number;
  content: string;
  software: RequirementSoftware;
  priority: RequirementPriority;
  status: RequirementStatus;
  submitted_date: string;
  target_version: string;
  dev_id: string;
}

export interface ImportWarning {
  ref: string;
  sheet: string;
  excel_row: number;
  field: 'content' | 'status' | 'submitted_date';
  value: string;
  message: string;
}

export interface RequirementImportReport {
  source_file: string;
  existing_total: number;
  rows_total: number;
  /** 有匯入資料的分頁與其對應軟體 */
  sheets: { sheet: string; software: RequirementSoftware; rows: number }[];
  new: ImportRow[];
  similar: {
    row: ImportRow;
    existing: { id: string; content: string; status: string };
    /** 0–1 */
    score: number;
  }[];
  duplicates: { row: ImportRow; existing_id: string; diffs: string[] }[];
  /** 列層級提示：未知進度（→未評估）、日期無法解析、檔案內重複…… */
  warnings: ImportWarning[];
  /** 分頁層級提示：分頁名稱不是已知軟體、找不到表頭……（整頁略過） */
  notes: { sheet: string; message: string }[];
}

export interface RequirementImportResult {
  source_file: string;
  created: number;
  skipped_duplicate: number;
  skipped_similar: number;
}

export const previewRequirementImport = (file: File) =>
  sendForm<RequirementImportReport>('POST', '/api/requirements/import/preview', fileForm(file));

export const commitRequirementImport = (file: File, includeRefs: string[]) => {
  const fd = fileForm(file);
  fd.append('include', includeRefs.join(','));
  return sendForm<RequirementImportResult>('POST', '/api/requirements/import', fd);
};

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

/** 附件圖片的直接網址（此路由不需驗證，可直接放進 img src）。 */
export const attachmentUrl = (slug: string, name: string) =>
  `${API_BASE}/api/troubleshooting/attachments/${encodeURIComponent(slug)}/${encodeURIComponent(name)}`;

export const fetchArticleAttachments = (slug: string, signal?: AbortSignal) =>
  api.get<ArticleAttachment[]>(
    `/api/troubleshooting/articles/${encodeURIComponent(slug)}/attachments`,
    signal
  );

/** 後端一次收一個檔（欄位名 file）；多選時由呼叫端逐一上傳。 */
export async function uploadArticleAttachment(
  slug: string,
  file: File
): Promise<{ filename: string }> {
  return sendForm<{ filename: string }>(
    'POST',
    `/api/troubleshooting/articles/${encodeURIComponent(slug)}/attachments`,
    fileForm(file)
  );
}

export const deleteArticleAttachment = (slug: string, filename: string) =>
  api.del<void>(
    `/api/troubleshooting/articles/${encodeURIComponent(slug)}/attachments/${encodeURIComponent(filename)}`
  );

export const fetchCategories = (signal?: AbortSignal) =>
  api.get<string[]>('/api/troubleshooting/categories', signal);

/** 版本變更條目，依種類分組（後端由 ### 分區解析）。 */
export interface ReleaseNotes {
  new: string[];
  improve: string[];
  fix: string[];
}

export interface ReleaseVersionListItem {
  version: string;
  slug: string;
  date: string;
  summary: string;
  /** 時間軸用；舊版後端可能沒有，故為選填。 */
  notes?: ReleaseNotes;
}

export interface ReleaseVersionFull extends ReleaseVersionListItem {
  html_body: string;
}

export const fetchVersions = (signal?: AbortSignal) =>
  api.get<ReleaseVersionListItem[]>('/api/release-notes', signal);

export const fetchVersion = (slug: string, signal?: AbortSignal) =>
  api.get<ReleaseVersionFull>(`/api/release-notes/${slug}`, signal);

// ── 客服小幫手 ───────────────────────────────────────────────────────
// VITE_ASSISTANT_API 未設定時，頁面改用知識庫比對的示範回覆（設計稿的「示範模式」）。

export const ASSISTANT_ENDPOINT: string =
  (import.meta.env.VITE_ASSISTANT_API as string | undefined)?.trim() ?? '';

export const assistantConfigured = ASSISTANT_ENDPOINT.length > 0;

export interface AssistantRef {
  id: string;
  title: string;
}

export interface AssistantAnswer {
  answer: string;
  refs?: AssistantRef[];
  keys?: string[];
}

export type AssistantTurn = { role: 'user' | 'assistant'; content: string };

export async function askAssistantApi(
  question: string,
  history: AssistantTurn[]
): Promise<AssistantAnswer> {
  // 相對路徑 = 自家後端，沿用 request() 以帶上 Bearer token 與共用錯誤處理
  if (ASSISTANT_ENDPOINT.startsWith('/')) {
    return api.post<AssistantAnswer>(ASSISTANT_ENDPOINT, { question, history });
  }
  // 絕對網址 = 外部服務，直接 fetch（不可套用 API_BASE）
  const res = await fetch(ASSISTANT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, history }),
  });
  if (!res.ok) throw new ApiError(res.status, `客服小幫手回覆失敗（HTTP ${res.status}）`);
  return (await res.json()) as AssistantAnswer;
}

// 更新紀錄編輯（admin only）：整份 Markdown 讀取與覆寫。
export const fetchReleaseNoteRaw = (signal?: AbortSignal) =>
  api.get<{ content: string }>('/api/release-notes/raw', signal);

export const saveReleaseNote = (content: string) =>
  api.put<{ ok: true }>('/api/release-notes', { content });

export interface UserInfo {
  username: string;
  role: Role;
}

export const fetchUsers = (signal?: AbortSignal) =>
  api.get<UserInfo[]>('/api/users', signal);

export const createUser = (username: string, password: string, role: Role = 'user') =>
  api.post<UserInfo>('/api/users', { username, password, role });

export const deleteUser = (username: string) =>
  api.del<void>(`/api/users/${encodeURIComponent(username)}`);

export const resetUserPassword = (username: string, new_password: string) =>
  api.post<{ ok: true }>(`/api/users/${encodeURIComponent(username)}/password`, {
    new_password,
  });

// ── 帳號申請 ─────────────────────────────────────────────────────────

export interface AccountRequest {
  id: string;
  name: string;
  username: string;
  email: string;
  dept: string;
  title: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_at: string;
  reviewed_by: string;
}

export interface RegisterInput {
  name: string;
  username: string;
  email?: string;
  dept?: string;
  title?: string;
  reason?: string;
}

/** 公開端點（未登入可用）。帳號已存在或已有待審申請時後端回 202，不透露帳號是否存在。 */
export const registerAccount = (data: RegisterInput) =>
  api.post<{ ok: true; id?: string }>('/api/auth/register', data);

export const fetchAccountRequests = (status = '', signal?: AbortSignal) =>
  api.get<AccountRequest[]>(
    `/api/users/requests${status ? `?status=${encodeURIComponent(status)}` : ''}`,
    signal
  );

export const approveAccountRequest = (id: string, password: string, role: Role = 'user') =>
  api.post<UserInfo>(`/api/users/requests/${encodeURIComponent(id)}/approve`, { password, role });

export const rejectAccountRequest = (id: string) =>
  api.post<{ ok: true }>(`/api/users/requests/${encodeURIComponent(id)}/reject`, {});

export const setUserRole = (username: string, role: Role) =>
  api.patch<UserInfo>(`/api/users/${encodeURIComponent(username)}/role`, { role });
