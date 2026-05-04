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
import { fetchIssues, type Issue } from '../api';
import { useApi } from '../hooks/useApi';
import type { PageId } from '../types';
import { useIsMobile } from '../hooks/useMediaQuery';

interface Props {
  onNav: (id: PageId) => void;
  onCreate: () => void;
  onLogout?: () => void;
  isAdmin?: boolean;
  onAdminClick?: () => void;
}

type Filter = 'all' | IssueStatus | Severity;

const formatDate = (iso: string) => (iso ? iso.slice(0, 10) : '');

function IssueCard({
  issue,
  onClick,
  dense = false,
}: {
  issue: Issue;
  onClick: () => void;
  dense?: boolean;
}) {
  const sev = sevStyle[issue.severity];
  const stat = statStyle[issue.status];
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
        borderLeftColor: sev.color,
      }}
    >
      <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
        <span className="font-mono text-[11px] text-text-muted">
          {issue.id.slice(0, 8)}
        </span>
        <span className="flex-1 text-sm font-semibold text-text min-w-[120px]">{issue.title}</span>
        <Badge color={sev.color} bg={sev.bg} border={sev.border}>
          {sev.label}
        </Badge>
        <Badge color={stat.color} bg={stat.bg} border={stat.border}>
          {stat.label}
        </Badge>
      </div>
      <div className="text-xs text-text-muted flex gap-4 flex-wrap">
        {issue.related_config_key && (
          <span className="font-mono">參數：{issue.related_config_key}</span>
        )}
        <span>更新：{formatDate(issue.updated_at)}</span>
      </div>
    </div>
  );
}

function IssueDetail({
  issue,
  onBack,
  dense = false,
}: {
  issue: Issue;
  onBack: () => void;
  dense?: boolean;
}) {
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
        <div className="flex flex-wrap gap-2.5 mb-3">
          <span className="font-mono text-[11px] text-text-muted">{issue.id}</span>
          <Badge
            color={sevStyle[issue.severity].color}
            bg={sevStyle[issue.severity].bg}
            border={sevStyle[issue.severity].border}
          >
            {sevStyle[issue.severity].label}
          </Badge>
          <Badge
            color={statStyle[issue.status].color}
            bg={statStyle[issue.status].bg}
            border={statStyle[issue.status].border}
          >
            {statStyle[issue.status].label}
          </Badge>
        </div>
        <div className={`${dense ? 'text-base' : 'text-[20px]'} font-bold text-text mb-2`}>
          {issue.title}
        </div>
        <div className="text-xs text-text-muted mb-4 flex gap-4 flex-wrap">
          <span>建立：{formatDate(issue.created_at)}</span>
          <span>更新：{formatDate(issue.updated_at)}</span>
          {issue.related_config_key && (
            <span className="font-mono">參數：{issue.related_config_key}</span>
          )}
        </div>
        <div
          className={`${dense ? 'text-[13px]' : 'text-sm'} text-text leading-[1.7] p-${
            dense ? '3' : '4'
          } bg-bg rounded-[8px] whitespace-pre-wrap`}
          style={{ border: `1px solid ${T.border}` }}
        >
          {issue.description || '（沒有詳細描述）'}
        </div>
      </div>
    </div>
  );
}

function IssuesDesktop({ onNav, onCreate, onLogout, isAdmin, onAdminClick }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<Issue | null>(null);
  const { data, loading, error, reload } = useApi<Issue[]>(
    (signal) => fetchIssues({}, signal),
    []
  );

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
    if (filter === 'all') return issues;
    return issues.filter((i) => i.status === filter || i.severity === filter);
  }, [issues, filter]);

  return (
    <div className="w-full h-full flex flex-col bg-bg">
      <TopBar />
      <NavHeader
        active="issues"
        onNav={onNav}
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
          {!loading && !error && (
            selected ? (
              <IssueDetail issue={selected} onBack={() => setSelected(null)} />
            ) : (
              <>
                <div className="flex items-center justify-between mb-3.5">
                  <span className="text-[17px] font-bold text-text">異常回報</span>
                  <span className="text-xs text-text-muted">{filtered.length} 筆</span>
                </div>
                {filtered.length === 0 ? (
                  <EmptyState
                    title="目前沒有異常回報"
                    hint={filter === 'all' ? '可由右上角「新增回報」開始建立。' : '此篩選條件下沒有資料。'}
                  />
                ) : (
                  filtered.map((issue) => (
                    <IssueCard key={issue.id} issue={issue} onClick={() => setSelected(issue)} />
                  ))
                )}
              </>
            )
          )}
        </main>
      </div>
    </div>
  );
}

function IssuesMobile({ onNav, onCreate, onLogout, isAdmin, onAdminClick }: Props) {
  const [filter, setFilter] = useState<'all' | IssueStatus>('all');
  const [selected, setSelected] = useState<Issue | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const { data, loading, error, reload } = useApi<Issue[]>(
    (signal) => fetchIssues({}, signal),
    []
  );
  const issues = data ?? [];

  const filtered = useMemo(
    () => (filter === 'all' ? issues : issues.filter((i) => i.status === filter)),
    [issues, filter]
  );

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
        dense
      />
    ),
  };

  return (
    <div className="w-full h-full flex flex-col bg-bg font-sans relative">
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
          <IssueDetail issue={selected} onBack={() => setSelected(null)} dense />
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
              ] as { id: 'all' | IssueStatus; label: string }[]
            ).map((f) => {
              const isActive = filter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className="rounded-[20px] text-xs font-semibold cursor-pointer whitespace-nowrap transition-all duration-150"
                  style={{
                    padding: '5px 14px',
                    background: isActive ? T.primary : 'white',
                    color: isActive ? 'white' : T.textMuted,
                    border: `1px solid ${isActive ? T.primary : T.border}`,
                  }}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
          <main className="flex-1 overflow-y-auto px-3.5 pt-3 pb-20">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[15px] font-bold text-text">異常回報</span>
              <button
                onClick={onCreate}
                className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white border-0 rounded-[8px] text-xs font-bold cursor-pointer"
              >
                + 新增
              </button>
            </div>
            {loading && <LoadingState />}
            {error && <ErrorState message={error} onRetry={reload} />}
            {!loading && !error && filtered.length === 0 && (
              <EmptyState
                title="目前沒有異常回報"
                hint={filter === 'all' ? '點選右上「+ 新增」回報問題。' : '此篩選下沒有資料。'}
              />
            )}
            {!loading &&
              !error &&
              filtered.map((issue) => (
                <IssueCard
                  key={issue.id}
                  issue={issue}
                  onClick={() => setSelected(issue)}
                  dense
                />
              ))}
          </main>
        </>
      )}
      <SearchFAB onOpen={() => setSearchOpen(true)} />
      <MobileNav active="issues" onNav={onNav} />
    </div>
  );
}

export default function Issues(props: Props) {
  const isMobile = useIsMobile();
  return isMobile ? <IssuesMobile {...props} /> : <IssuesDesktop {...props} />;
}
