import { useState, useMemo, type ReactNode } from 'react';
import { TopBar } from '../components/TopBar';
import { NavHeader } from '../components/NavHeader';
import { MobileNav } from '../components/MobileNav';
import { SearchFAB } from '../components/SearchFAB';
import { MobileSearchOverlay } from '../components/MobileSearchOverlay';
import { SidebarLabel, SidebarItem } from '../components/Sidebar';
import { LoadingState, EmptyState, ErrorState } from '../components/States';
import { Badge } from '../components/Badge';
import {
  T,
  reqmtStatusStyle,
  reqmtStatusOf,
  softwareStyle,
  softwareOf,
  priStyle,
  type ReqStatus,
  type Software,
  type Priority,
} from '../tokens';
import {
  fetchRequirements,
  createRequirement,
  updateRequirement,
  deleteRequirement,
  ApiError,
  type Requirement,
  type RequirementInput,
} from '../api';
import { useApi } from '../hooks/useApi';
import type { PageId } from '../types';
import { useIsMobile } from '../hooks/useMediaQuery';

interface Props {
  onNav: (id: PageId) => void;
  onLogout?: () => void;
  isAdmin?: boolean;
  isManager?: boolean;
  onAdminClick?: () => void;
}

const STATUS_ORDER: ReqStatus[] = ['pending', 'in-progress', 'done', 'on-hold', 'rejected'];
const SOFTWARE_ORDER: Software[] = ['human', 'vet', 'hcr', 'viewer'];
const PRIORITY_ORDER: Priority[] = ['high', 'medium', 'low'];

type SoftwareFilter = 'all' | Software | 'unset';

const formatDate = (iso: string) => (iso ? iso.slice(0, 10) : '');
const firstLine = (s: string) => (s || '（無內容）').split('\n')[0];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** 本地日期 YYYY-MM-DD（不用 toISOString，避免 UTC 時差跨日） */
function todayStr() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 逾期：有預計完成日、已過期，且仍在「未評估／進行中」 */
function isOverdue(r: Requirement, today = todayStr()) {
  return (
    !!r.due_date &&
    r.due_date < today &&
    (r.status === 'pending' || r.status === 'in-progress')
  );
}

// ── Card ─────────────────────────────────────────────────────────────

function SoftwareBadge({ value, size }: { value: string; size?: 'sm' | 'md' }) {
  const sw = softwareOf(value);
  if (!sw) return null;
  return (
    <Badge color={sw.color} bg={sw.bg} border={sw.border} size={size}>
      {sw.label}
    </Badge>
  );
}

function RequirementCard({
  req,
  onClick,
  dense = false,
}: {
  req: Requirement;
  onClick: () => void;
  dense?: boolean;
}) {
  const st = reqmtStatusOf(req.status);
  const pr = priStyle[req.priority] ?? priStyle.medium;
  const overdue = isOverdue(req);
  return (
    <div
      onClick={onClick}
      className="bg-white cursor-pointer transition-all duration-150 hover:shadow-md"
      style={{
        border: `1px solid ${T.border}`,
        borderRadius: dense ? 8 : 12,
        padding: dense ? '12px 14px' : '14px 18px',
        marginBottom: 10,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        borderLeft: '3px solid',
        borderLeftColor: pr.color,
      }}
    >
      <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
        <span className="font-mono text-[11px] text-text-muted">{req.id.slice(0, 8)}</span>
        <span className="flex-1 text-sm font-semibold text-text min-w-[120px] truncate">
          {firstLine(req.content)}
        </span>
        <SoftwareBadge value={req.software} size="sm" />
        <Badge color={pr.color} bg={pr.bg} border={pr.border} size="sm">
          {pr.label}
        </Badge>
        <Badge color={st.color} bg={st.bg} border={st.border} size="sm">
          {st.label}
        </Badge>
      </div>
      <div className="text-xs text-text-muted flex gap-x-4 gap-y-1 flex-wrap">
        {req.submitted_date && <span>提出：{req.submitted_date}</span>}
        {req.target_version && <span className="font-mono">版本：{req.target_version}</span>}
        {req.assignee && <span>負責：{req.assignee}</span>}
        {req.dev_id && <span className="font-mono">{req.dev_id}</span>}
        {req.due_date && (
          <span
            className={overdue ? 'font-bold' : undefined}
            style={overdue ? { color: T.red } : undefined}
          >
            預計完成：{req.due_date}
            {overdue && '（逾期）'}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Detail ───────────────────────────────────────────────────────────

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 text-[13px]">
      <span className="text-text-muted w-20 flex-shrink-0">{label}</span>
      <span className="text-text flex-1 whitespace-pre-wrap break-words">
        {children || <span className="text-text-muted">—</span>}
      </span>
    </div>
  );
}

function RequirementDetail({
  req,
  onBack,
  canManage,
  onEdit,
  onDelete,
  dense = false,
}: {
  req: Requirement;
  onBack: () => void;
  canManage?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  dense?: boolean;
}) {
  const st = reqmtStatusOf(req.status);
  const pr = priStyle[req.priority] ?? priStyle.medium;
  const sw = softwareOf(req.software);
  const overdue = isOverdue(req);
  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[13px] font-semibold text-accent bg-transparent border-0 cursor-pointer pb-3.5"
      >
        ← 返回{dense ? '' : '列表'}
      </button>
      <div
        className="bg-white"
        style={{
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          padding: dense ? 16 : 24,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}
      >
        <div className="flex flex-wrap items-center gap-2.5 mb-3">
          <span className="font-mono text-[11px] text-text-muted">{req.id}</span>
          <SoftwareBadge value={req.software} />
          <Badge color={pr.color} bg={pr.bg} border={pr.border}>
            優先：{pr.label}
          </Badge>
          <Badge color={st.color} bg={st.bg} border={st.border}>
            {st.label}
          </Badge>
          {overdue && (
            <Badge color={T.red} bg={T.redBg} border={T.redBorder}>
              逾期
            </Badge>
          )}
          {canManage && (
            <div className="ml-auto flex gap-2">
              <button
                onClick={onEdit}
                className="px-3 py-1 text-xs font-bold text-accent rounded-[8px] cursor-pointer"
                style={{ background: T.accentBg, border: `1px solid ${T.accentBorder}` }}
              >
                ✏️ 編輯
              </button>
              <button
                onClick={onDelete}
                className="px-3 py-1 text-xs font-bold text-red rounded-[8px] cursor-pointer"
                style={{ background: T.redBg, border: `1px solid ${T.redBorder}` }}
              >
                刪除
              </button>
            </div>
          )}
        </div>

        <div
          className={`${dense ? 'text-sm' : 'text-base'} text-text leading-[1.7] p-4 bg-bg rounded-[8px] whitespace-pre-wrap mb-4`}
          style={{ border: `1px solid ${T.border}` }}
        >
          {req.content || '（沒有內容）'}
        </div>

        <div className={`grid gap-x-6 gap-y-2 ${dense ? 'grid-cols-1' : 'grid-cols-2'}`}>
          <DetailRow label="提出日期">{req.submitted_date}</DetailRow>
          <DetailRow label="優先程度">{pr.label}</DetailRow>
          <DetailRow label="版本">{req.target_version}</DetailRow>
          <DetailRow label="軟體">{sw?.label}</DetailRow>
          <DetailRow label="進度">{st.label}</DetailRow>
          <DetailRow label="負責人">{req.assignee}</DetailRow>
          <DetailRow label="開發編號">{req.dev_id}</DetailRow>
          <DetailRow label="預計完成日">
            {req.due_date && (
              <span style={overdue ? { color: T.red, fontWeight: 700 } : undefined}>
                {req.due_date}
                {overdue && '（逾期）'}
              </span>
            )}
          </DetailRow>
        </div>
        <div
          className="mt-4 pt-3 flex gap-4 text-[11px] text-text-muted"
          style={{ borderTop: `1px solid ${T.borderLight}` }}
        >
          <span>建立：{formatDate(req.created_at)}</span>
          <span>更新：{formatDate(req.updated_at)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Create / Edit modal (manager+) ───────────────────────────────────

const INPUT_CLS =
  'w-full text-[13px] text-text rounded-[8px] px-3 py-2 outline-none bg-white';
const inputStyle = { border: `1px solid ${T.border}` } as const;

function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-bold text-text-muted uppercase tracking-[0.5px] mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}

/** 畫面上可編輯的 9 個欄位（舊欄位如提出人員、類型不再顯示，也不會被送出覆寫） */
type FormState = Required<
  Pick<
    RequirementInput,
    | 'content'
    | 'submitted_date'
    | 'priority'
    | 'target_version'
    | 'software'
    | 'status'
    | 'assignee'
    | 'dev_id'
    | 'due_date'
  >
>;

function initialForm(r?: Requirement): FormState {
  return {
    content: r?.content ?? '',
    submitted_date: r?.submitted_date ?? (r ? '' : todayStr()),
    priority: r?.priority ?? 'medium',
    target_version: r?.target_version ?? '',
    software: r?.software ?? '',
    status: r?.status ?? 'pending',
    assignee: r?.assignee ?? '',
    dev_id: r?.dev_id ?? '',
    due_date: r?.due_date ?? '',
  };
}

function RequirementFormModal({
  mode,
  initial,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit';
  initial?: Requirement;
  onClose: () => void;
  onSaved: (req: Requirement) => void;
}) {
  const [orig] = useState<FormState>(() => initialForm(initial));
  const [form, setForm] = useState<FormState>(orig);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // 舊資料的日期可能不是 YYYY-MM-DD（date 欄位顯示不出來）—— 提示原值，未修改就不會覆寫。
  const badSubmitted = mode === 'edit' && !!orig.submitted_date && !ISO_DATE.test(orig.submitted_date);
  const legacyStatus = !(STATUS_ORDER as string[]).includes(orig.status);

  const submit = async () => {
    if (!form.content.trim()) {
      setError('「需求標題」為必填。');
      return;
    }
    let payload: RequirementInput = form;
    if (mode === 'edit') {
      // 只送有改動的欄位，避免把畫面上沒顯示的舊值（或格式不符的日期）覆寫掉
      payload = Object.fromEntries(
        (Object.keys(form) as (keyof FormState)[])
          .filter((k) => form[k] !== orig[k])
          .map((k) => [k, form[k]])
      ) as RequirementInput;
      if (Object.keys(payload).length === 0) {
        onClose();
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      const saved =
        mode === 'create'
          ? await createRequirement(payload)
          : await updateRequirement(initial!.id, payload);
      onSaved(saved);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.45)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[14px] w-full max-w-[640px] max-h-[88vh] overflow-y-auto"
        style={{ boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-3.5 sticky top-0 bg-white"
          style={{ borderBottom: `1px solid ${T.border}` }}
        >
          <span className="text-[15px] font-bold text-text">
            {mode === 'create' ? '新增需求' : '編輯需求'}
          </span>
          <button
            onClick={onClose}
            className="text-text-muted text-lg cursor-pointer bg-transparent border-0 leading-none"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3.5">
          <Labeled label="需求標題（內容） *">
            <textarea
              className={INPUT_CLS}
              style={{ ...inputStyle, minHeight: 96, resize: 'vertical' }}
              value={form.content}
              onChange={(e) => set('content', e.target.value)}
              placeholder="描述需求內容…"
            />
          </Labeled>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Labeled label="軟體">
              <select
                className={INPUT_CLS}
                style={inputStyle}
                value={form.software}
                onChange={(e) => set('software', e.target.value as Software | '')}
              >
                <option value="">（未指定）</option>
                {SOFTWARE_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {softwareStyle[s].label}
                  </option>
                ))}
              </select>
            </Labeled>
            <Labeled label="優先程度">
              <select
                className={INPUT_CLS}
                style={inputStyle}
                value={form.priority}
                onChange={(e) => set('priority', e.target.value as Priority)}
              >
                {PRIORITY_ORDER.map((p) => (
                  <option key={p} value={p}>
                    {priStyle[p].label}
                  </option>
                ))}
              </select>
            </Labeled>
            <Labeled label="進度">
              <select
                className={INPUT_CLS}
                style={inputStyle}
                value={form.status}
                onChange={(e) => set('status', e.target.value as ReqStatus)}
              >
                {legacyStatus && (
                  <option value={orig.status} disabled>
                    {reqmtStatusOf(orig.status).label}
                  </option>
                )}
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {reqmtStatusStyle[s].label}
                  </option>
                ))}
              </select>
            </Labeled>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Labeled label="提出日期">
              <input
                type="date"
                className={INPUT_CLS}
                style={inputStyle}
                value={ISO_DATE.test(form.submitted_date) ? form.submitted_date : ''}
                onChange={(e) => set('submitted_date', e.target.value)}
              />
              {badSubmitted && form.submitted_date === orig.submitted_date && (
                <span className="block text-[11px] mt-1" style={{ color: T.amber }}>
                  原值「{orig.submitted_date}」格式不正確；不修改就會保留原值。
                </span>
              )}
            </Labeled>
            <Labeled label="版本">
              <input
                className={INPUT_CLS}
                style={inputStyle}
                value={form.target_version}
                onChange={(e) => set('target_version', e.target.value)}
                placeholder="例如 1.8.3.0"
              />
            </Labeled>
            <Labeled label="負責人">
              <input
                className={INPUT_CLS}
                style={inputStyle}
                value={form.assignee}
                onChange={(e) => set('assignee', e.target.value)}
              />
            </Labeled>
            <Labeled label="開發編號（JIRA）">
              <input
                className={INPUT_CLS}
                style={inputStyle}
                value={form.dev_id}
                onChange={(e) => set('dev_id', e.target.value)}
              />
            </Labeled>
            <Labeled label="預計完成日">
              <input
                type="date"
                className={INPUT_CLS}
                style={inputStyle}
                value={form.due_date}
                onChange={(e) => set('due_date', e.target.value)}
              />
            </Labeled>
          </div>

          {error && <div className="text-xs text-red font-semibold">{error}</div>}
        </div>

        <div
          className="flex justify-end gap-2 px-5 py-3.5 sticky bottom-0 bg-white"
          style={{ borderTop: `1px solid ${T.border}` }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] font-semibold text-text-sec rounded-[8px] cursor-pointer bg-white"
            style={{ border: `1px solid ${T.border}` }}
          >
            取消
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="px-4 py-2 text-[13px] font-bold text-white bg-primary rounded-[8px] cursor-pointer border-0 disabled:opacity-60"
          >
            {saving ? '儲存中…' : mode === 'create' ? '建立' : '儲存'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Shared list logic ────────────────────────────────────────────────

type ModalState = { mode: 'create' | 'edit'; req?: Requirement } | null;

function matchReq(r: Requirement, q: string) {
  const s = q.toLowerCase();
  return [r.content, r.id, r.assignee, r.dev_id, r.target_version]
    .filter(Boolean)
    .some((v) => v.toLowerCase().includes(s));
}

const matchSoftware = (r: Requirement, f: SoftwareFilter) =>
  f === 'all' ? true : f === 'unset' ? !softwareOf(r.software) : r.software === f;

// ── Sorting ──────────────────────────────────────────────────────────

type SortKey = 'priority' | 'submitted' | 'due' | 'updated';
type SortDir = 'asc' | 'desc';

const SORT_LABEL: Record<SortKey, string> = {
  priority: '優先程度',
  submitted: '提出日期',
  due: '預計完成日',
  updated: '更新日期',
};
const SORT_KEYS = Object.keys(SORT_LABEL) as SortKey[];
const PRIORITY_RANK: Record<Priority, number> = { high: 3, medium: 2, low: 1 };

// 方向標籤依排序欄位而異（優先序講高低，完成日講早晚，其餘講新舊）。
const dirLabel = (key: SortKey, dir: SortDir) => {
  if (key === 'priority') return dir === 'desc' ? '高 → 低' : '低 → 高';
  if (key === 'due') return dir === 'asc' ? '早 → 晚' : '晚 → 早';
  return dir === 'desc' ? '新 → 舊' : '舊 → 新';
};

const dateOf = (r: Requirement, key: Exclude<SortKey, 'priority'>) =>
  key === 'submitted' ? r.submitted_date : key === 'due' ? r.due_date : r.updated_at;

/** 依欄位排序；未填日期的一律排最後，不受升冪/降冪影響。 */
function sortReqs(list: Requirement[], key: SortKey, dir: SortDir): Requirement[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => {
    if (key === 'priority') {
      const d = (PRIORITY_RANK[a.priority] ?? 0) - (PRIORITY_RANK[b.priority] ?? 0);
      // 同優先序時，以最近更新者優先
      return d !== 0 ? d * sign : (b.updated_at || '').localeCompare(a.updated_at || '');
    }
    const av = dateOf(a, key);
    const bv = dateOf(b, key);
    if (!av && !bv) return 0;
    if (!av) return 1;
    if (!bv) return -1;
    // 日期為 YYYY-MM-DD、updated_at 為 ISO 8601，皆可字典序比較
    return av.localeCompare(bv) * sign;
  });
}

function SortControl({
  sortKey,
  sortDir,
  onKey,
  onDir,
  compact = false,
}: {
  sortKey: SortKey;
  sortDir: SortDir;
  onKey: (k: SortKey) => void;
  onDir: (d: SortDir) => void;
  compact?: boolean;
}) {
  const size = compact ? 'text-[11px]' : 'text-xs';
  return (
    <div className="flex items-center gap-1.5">
      <select
        value={sortKey}
        onChange={(e) => {
          const k = e.target.value as SortKey;
          onKey(k);
          // 預計完成日通常想看「最近要到期的」，切換時預設早 → 晚
          if (k === 'due') onDir('asc');
        }}
        aria-label="排序依據"
        className={`${size} font-semibold text-text-sec rounded-[6px] bg-white outline-none cursor-pointer ${
          compact ? 'px-1.5 py-1' : 'px-2 py-1'
        }`}
        style={{ border: `1px solid ${T.border}` }}
      >
        {SORT_KEYS.map((k) => (
          <option key={k} value={k}>
            排序：{SORT_LABEL[k]}
          </option>
        ))}
      </select>
      <button
        onClick={() => onDir(sortDir === 'asc' ? 'desc' : 'asc')}
        title="切換排序方向"
        className={`${size} font-semibold text-text-sec rounded-[6px] bg-white cursor-pointer whitespace-nowrap ${
          compact ? 'px-1.5 py-1' : 'px-2 py-1'
        }`}
        style={{ border: `1px solid ${T.border}` }}
      >
        {sortDir === 'desc' ? '↓' : '↑'} {dirLabel(sortKey, sortDir)}
      </button>
    </div>
  );
}

// ── Desktop ──────────────────────────────────────────────────────────

function RequirementsDesktop({ onNav, onLogout, isAdmin, isManager, onAdminClick }: Props) {
  const [statusF, setStatusF] = useState<'all' | ReqStatus>('all');
  const [priorityF, setPriorityF] = useState<'all' | Priority>('all');
  const [softwareF, setSoftwareF] = useState<SoftwareFilter>('all');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('updated');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selected, setSelected] = useState<Requirement | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const { data, loading, error, reload } = useApi<Requirement[]>(
    (signal) => fetchRequirements({}, signal),
    []
  );
  const reqs = data ?? [];

  const overdueCount = useMemo(() => {
    const today = todayStr();
    return reqs.filter((r) => isOverdue(r, today)).length;
  }, [reqs]);
  const unsetCount = useMemo(() => reqs.filter((r) => !softwareOf(r.software)).length, [reqs]);

  const stats = useMemo(
    () => [
      { label: '全部', val: reqs.length, color: T.text },
      { label: '未評估', val: reqs.filter((r) => r.status === 'pending').length, color: T.amber },
      {
        label: '進行中',
        val: reqs.filter((r) => r.status === 'in-progress').length,
        color: T.purple,
      },
      { label: '已完成', val: reqs.filter((r) => r.status === 'done').length, color: T.green },
      { label: '逾期', val: overdueCount, color: T.red },
    ],
    [reqs, overdueCount]
  );

  const filtered = useMemo(() => {
    const today = todayStr();
    let base = reqs;
    if (statusF !== 'all') base = base.filter((r) => r.status === statusF);
    if (priorityF !== 'all') base = base.filter((r) => r.priority === priorityF);
    if (softwareF !== 'all') base = base.filter((r) => matchSoftware(r, softwareF));
    if (overdueOnly) base = base.filter((r) => isOverdue(r, today));
    const q = query.trim();
    if (q) base = base.filter((r) => matchReq(r, q));
    return sortReqs(base, sortKey, sortDir);
  }, [reqs, statusF, priorityF, softwareF, overdueOnly, query, sortKey, sortDir]);

  const handleSearch = (q: string) => {
    setQuery(q);
    if (selected) setSelected(null);
  };

  const handleDelete = async (req: Requirement) => {
    if (!window.confirm(`確定刪除此需求？\n\n${firstLine(req.content)}`)) return;
    await deleteRequirement(req.id);
    setSelected(null);
    reload();
  };

  const count = (n: number) => <span className="text-[11px] text-text-muted">{n}</span>;

  return (
    <div className="w-full h-full flex flex-col bg-bg">
      <TopBar />
      <NavHeader
        active="requirements"
        onNav={onNav}
        onSearch={handleSearch}
        onLogout={onLogout}
        isAdmin={isAdmin}
        onAdminClick={onAdminClick}
      />
      <div
        className="bg-white px-6 py-2.5 flex gap-3 flex-shrink-0 items-center"
        style={{ borderBottom: `1px solid ${T.border}` }}
      >
        {stats.map((s, i) => (
          <div
            key={s.label}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg"
            style={{
              background: i === 0 ? T.bg : T.surface,
              border: `1px solid ${i === 0 ? T.border : T.borderLight}`,
            }}
          >
            <div className="text-xl font-extrabold leading-none" style={{ color: s.color }}>
              {s.val}
            </div>
            <div className="text-xs text-text-sec font-medium">{s.label}</div>
          </div>
        ))}
        {isManager && (
          <button
            onClick={() => setModal({ mode: 'create' })}
            className="ml-auto flex items-center gap-1.5 px-4 py-[7px] bg-primary text-white border-0 rounded-[8px] text-[13px] font-bold cursor-pointer"
          >
            + 新增需求
          </button>
        )}
      </div>
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-[200px] bg-white border-r border-border px-2.5 py-4 flex-shrink-0 overflow-y-auto">
          <SidebarLabel>進度</SidebarLabel>
          <SidebarItem active={statusF === 'all'} onClick={() => setStatusF('all')}>
            全部
          </SidebarItem>
          {STATUS_ORDER.map((s) => (
            <SidebarItem
              key={s}
              active={statusF === s}
              onClick={() => setStatusF(s)}
              dotColor={reqmtStatusStyle[s].color}
            >
              {reqmtStatusStyle[s].label}
            </SidebarItem>
          ))}
          <SidebarItem
            active={overdueOnly}
            onClick={() => setOverdueOnly((v) => !v)}
            dotColor={T.red}
            activeBg={T.redBg}
            activeBorder={T.redBorder}
            activeColor={T.red}
            trailing={count(overdueCount)}
          >
            只看逾期
          </SidebarItem>
          <div className="h-px my-3" style={{ background: T.border }} />
          <SidebarLabel>軟體</SidebarLabel>
          <SidebarItem active={softwareF === 'all'} onClick={() => setSoftwareF('all')}>
            全部
          </SidebarItem>
          {SOFTWARE_ORDER.map((s) => (
            <SidebarItem
              key={s}
              active={softwareF === s}
              onClick={() => setSoftwareF(s)}
              dotColor={softwareStyle[s].color}
              trailing={count(reqs.filter((r) => r.software === s).length)}
            >
              {softwareStyle[s].label}
            </SidebarItem>
          ))}
          {unsetCount > 0 && (
            <SidebarItem
              active={softwareF === 'unset'}
              onClick={() => setSoftwareF('unset')}
              trailing={count(unsetCount)}
            >
              未指定
            </SidebarItem>
          )}
          <div className="h-px my-3" style={{ background: T.border }} />
          <SidebarLabel>優先程度</SidebarLabel>
          <SidebarItem active={priorityF === 'all'} onClick={() => setPriorityF('all')}>
            全部
          </SidebarItem>
          {PRIORITY_ORDER.map((p) => (
            <SidebarItem
              key={p}
              active={priorityF === p}
              onClick={() => setPriorityF(p)}
              dotColor={priStyle[p].color}
            >
              {priStyle[p].label}
            </SidebarItem>
          ))}
        </aside>
        <main className="flex-1 overflow-y-auto px-6 py-5">
          {loading && <LoadingState />}
          {error && <ErrorState message={error} onRetry={reload} />}
          {!loading && !error && (
            selected ? (
              <RequirementDetail
                req={selected}
                onBack={() => setSelected(null)}
                canManage={isManager}
                onEdit={() => setModal({ mode: 'edit', req: selected })}
                onDelete={() => handleDelete(selected)}
              />
            ) : (
              <>
                <div className="flex items-center justify-between gap-3 mb-3.5">
                  <span className="text-[17px] font-bold text-text">需求管理</span>
                  <div className="flex items-center gap-2.5">
                    <SortControl
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onKey={setSortKey}
                      onDir={setSortDir}
                    />
                    <span className="text-xs text-text-muted whitespace-nowrap">
                      {filtered.length} 筆
                    </span>
                  </div>
                </div>
                {filtered.length === 0 ? (
                  <EmptyState
                    title={query ? `找不到「${query}」的相關需求` : '目前沒有需求'}
                    hint={
                      query
                        ? '請嘗試不同的關鍵字。'
                        : isManager
                        ? '可由右上角「新增需求」開始建立。'
                        : '此篩選條件下沒有資料。'
                    }
                  />
                ) : (
                  filtered.map((req) => (
                    <RequirementCard key={req.id} req={req} onClick={() => setSelected(req)} />
                  ))
                )}
              </>
            )
          )}
        </main>
      </div>

      {modal && (
        <RequirementFormModal
          mode={modal.mode}
          initial={modal.req}
          onClose={() => setModal(null)}
          onSaved={(saved) => {
            setModal(null);
            if (selected && selected.id === saved.id) setSelected(saved);
            reload();
          }}
        />
      )}
    </div>
  );
}

// ── Mobile ───────────────────────────────────────────────────────────

function RequirementsMobile({ onNav, onLogout, isAdmin, isManager, onAdminClick }: Props) {
  const [statusF, setStatusF] = useState<'all' | ReqStatus | 'overdue'>('all');
  const [softwareF, setSoftwareF] = useState<SoftwareFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('updated');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selected, setSelected] = useState<Requirement | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const { data, loading, error, reload } = useApi<Requirement[]>(
    (signal) => fetchRequirements({}, signal),
    []
  );
  const reqs = data ?? [];

  const filtered = useMemo(() => {
    const today = todayStr();
    let base = reqs;
    if (statusF === 'overdue') base = base.filter((r) => isOverdue(r, today));
    else if (statusF !== 'all') base = base.filter((r) => r.status === statusF);
    if (softwareF !== 'all') base = base.filter((r) => matchSoftware(r, softwareF));
    return sortReqs(base, sortKey, sortDir);
  }, [reqs, statusF, softwareF, sortKey, sortDir]);

  const renderResult = {
    match: (item: Requirement, q: string) => matchReq(item, q),
    render: (item: Requirement, i: number, onClose: () => void) => (
      <RequirementCard
        key={`s-${i}`}
        req={item}
        onClick={() => {
          setSelected(item);
          onClose();
        }}
        dense
      />
    ),
  };

  const handleDelete = async (req: Requirement) => {
    if (!window.confirm(`確定刪除此需求？\n\n${firstLine(req.content)}`)) return;
    await deleteRequirement(req.id);
    setSelected(null);
    reload();
  };

  const chips: { key: 'all' | ReqStatus | 'overdue'; label: string }[] = [
    { key: 'all', label: '全部' },
    ...STATUS_ORDER.map((s) => ({ key: s, label: reqmtStatusStyle[s].label })),
    { key: 'overdue', label: '逾期' },
  ];

  return (
    <div className="w-full h-full flex flex-col bg-bg font-sans relative">
      <TopBar />
      <NavHeader
        active="requirements"
        onNav={onNav}
        onLogout={onLogout}
        isAdmin={isAdmin}
        onAdminClick={onAdminClick}
        mobile
      />
      <MobileSearchOverlay
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        placeholder="搜尋需求內容、負責人、JIRA、版本…"
        data={reqs}
        renderResult={renderResult}
      />
      {selected ? (
        <main className="flex-1 overflow-y-auto px-3.5 pb-20 pt-3.5">
          <RequirementDetail
            req={selected}
            onBack={() => setSelected(null)}
            canManage={isManager}
            onEdit={() => setModal({ mode: 'edit', req: selected })}
            onDelete={() => handleDelete(selected)}
            dense
          />
        </main>
      ) : (
        <>
          <div
            className="bg-white px-3.5 py-2.5 flex gap-1.5 overflow-x-auto flex-shrink-0 no-scrollbar"
            style={{ borderBottom: `1px solid ${T.border}` }}
          >
            {chips.map(({ key, label }) => {
              const isActive = statusF === key;
              const activeColor = key === 'overdue' ? T.red : T.primary;
              return (
                <button
                  key={key}
                  onClick={() => setStatusF(key)}
                  className="rounded-[20px] text-xs font-semibold cursor-pointer whitespace-nowrap transition-all duration-150"
                  style={{
                    padding: '5px 14px',
                    background: isActive ? activeColor : 'white',
                    color: isActive ? 'white' : T.textMuted,
                    border: `1px solid ${isActive ? activeColor : T.border}`,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <main className="flex-1 overflow-y-auto px-3.5 pt-3 pb-20">
            <div className="flex justify-between items-center gap-2 mb-2">
              <span className="text-[15px] font-bold text-text">需求管理</span>
              {isManager && (
                <button
                  onClick={() => setModal({ mode: 'create' })}
                  className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white border-0 rounded-[8px] text-xs font-bold cursor-pointer whitespace-nowrap"
                >
                  + 新增
                </button>
              )}
            </div>
            {/* 軟體篩選與排序獨立一列，避免窄螢幕與標題／新增鈕擠在一起 */}
            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <select
                  value={softwareF}
                  onChange={(e) => setSoftwareF(e.target.value as SoftwareFilter)}
                  aria-label="軟體"
                  className="text-[11px] font-semibold text-text-sec rounded-[6px] bg-white outline-none cursor-pointer px-1.5 py-1"
                  style={{ border: `1px solid ${T.border}` }}
                >
                  <option value="all">軟體：全部</option>
                  {SOFTWARE_ORDER.map((s) => (
                    <option key={s} value={s}>
                      軟體：{softwareStyle[s].label}
                    </option>
                  ))}
                  <option value="unset">軟體：未指定</option>
                </select>
                <SortControl
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onKey={setSortKey}
                  onDir={setSortDir}
                  compact
                />
              </div>
              <span className="text-[11px] text-text-muted whitespace-nowrap">
                {filtered.length} 筆
              </span>
            </div>
            {loading && <LoadingState />}
            {error && <ErrorState message={error} onRetry={reload} />}
            {!loading && !error && filtered.length === 0 && (
              <EmptyState
                title="目前沒有需求"
                hint={
                  statusF === 'all' && softwareF === 'all' ? '尚無需求資料。' : '此篩選下沒有資料。'
                }
              />
            )}
            {!loading &&
              !error &&
              filtered.map((req) => (
                <RequirementCard key={req.id} req={req} onClick={() => setSelected(req)} dense />
              ))}
          </main>
        </>
      )}
      <SearchFAB onOpen={() => setSearchOpen(true)} />
      <MobileNav active="requirements" onNav={onNav} />

      {modal && (
        <RequirementFormModal
          mode={modal.mode}
          initial={modal.req}
          onClose={() => setModal(null)}
          onSaved={(saved) => {
            setModal(null);
            if (selected && selected.id === saved.id) setSelected(saved);
            reload();
          }}
        />
      )}
    </div>
  );
}

export default function Requirements(props: Props) {
  const isMobile = useIsMobile();
  return isMobile ? <RequirementsMobile {...props} /> : <RequirementsDesktop {...props} />;
}
