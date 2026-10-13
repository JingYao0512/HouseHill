import { useState, useMemo } from 'react';
import { TopBar } from '../components/TopBar';
import { NavHeader } from '../components/NavHeader';
import { MobileNav } from '../components/MobileNav';
import { SearchFAB } from '../components/SearchFAB';
import { MobileSearchOverlay } from '../components/MobileSearchOverlay';
import { SidebarLabel, SidebarItem } from '../components/Sidebar';
import { LoadingState, EmptyState, ErrorState } from '../components/States';
import { Badge } from '../components/Badge';
import { T, sevStyle, statStyle, type Severity, type IssueStatus } from '../tokens';
import {
  fetchIssues,
  updateIssueStatus,
  addIssueComment,
  fetchIssueAttachments,
  deleteIssueAttachment,
  issueAttachmentUrl,
  ApiError,
  type Issue,
  type ArticleAttachment,
} from '../api';
import { useApi } from '../hooks/useApi';
import type { PageId } from '../types';
import { useIsMobile } from '../hooks/useMediaQuery';

const MONO = "'JetBrains Mono',monospace";

interface Props {
  onNav: (id: PageId) => void;
  onCreate: () => void;
  onLogout?: () => void;
  isAdmin?: boolean;
  isManager?: boolean;
  onAdminClick?: () => void;
}

type Filter = 'all' | IssueStatus | Severity;
type ViewMode = 'card' | 'grid' | 'list';

const VIEWS: { id: ViewMode; label: string }[] = [
  { id: 'card', label: '卡片' },
  { id: 'grid', label: '方格' },
  { id: 'list', label: '列表' },
];

const formatDate = (iso: string) => (iso ? iso.slice(0, 10) : '');
const shortId = (id: string) => id.slice(0, 8);
const clamp = (n: number) =>
  ({
    display: '-webkit-box',
    WebkitLineClamp: n,
    WebkitBoxOrient: 'vertical' as const,
    overflow: 'hidden',
  }) as React.CSSProperties;

/** 檢視模式記在 localStorage，桌機與手機各記一份（設計稿指定）。 */
function useIssueView(key: string): [ViewMode, (v: ViewMode) => void] {
  const [v, setV] = useState<ViewMode>(() => {
    try {
      const s = localStorage.getItem(key);
      return s === 'card' || s === 'grid' || s === 'list' ? s : 'card';
    } catch {
      return 'card';
    }
  });
  const set = (x: ViewMode) => {
    setV(x);
    try {
      localStorage.setItem(key, x);
    } catch {
      /* 無痕模式等情境忽略 */
    }
  };
  return [v, set];
}

const HoverCss = () => (
  <style>
    {'.hh-issue-row:hover{background:#f8fafc}.hh-issue-tile{transition:box-shadow .15s,transform .15s}.hh-issue-tile:hover{box-shadow:0 4px 12px rgba(0,0,0,0.08);transform:translateY(-1px)}'}
  </style>
);

function ViewIcon({ mode }: { mode: ViewMode }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      {mode === 'card' && (
        <>
          <rect x="3" y="4" width="18" height="7" rx="1.5" />
          <rect x="3" y="13" width="18" height="7" rx="1.5" />
        </>
      )}
      {mode === 'grid' && (
        <>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </>
      )}
      {mode === 'list' && <path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01" />}
    </svg>
  );
}

function ViewToggle({
  value,
  onChange,
  compact,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
  compact?: boolean;
}) {
  return (
    <div
      className="flex"
      style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: 2, gap: 2 }}
    >
      {VIEWS.map((o) => {
        const on = value === o.id;
        return (
          <button
            key={o.id}
            title={o.label}
            onClick={() => onChange(o.id)}
            className="flex items-center justify-center gap-[5px] border-0 text-xs font-semibold cursor-pointer font-sans transition-all duration-150"
            style={{
              padding: compact ? '6px 9px' : '5px 10px',
              minWidth: compact ? 32 : 0,
              borderRadius: 6,
              background: on ? T.surface : 'transparent',
              boxShadow: on ? T.shadow : 'none',
              color: on ? T.text : T.textMuted,
            }}
          >
            <ViewIcon mode={o.id} />
            {!compact && o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── 卡片 ─────────────────────────────────────────────────────────────

function IssueCard({
  issue,
  onClick,
  mobile,
}: {
  issue: Issue;
  onClick: () => void;
  mobile?: boolean;
}) {
  const sev = sevStyle[issue.severity];
  const stat = statStyle[issue.status];

  if (mobile) {
    return (
      <div
        className="hh-issue-tile cursor-pointer"
        onClick={onClick}
        style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: T.radiusSm,
          padding: '12px 14px',
          boxShadow: T.shadow,
          borderLeft: `3px solid ${sev.color}`,
          marginBottom: 10,
        }}
      >
        <div className="flex items-center justify-between mb-1.5">
          <span style={{ fontFamily: MONO, fontSize: 11, color: T.textMuted }}>
            {shortId(issue.id)}
          </span>
          <div className="flex gap-[5px]">
            <Badge color={sev.color} bg={sev.bg} border={sev.border}>
              {sev.label}
            </Badge>
            <Badge color={stat.color} bg={stat.bg} border={stat.border}>
              {stat.label}
            </Badge>
          </div>
        </div>
        <div className="text-sm font-semibold text-text mb-1">{issue.title}</div>
        <div className="text-[11px]" style={{ color: T.textMuted }}>
          {formatDate(issue.updated_at)}
        </div>
      </div>
    );
  }

  return (
    <div
      className="hh-issue-tile cursor-pointer"
      onClick={onClick}
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: T.radius,
        padding: '14px 18px',
        boxShadow: T.shadow,
        borderLeft: `3px solid ${sev.color}`,
        marginBottom: 10,
      }}
    >
      <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
        <span style={{ fontFamily: MONO, fontSize: 11, color: T.textMuted }}>
          {shortId(issue.id)}
        </span>
        <span className="flex-1 text-sm font-semibold text-text" style={{ minWidth: 120 }}>
          {issue.title}
        </span>
        <Badge color={sev.color} bg={sev.bg} border={sev.border}>
          {sev.label}
        </Badge>
        <Badge color={stat.color} bg={stat.bg} border={stat.border}>
          {stat.label}
        </Badge>
      </div>
      <div className="text-xs flex gap-4 flex-wrap" style={{ color: T.textMuted }}>
        {issue.related_config_key && (
          <span style={{ fontFamily: MONO }}>參數：{issue.related_config_key}</span>
        )}
        <span>建立：{formatDate(issue.created_at)}</span>
        <span>更新：{formatDate(issue.updated_at)}</span>
      </div>
    </div>
  );
}

// ── 方格 ─────────────────────────────────────────────────────────────

function IssueSquare({
  issue,
  onClick,
  mobile,
}: {
  issue: Issue;
  onClick: () => void;
  mobile?: boolean;
}) {
  const sev = sevStyle[issue.severity];
  const stat = statStyle[issue.status];
  return (
    <div
      className="hh-issue-tile cursor-pointer flex flex-col"
      onClick={onClick}
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderTop: `3px solid ${sev.color}`,
        borderRadius: mobile ? T.radiusSm : T.radius,
        padding: mobile ? 12 : '16px 18px',
        boxShadow: T.shadow,
        aspectRatio: '1 / 1',
        minWidth: 0,
      }}
    >
      <div className="flex items-center justify-between gap-1.5">
        <span style={{ fontFamily: MONO, fontSize: mobile ? 10 : 11, color: T.textMuted }}>
          {shortId(issue.id)}
        </span>
        <Badge color={sev.color} bg={sev.bg} border={sev.border}>
          {sev.label}
        </Badge>
      </div>
      <div
        className="font-bold text-text"
        style={{
          fontSize: mobile ? 13 : 15,
          lineHeight: 1.4,
          marginTop: mobile ? 8 : 12,
          ...clamp(mobile ? 3 : 2),
        }}
      >
        {issue.title}
      </div>
      {!mobile && (
        <div
          style={{ fontSize: 12, color: T.textSec, lineHeight: 1.6, marginTop: 6, ...clamp(3) }}
        >
          {issue.description}
        </div>
      )}
      <div
        className="flex justify-between"
        style={{
          marginTop: 'auto',
          paddingTop: mobile ? 8 : 10,
          borderTop: `1px solid ${T.borderLight}`,
          flexDirection: mobile ? 'column' : 'row',
          alignItems: mobile ? 'flex-start' : 'center',
          gap: mobile ? 5 : 6,
        }}
      >
        <Badge color={stat.color} bg={stat.bg} border={stat.border}>
          {stat.label}
        </Badge>
        <span
          className="text-[11px] whitespace-nowrap overflow-hidden text-ellipsis max-w-full"
          style={{ color: T.textMuted }}
        >
          {formatDate(issue.updated_at).slice(5)}
        </span>
      </div>
    </div>
  );
}

// ── 列表 ─────────────────────────────────────────────────────────────

function IssueTable({
  items,
  onSelect,
  mobile,
}: {
  items: Issue[];
  onSelect: (i: Issue) => void;
  mobile?: boolean;
}) {
  if (mobile) {
    return (
      <div
        style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: T.radiusSm,
          overflow: 'hidden',
          boxShadow: T.shadow,
        }}
      >
        {items.map((issue, i) => {
          const sev = sevStyle[issue.severity];
          const stat = statStyle[issue.status];
          return (
            <div
              key={issue.id}
              className="hh-issue-row flex items-center gap-2.5 cursor-pointer"
              onClick={() => onSelect(issue)}
              style={{
                padding: '11px 12px',
                borderBottom: i < items.length - 1 ? `1px solid ${T.borderLight}` : 'none',
                minHeight: 52,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: sev.color,
                  flexShrink: 0,
                }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-text whitespace-nowrap overflow-hidden text-ellipsis">
                  {issue.title}
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: T.textMuted }}>
                  <span style={{ fontFamily: MONO }}>{shortId(issue.id)}</span> ·{' '}
                  {formatDate(issue.updated_at)}
                </div>
              </div>
              <Badge color={stat.color} bg={stat.bg} border={stat.border}>
                {stat.label}
              </Badge>
            </div>
          );
        })}
      </div>
    );
  }

  const COLS = '84px minmax(0,1fr) 64px 76px 110px';
  return (
    <div
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: T.radius,
        overflow: 'hidden',
        boxShadow: T.shadow,
      }}
    >
      <div
        className="grid text-[11px] font-bold uppercase"
        style={{
          gridTemplateColumns: COLS,
          gap: 12,
          padding: '9px 16px',
          background: T.bg,
          borderBottom: `1px solid ${T.border}`,
          color: T.textMuted,
          letterSpacing: '0.5px',
        }}
      >
        <span>編號</span>
        <span>標題</span>
        <span>嚴重度</span>
        <span>狀態</span>
        <span>更新日期</span>
      </div>
      {items.map((issue, i) => {
        const sev = sevStyle[issue.severity];
        const stat = statStyle[issue.status];
        return (
          <div
            key={issue.id}
            className="hh-issue-row grid items-center cursor-pointer"
            onClick={() => onSelect(issue)}
            style={{
              gridTemplateColumns: COLS,
              gap: 12,
              padding: '11px 16px',
              borderBottom: i < items.length - 1 ? `1px solid ${T.borderLight}` : 'none',
            }}
          >
            <span style={{ fontFamily: MONO, fontSize: 11, color: T.textMuted }}>
              {shortId(issue.id)}
            </span>
            <span className="flex items-center gap-2 min-w-0">
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: sev.color,
                  flexShrink: 0,
                }}
              />
              <span className="text-[13px] font-semibold text-text truncate">{issue.title}</span>
            </span>
            <span className="text-[11px] font-semibold" style={{ color: sev.color }}>
              {sev.label}
            </span>
            <Badge color={stat.color} bg={stat.bg} border={stat.border} size="sm">
              {stat.label}
            </Badge>
            <span className="text-[11px]" style={{ color: T.textMuted, fontFamily: MONO }}>
              {formatDate(issue.updated_at)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── 附件 ─────────────────────────────────────────────────────────────

/** 顯示回報附件：圖片給縮圖，其他給下載連結。刪除限 manager 以上。 */
function IssueAttachments({ issueId, canDelete }: { issueId: string; canDelete?: boolean }) {
  const { data, loading, reload } = useApi<ArticleAttachment[]>(
    (signal) => fetchIssueAttachments(issueId, signal),
    [issueId]
  );
  const files = data ?? [];
  if (loading || files.length === 0) return null;

  const remove = async (name: string) => {
    if (!window.confirm(`確定移除附件「${name}」？`)) return;
    try {
      await deleteIssueAttachment(issueId, name);
      reload();
    } catch (e) {
      alert(`移除失敗：${e instanceof ApiError ? e.message : (e as Error).message}`);
    }
  };

  return (
    <div className="mt-4">
      <div className="text-[11px] font-bold mb-2" style={{ color: T.textMuted }}>
        附件 · {files.length}
      </div>
      <div className="flex flex-wrap gap-2">
        {files.map((f) =>
          f.is_image ? (
            <div key={f.name} className="relative" style={{ width: 96, height: 96 }}>
              <a href={issueAttachmentUrl(issueId, f.name)} target="_blank" rel="noreferrer">
                <img
                  src={issueAttachmentUrl(issueId, f.name)}
                  alt={f.name}
                  className="w-full h-full"
                  style={{ objectFit: 'cover', borderRadius: 8, border: `1px solid ${T.border}` }}
                />
              </a>
              {canDelete && (
                <button
                  onClick={() => remove(f.name)}
                  title="移除附件"
                  className="absolute flex items-center justify-center cursor-pointer border-0 text-white"
                  style={{
                    top: 4,
                    right: 4,
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: 'rgba(15,23,42,0.65)',
                    fontSize: 12,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ) : (
            <div
              key={f.name}
              className="flex items-center gap-2"
              style={{
                background: T.surface,
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                padding: '7px 10px',
              }}
            >
              <a
                href={issueAttachmentUrl(issueId, f.name)}
                target="_blank"
                rel="noreferrer"
                className="text-[13px]"
                style={{ color: T.accentStrong }}
              >
                {f.name}
              </a>
              <span className="text-[11px]" style={{ color: T.textMuted }}>
                {f.size_display}
              </span>
              {canDelete && (
                <button
                  onClick={() => remove(f.name)}
                  className="border-0 bg-transparent cursor-pointer text-sm leading-none"
                  style={{ color: T.textMuted }}
                >
                  ×
                </button>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ── 詳細 ─────────────────────────────────────────────────────────────

function IssueDetail({
  issue,
  onBack,
  dense,
  canManage,
  onUpdated,
}: {
  issue: Issue;
  onBack: () => void;
  dense?: boolean;
  canManage?: boolean;
  onUpdated: (i: Issue) => void;
}) {
  const sev = sevStyle[issue.severity];
  const stat = statStyle[issue.status];
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [comment, setComment] = useState('');

  const changeStatus = async (s: IssueStatus) => {
    if (s === issue.status) return;
    setBusy(true);
    setErr(null);
    try {
      onUpdated(await updateIssueStatus(issue.id, s));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submitComment = async () => {
    const t = comment.trim();
    if (!t) return;
    setBusy(true);
    setErr(null);
    try {
      onUpdated(await addIssueComment(issue.id, t));
      setComment('');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const comments = issue.comments ?? [];

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
          borderRadius: T.radius,
          padding: dense ? 16 : 24,
          boxShadow: T.shadow,
        }}
      >
        <div className="flex flex-wrap gap-2.5 mb-3">
          <span style={{ fontFamily: MONO, fontSize: 11, color: T.textMuted }}>{issue.id}</span>
          <Badge color={sev.color} bg={sev.bg} border={sev.border}>
            {sev.label}
          </Badge>
          <Badge color={stat.color} bg={stat.bg} border={stat.border}>
            {stat.label}
          </Badge>
        </div>
        <div className={`${dense ? 'text-base' : 'text-[20px]'} font-bold text-text mb-2`}>
          {issue.title}
        </div>
        <div className="text-xs mb-4 flex gap-4 flex-wrap" style={{ color: T.textMuted }}>
          <span>建立：{formatDate(issue.created_at)}</span>
          <span>更新：{formatDate(issue.updated_at)}</span>
          {issue.related_config_key && (
            <span style={{ fontFamily: MONO }}>參數：{issue.related_config_key}</span>
          )}
        </div>
        <div
          className={`${dense ? 'text-[13px]' : 'text-sm'} text-text leading-[1.7] bg-bg rounded-[8px] whitespace-pre-wrap`}
          style={{ border: `1px solid ${T.border}`, padding: dense ? 12 : 16 }}
        >
          {issue.description || '（沒有詳細描述）'}
        </div>

        <IssueAttachments issueId={issue.id} canDelete={canManage} />

        {err && (
          <div
            className="text-xs mt-3"
            style={{
              color: T.red,
              background: T.redBg,
              border: `1px solid ${T.redBorder}`,
              borderRadius: 6,
              padding: '6px 10px',
            }}
          >
            {err}
          </div>
        )}

        {/* 更新狀態（manager 以上） */}
        {canManage && (
          <div className="mt-4">
            <div className="text-[11px] font-bold mb-1.5" style={{ color: T.textMuted }}>
              更新狀態
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {(Object.keys(statStyle) as IssueStatus[]).map((s) => {
                const st = statStyle[s];
                const on = issue.status === s;
                return (
                  <button
                    key={s}
                    onClick={() => changeStatus(s)}
                    disabled={busy || on}
                    className="text-xs font-semibold cursor-pointer disabled:cursor-default"
                    style={{
                      color: on ? 'white' : st.color,
                      background: on ? st.color : st.bg,
                      border: `1px solid ${on ? st.color : st.border}`,
                      borderRadius: 20,
                      padding: '4px 12px',
                      opacity: busy && !on ? 0.6 : 1,
                    }}
                  >
                    {st.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 留言（任何登入者） */}
        <div className="mt-5">
          <div className="text-[11px] font-bold mb-2" style={{ color: T.textMuted }}>
            留言{comments.length > 0 && ` · ${comments.length}`}
          </div>
          {comments.map((c) => (
            <div
              key={c.id}
              className="mb-2"
              style={{
                background: T.bg,
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                padding: '8px 12px',
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[12px] font-semibold text-text">{c.author}</span>
                <span className="text-[11px]" style={{ color: T.textMuted }}>
                  {formatDate(c.created_at)}
                </span>
              </div>
              <div className="text-[13px] text-text whitespace-pre-wrap leading-[1.6]">
                {c.text}
              </div>
            </div>
          ))}
          <div className="flex gap-2 items-end mt-2">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder="新增留言…"
              className="flex-1 min-w-0 text-[13px] text-text outline-none resize-none bg-white font-sans"
              style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 10px' }}
            />
            <button
              onClick={submitComment}
              disabled={busy || !comment.trim()}
              className="px-4 py-2 text-[13px] font-bold text-white bg-primary border-0 rounded-[8px] cursor-pointer disabled:opacity-60 whitespace-nowrap"
            >
              送出
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 內容區（三種檢視共用） ───────────────────────────────────────────

function IssueCollection({
  view,
  items,
  onSelect,
  mobile,
}: {
  view: ViewMode;
  items: Issue[];
  onSelect: (i: Issue) => void;
  mobile?: boolean;
}) {
  if (view === 'list') return <IssueTable items={items} onSelect={onSelect} mobile={mobile} />;
  if (view === 'grid') {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: mobile
            ? 'repeat(2, minmax(0,1fr))'
            : 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: mobile ? 10 : 14,
        }}
      >
        {items.map((i) => (
          <IssueSquare key={i.id} issue={i} onClick={() => onSelect(i)} mobile={mobile} />
        ))}
      </div>
    );
  }
  return (
    <>
      {items.map((i) => (
        <IssueCard key={i.id} issue={i} onClick={() => onSelect(i)} mobile={mobile} />
      ))}
    </>
  );
}

// ── Page ─────────────────────────────────────────────────────────────

export default function Issues({ onNav, onCreate, onLogout, isAdmin, isManager, onAdminClick }: Props) {
  const isMobile = useIsMobile();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Issue | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [view, setView] = useIssueView(
    isMobile ? 'hh-issue-view-mobile' : 'hh-issue-view-desktop'
  );
  const { data, loading, error, reload } = useApi<Issue[]>((signal) => fetchIssues({}, signal), []);
  const issues = data ?? [];

  const stats = useMemo(
    () => [
      { label: '全部', val: issues.length, color: T.text },
      { label: '待處理', val: issues.filter((i) => i.status === 'open').length, color: T.amber },
      {
        label: '處理中',
        val: issues.filter((i) => i.status === 'in-progress').length,
        color: T.purple,
      },
      { label: '已解決', val: issues.filter((i) => i.status === 'resolved').length, color: T.green },
    ],
    [issues]
  );

  const filtered = useMemo(() => {
    const base =
      filter === 'all'
        ? issues
        : issues.filter((i) => i.status === filter || i.severity === filter);
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter((i) =>
      [i.title, i.id, i.description, i.related_config_key]
        .filter(Boolean)
        .some((s) => s.toLowerCase().includes(q))
    );
  }, [issues, filter, query]);

  /** 狀態更新/留言後，同步詳細頁與列表，避免要重新整理才看得到。 */
  const handleUpdated = (updated: Issue) => {
    setSelected(updated);
    reload();
  };

  const handleSearch = (q: string) => {
    setQuery(q);
    if (selected) setSelected(null);
  };

  const renderResult = {
    match: (item: Issue, q: string) =>
      item.title.includes(q) ||
      item.id.includes(q) ||
      (item.description ?? '').includes(q) ||
      (item.related_config_key ?? '').includes(q),
    render: (item: Issue, i: number, onClose: () => void) => (
      <IssueCard
        key={`s-${i}`}
        issue={item}
        onClick={() => {
          setSelected(item);
          onClose();
        }}
        mobile
      />
    ),
  };

  const emptyState = (
    <EmptyState
      title={query ? `找不到「${query}」的相關回報` : '目前沒有異常回報'}
      hint={
        query
          ? '請嘗試不同的關鍵字。'
          : filter === 'all'
            ? '可由「+ 新增回報」開始建立。'
            : '此篩選條件下沒有資料。'
      }
    />
  );

  // ── 手機 ──
  if (isMobile) {
    return (
      <div className="w-full h-full flex flex-col bg-bg font-sans relative">
        <HoverCss />
        <TopBar />
        <NavHeader
          active="issues"
          onNav={onNav}
          onLogout={onLogout}
          isAdmin={isAdmin}
          onAdminClick={onAdminClick}
          mobile
        />
        <MobileSearchOverlay
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          placeholder="搜尋異常標題、ID、相關參數..."
          data={issues}
          renderResult={renderResult}
        />
        {selected ? (
          <main className="flex-1 overflow-y-auto px-3.5 pb-20 pt-3.5">
            <IssueDetail
              issue={selected}
              onBack={() => setSelected(null)}
              dense
              canManage={isManager}
              onUpdated={handleUpdated}
            />
          </main>
        ) : (
          <>
            <div
              className="bg-white px-3.5 py-2.5 flex gap-1.5 overflow-x-auto flex-shrink-0 no-scrollbar"
              style={{ borderBottom: `1px solid ${T.border}` }}
            >
              {(
                [
                  { id: 'all', label: '全部' },
                  { id: 'open', label: '待處理' },
                  { id: 'in-progress', label: '處理中' },
                  { id: 'resolved', label: '已解決' },
                ] as { id: Filter; label: string }[]
              ).map((f) => {
                const on = filter === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setFilter(f.id)}
                    className="rounded-[20px] text-xs font-semibold cursor-pointer whitespace-nowrap transition-all duration-150"
                    style={{
                      padding: '5px 14px',
                      background: on ? T.primary : 'white',
                      color: on ? 'white' : T.textMuted,
                      border: `1px solid ${on ? T.primary : T.border}`,
                    }}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
            <main className="flex-1 overflow-y-auto px-3.5 pt-3 pb-20">
              <div className="flex justify-between items-center mb-3 gap-2">
                <span className="text-[15px] font-bold text-text">異常回報</span>
                <div className="flex items-center gap-2">
                  <ViewToggle value={view} onChange={setView} compact />
                  <button
                    onClick={onCreate}
                    className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white border-0 rounded-[8px] text-xs font-bold cursor-pointer whitespace-nowrap"
                  >
                    + 新增
                  </button>
                </div>
              </div>
              {loading && <LoadingState />}
              {error && <ErrorState message={error} onRetry={reload} />}
              {!loading && !error && filtered.length === 0 && emptyState}
              {!loading && !error && filtered.length > 0 && (
                <IssueCollection view={view} items={filtered} onSelect={setSelected} mobile />
              )}
            </main>
          </>
        )}
        <SearchFAB onOpen={() => setSearchOpen(true)} />
        <MobileNav active="issues" onNav={onNav} />
      </div>
    );
  }

  // ── 桌機 ──
  return (
    <div className="w-full h-full flex flex-col bg-bg font-sans">
      <HoverCss />
      <TopBar />
      <NavHeader
        active="issues"
        onNav={onNav}
        onSearch={handleSearch}
        onLogout={onLogout}
        isAdmin={isAdmin}
        onAdminClick={onAdminClick}
      />
      <div
        className="bg-white px-6 py-2.5 flex gap-3 flex-shrink-0"
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
        <button
          onClick={onCreate}
          className="ml-auto flex items-center gap-1.5 px-4 py-[7px] bg-primary text-white border-0 rounded-[8px] text-[13px] font-bold cursor-pointer"
        >
          + 新增回報
        </button>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-[200px] bg-white border-r border-border px-2.5 py-4 flex-shrink-0 overflow-y-auto">
          <SidebarLabel>篩選</SidebarLabel>
          {(
            [
              { id: 'all', label: '全部回報' },
              { id: 'open', label: '待處理' },
              { id: 'in-progress', label: '處理中' },
              { id: 'resolved', label: '已解決' },
            ] as { id: Filter; label: string }[]
          ).map((f) => (
            <SidebarItem key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label}
            </SidebarItem>
          ))}
          <div className="h-px my-3" style={{ background: T.border }} />
          <SidebarLabel>嚴重程度</SidebarLabel>
          {Object.entries(sevStyle).map(([k, v]) => {
            const isActive = filter === k;
            return (
              <button
                key={k}
                onClick={() => setFilter(k as Severity)}
                className="flex items-center gap-2 w-full text-left rounded-[8px] mb-0.5 transition-all duration-150 cursor-pointer"
                style={{
                  padding: '8px 10px',
                  border: isActive ? `1px solid ${v.border}` : '1px solid transparent',
                  background: isActive ? v.bg : 'transparent',
                  color: isActive ? v.color : T.textSec,
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: v.color }}
                />
                {v.label}
              </button>
            );
          })}
        </aside>
        <main className="flex-1 overflow-y-auto px-6 py-5">
          {loading && <LoadingState />}
          {error && <ErrorState message={error} onRetry={reload} />}
          {!loading &&
            !error &&
            (selected ? (
              <IssueDetail
                issue={selected}
                onBack={() => setSelected(null)}
                canManage={isManager}
                onUpdated={handleUpdated}
              />
            ) : (
              <>
                <div className="flex items-center justify-between mb-3.5 gap-3">
                  <span className="text-[17px] font-bold text-text">異常回報</span>
                  <div className="flex items-center gap-3">
                    <ViewToggle value={view} onChange={setView} />
                    <span className="text-xs whitespace-nowrap" style={{ color: T.textMuted }}>
                      {filtered.length} 筆
                    </span>
                  </div>
                </div>
                {filtered.length === 0 ? (
                  emptyState
                ) : (
                  <IssueCollection view={view} items={filtered} onSelect={setSelected} />
                )}
              </>
            ))}
        </main>
      </div>
    </div>
  );
}
