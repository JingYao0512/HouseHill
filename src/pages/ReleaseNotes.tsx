import { useState, useMemo, useEffect, useRef } from 'react';
import { TopBar } from '../components/TopBar';
import { NavHeader } from '../components/NavHeader';
import { MobileNav } from '../components/MobileNav';
import { LoadingState, ErrorState } from '../components/States';
import { ReleaseNoteEditor } from '../components/ReleaseNoteEditor';
import { T, rnTypeStyle, type ReleaseType } from '../tokens';
import { fetchVersions, type ReleaseVersionListItem } from '../api';
import { useApi } from '../hooks/useApi';
import type { PageId } from '../types';
import { useIsMobile, useMediaQuery } from '../hooks/useMediaQuery';

const MONO = "'JetBrains Mono',monospace";

interface Props {
  onNav: (id: PageId) => void;
  onLogout?: () => void;
  isAdmin?: boolean;
  isManager?: boolean;
  onAdminClick?: () => void;
}

// ── 版本類型（由版號差異推斷） ───────────────────────────────────────

function inferReleaseType(version: string, prev?: string): ReleaseType {
  if (!prev) return 'patch';
  const a = version.replace(/^v/, '').split('.').map(Number);
  const b = prev.replace(/^v/, '').split('.').map(Number);
  if ((a[0] ?? 0) !== (b[0] ?? 0)) return 'major';
  if ((a[1] ?? 0) !== (b[1] ?? 0)) return 'minor';
  return 'patch';
}

function buildTypeMap(list: ReleaseVersionListItem[]): Record<string, ReleaseType> {
  const map: Record<string, ReleaseType> = {};
  list.forEach((item, i) => {
    map[item.slug] = inferReleaseType(item.version, list[i + 1]?.version);
  });
  return map;
}

// ── 變更種類 ─────────────────────────────────────────────────────────

type KindId = 'new' | 'improve' | 'fix';

const KINDS: { id: KindId; label: string; color: string; bg: string; border: string }[] = [
  { id: 'new', label: '新功能', color: T.green, bg: T.greenBg, border: T.greenBorder },
  { id: 'improve', label: '改善', color: T.accent, bg: T.accentBg, border: T.accentBorder },
  { id: 'fix', label: '修復', color: T.amber, bg: T.amberBg, border: T.amberBorder },
];

type Change = { kind: (typeof KINDS)[number]; text: string };

function changesOf(v: ReleaseVersionListItem): Change[] {
  return KINDS.flatMap((k) => (v.notes?.[k.id] ?? []).map((text) => ({ kind: k, text })));
}

// ── Filter（segmented） ──────────────────────────────────────────────

function RnFilter({
  value,
  onChange,
  all,
}: {
  value: 'all' | KindId;
  onChange: (v: 'all' | KindId) => void;
  all: Change[];
}) {
  const opts = [
    { id: 'all' as const, label: '全部', n: all.length, color: undefined as string | undefined },
    ...KINDS.map((k) => ({
      id: k.id,
      label: k.label,
      n: all.filter((c) => c.kind.id === k.id).length,
      color: k.color as string | undefined,
    })),
  ];
  return (
    <div
      className="flex w-fit max-w-full overflow-x-auto no-scrollbar"
      style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: 3, gap: 2 }}
    >
      {opts.map((o) => {
        const on = value === o.id;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap border-0 transition-all duration-150 font-sans"
            style={{
              padding: '6px 12px',
              borderRadius: 7,
              background: on ? T.primary : 'transparent',
              color: on ? 'white' : T.textSec,
            }}
          >
            {o.color && (
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: o.color }} />
            )}
            {o.label}
            <span
              className="text-[11px] font-medium"
              style={{ color: on ? 'rgba(255,255,255,0.6)' : T.textMuted }}
            >
              {o.n}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── 版本卡 ───────────────────────────────────────────────────────────

function VersionCard({
  v,
  type,
  latest,
  changes,
  query = '',
  mobile,
}: {
  v: ReleaseVersionListItem;
  type: ReleaseType;
  latest: boolean;
  changes: Change[];
  query?: string;
  mobile?: boolean;
}) {
  const ts = rnTypeStyle[type];
  return (
    <div
      style={{
        background: T.surface,
        border: `1px solid ${latest ? T.accentBorder : T.border}`,
        borderRadius: T.radius,
        padding: mobile ? '12px 14px' : '16px 20px',
        boxShadow: T.shadow,
      }}
    >
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span
          className="font-extrabold text-text"
          style={{ fontFamily: MONO, fontSize: mobile ? 16 : 18 }}
        >
          <Highlight text={v.version} query={query} />
        </span>
        <span
          className="text-[10px] font-bold"
          style={{
            color: ts.color,
            background: ts.bg,
            border: `1px solid ${ts.border}`,
            padding: '2px 8px',
            borderRadius: 20,
          }}
        >
          {type}
        </span>
        {latest && (
          <span
            className="text-[10px] font-bold text-white"
            style={{ background: T.primary, padding: '2px 8px', borderRadius: 20 }}
          >
            最新版本
          </span>
        )}
      </div>
      <div>
        {changes.map((c, i) => (
          <div
            key={i}
            className="flex items-start gap-2.5"
            style={{ padding: '8px 0', borderTop: i ? `1px solid ${T.borderLight}` : 'none' }}
          >
            <span
              className="flex-shrink-0 text-center text-[11px] font-bold"
              style={{
                width: 50,
                color: c.kind.color,
                background: c.kind.bg,
                border: `1px solid ${c.kind.border}`,
                borderRadius: 4,
                padding: '2px 0',
                marginTop: 1,
              }}
            >
              {c.kind.label}
            </span>
            <span
              className="text-text min-w-0"
              style={{ fontSize: mobile ? 13 : 13.5, lineHeight: 1.6, overflowWrap: 'anywhere' }}
            >
              <Highlight text={c.text} query={query} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 時間軸 ───────────────────────────────────────────────────────────

function Rail({ first, last, latest }: { first: boolean; last: boolean; latest: boolean }) {
  return (
    <div className="relative">
      <span
        style={{
          position: 'absolute',
          left: '50%',
          marginLeft: -1,
          top: first ? 20 : 0,
          bottom: last ? 'auto' : 0,
          height: last ? 20 : 'auto',
          width: 2,
          background: T.border,
        }}
      />
      <span
        style={{
          position: 'absolute',
          left: '50%',
          top: 20,
          width: 12,
          height: 12,
          marginLeft: -6,
          borderRadius: '50%',
          background: latest ? T.accent : T.surface,
          border: latest ? 'none' : '2px solid #cbd5e1',
          boxShadow: latest ? `0 0 0 4px ${T.accentBg}` : 'none',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

// ── 搜尋 ─────────────────────────────────────────────────────────────

/** 一個版本在目前篩選＋搜尋下要顯示的內容 */
type VisibleVersion = { v: ReleaseVersionListItem; i: number; changes: Change[] };

/**
 * 版號或日期符合 → 顯示該版全部（仍套用種類篩選）的變更；
 * 否則只留下內容符合關鍵字的變更。沒有任何變更可顯示的版本整個略過。
 */
function visibleVersions(
  list: ReleaseVersionListItem[],
  filter: 'all' | KindId,
  query: string
): VisibleVersion[] {
  const q = query.trim().toLowerCase();
  return list
    .map((v, i) => {
      const byKind = changesOf(v).filter((c) => filter === 'all' || c.kind.id === filter);
      const headHit = !q || v.version.toLowerCase().includes(q) || v.date.toLowerCase().includes(q);
      const changes = headHit ? byKind : byKind.filter((c) => c.text.toLowerCase().includes(q));
      return { v, i, changes };
    })
    .filter((x) => x.changes.length > 0);
}

/** 把關鍵字標成黃底（不分大小寫） */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const parts: React.ReactNode[] = [];
  let from = 0;
  for (let at = lower.indexOf(needle); at !== -1; at = lower.indexOf(needle, from)) {
    if (at > from) parts.push(text.slice(from, at));
    parts.push(
      <mark key={at} style={{ background: '#fde68a', color: 'inherit', borderRadius: 2, padding: '0 1px' }}>
        {text.slice(at, at + q.length)}
      </mark>
    );
    from = at + q.length;
  }
  if (from < text.length) parts.push(text.slice(from));
  return <>{parts}</>;
}

function RnSearch({
  value,
  onChange,
  mobile,
}: {
  value: string;
  onChange: (v: string) => void;
  mobile?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-2.5 bg-white"
      style={{
        border: `1.5px solid ${T.border}`,
        borderRadius: 12,
        padding: mobile ? '0 12px' : '0 16px',
        height: mobile ? 42 : 44,
        boxShadow: T.shadow,
      }}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={mobile ? '搜尋版本或更新內容' : '搜尋版號、日期或更新內容，例如：1.8.3、DICOM、列印'}
        aria-label="搜尋更新紀錄"
        className="flex-1 min-w-0 border-0 outline-none bg-transparent text-[14px] text-text font-sans"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          aria-label="清除搜尋"
          className="border-0 w-6 h-6 rounded-full cursor-pointer text-sm leading-none flex-shrink-0"
          style={{ background: T.bg, color: T.textMuted }}
        >
          ×
        </button>
      )}
    </div>
  );
}

// ── 時間軸 ───────────────────────────────────────────────────────────

const anchorId = (slug: string) => `rn-${slug}`;

function Timeline({
  items,
  typeMap,
  query,
  mobile,
}: {
  items: VisibleVersion[];
  typeMap: Record<string, ReleaseType>;
  query: string;
  mobile?: boolean;
}) {
  if (items.length === 0) {
    return (
      <div className="text-center text-[13px]" style={{ padding: 32, color: T.textMuted }}>
        {query.trim() ? `找不到「${query.trim()}」相關的更新項目` : '沒有符合的更新項目'}
      </div>
    );
  }

  return (
    <>
      {items.map(({ v, i, changes }, idx) => {
        const last = idx === items.length - 1;
        const latest = i === 0;
        const card = (
          <VersionCard
            v={v}
            type={typeMap[v.slug] ?? 'patch'}
            latest={latest}
            changes={changes}
            query={query}
            mobile={mobile}
          />
        );

        if (mobile) {
          return (
            <div
              key={v.slug}
              id={anchorId(v.slug)}
              style={{ display: 'grid', gridTemplateColumns: '20px minmax(0,1fr)', gap: 10 }}
            >
              <Rail first={idx === 0} last={last} latest={latest} />
              <div style={{ paddingBottom: 16 }}>
                <div
                  style={{ fontFamily: MONO, fontSize: 11, color: T.textMuted, padding: '16px 0 6px' }}
                >
                  {v.date}
                </div>
                {card}
              </div>
            </div>
          );
        }

        return (
          <div
            key={v.slug}
            id={anchorId(v.slug)}
            data-rn-slug={v.slug}
            style={{ display: 'grid', gridTemplateColumns: '104px 28px minmax(0,1fr)', gap: 12 }}
          >
            <div className="text-right" style={{ paddingTop: 16 }}>
              <div
                className="font-semibold"
                style={{ fontFamily: MONO, fontSize: 12, color: latest ? T.text : T.textSec }}
              >
                {v.date}
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: T.textMuted }}>
                {changes.length} 項變更
              </div>
            </div>
            <Rail first={idx === 0} last={last} latest={latest} />
            <div style={{ paddingBottom: 18 }}>{card}</div>
          </div>
        );
      })}
    </>
  );
}

// ── 左側版本清單（寬螢幕） ────────────────────────────────────────────

function VersionList({
  items,
  total,
  active,
  onPick,
}: {
  items: VisibleVersion[];
  total: number;
  active: string | null;
  onPick: (slug: string) => void;
}) {
  const activeRef = useRef<HTMLButtonElement | null>(null);

  // 捲動時目前版本改變 → 讓清單也跟著把它捲進視野
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  return (
    <aside
      className="w-[232px] bg-white flex-shrink-0 overflow-y-auto px-2.5 py-4"
      style={{ borderRight: `1px solid ${T.border}` }}
      aria-label="版本清單"
    >
      <div className="flex items-baseline justify-between px-2 mb-2.5">
        <span className="text-[10px] font-bold uppercase tracking-[1px]" style={{ color: T.textMuted }}>
          版本
        </span>
        <span className="text-[11px]" style={{ color: T.textMuted }}>
          {items.length === total ? `${total} 個` : `${items.length} / ${total}`}
        </span>
      </div>
      {items.length === 0 && (
        <div className="px-2 text-xs" style={{ color: T.textMuted }}>
          沒有符合的版本
        </div>
      )}
      {items.map(({ v, i, changes }) => {
        const on = active === v.slug;
        return (
          <button
            key={v.slug}
            ref={on ? activeRef : undefined}
            onClick={() => onPick(v.slug)}
            aria-current={on ? 'true' : undefined}
            className="w-full flex items-center gap-2 text-left rounded-[8px] mb-0.5 cursor-pointer font-sans transition-colors duration-150"
            style={{
              padding: '7px 10px',
              border: `1px solid ${on ? T.accentBorder : 'transparent'}`,
              background: on ? T.accentBg : 'transparent',
            }}
          >
            <span className="flex-1 min-w-0">
              <span
                className="flex items-center gap-1.5 text-[13px] font-semibold truncate"
                style={{ fontFamily: MONO, color: on ? T.accentStrong : T.text }}
              >
                {v.version}
                {i === 0 && (
                  <span
                    className="text-[9px] font-bold text-white font-sans"
                    style={{ background: T.primary, padding: '1px 6px', borderRadius: 20 }}
                  >
                    最新
                  </span>
                )}
              </span>
              <span className="block text-[11px] mt-px" style={{ fontFamily: MONO, color: T.textMuted }}>
                {v.date}
              </span>
            </span>
            <span className="text-[11px] tabular-nums flex-shrink-0" style={{ color: T.textMuted }}>
              {changes.length}
            </span>
          </button>
        );
      })}
    </aside>
  );
}

// ── Page ─────────────────────────────────────────────────────────────

export default function ReleaseNotes({ onNav, onLogout, isAdmin, onAdminClick }: Props) {
  const isMobile = useIsMobile();
  // 左側清單需要額外 ~232px；空間不夠時（含平板）只顯示時間軸
  const showList = useMediaQuery('(min-width: 1180px)');
  const versions = useApi<ReleaseVersionListItem[]>((signal) => fetchVersions(signal), []);
  const [filter, setFilter] = useState<'all' | KindId>('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);

  const list = versions.data ?? [];
  const typeMap = useMemo(() => buildTypeMap(list), [list]);
  const allChanges = useMemo(() => list.flatMap(changesOf), [list]);
  const items = useMemo(() => visibleVersions(list, filter, query), [list, filter, query]);
  // 沒有任何變更項目的版本本來就不顯示，不算進「共幾個版本」
  const versionTotal = useMemo(() => visibleVersions(list, 'all', '').length, [list]);
  const latest = list[0];

  // 依捲動位置標示左側清單的「目前版本」
  useEffect(() => {
    const main = mainRef.current;
    if (!main || !showList) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const top = main.getBoundingClientRect().top + 96;
      const nodes = main.querySelectorAll<HTMLElement>('[data-rn-slug]');
      let current: string | null = nodes[0]?.dataset.rnSlug ?? null;
      nodes.forEach((n) => {
        if (n.getBoundingClientRect().top <= top) current = n.dataset.rnSlug ?? current;
      });
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    main.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      main.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [items, showList]);

  const jumpTo = (slug: string) => {
    const el = document.getElementById(anchorId(slug));
    const main = mainRef.current;
    if (!el || !main) return;
    main.scrollTo({ top: main.scrollTop + el.getBoundingClientRect().top - main.getBoundingClientRect().top - 12, behavior: 'smooth' });
    setActive(slug);
  };

  return (
    <div className="w-full h-full flex flex-col bg-bg font-sans relative">
      <TopBar />
      <NavHeader
        active="release-notes"
        onNav={onNav}
        onSearch={setQuery}
        onLogout={onLogout}
        isAdmin={isAdmin}
        onAdminClick={onAdminClick}
        mobile={isMobile}
      />
      <div className="flex flex-1 overflow-hidden">
        {showList && !isMobile && !versions.loading && !versions.error && (
          <VersionList items={items} total={versionTotal} active={active} onPick={jumpTo} />
        )}
        <main ref={mainRef} className="flex-1 overflow-y-auto">
          <div
            style={{
              maxWidth: 860,
              margin: '0 auto',
              padding: isMobile ? '16px 14px 24px' : '28px 32px 40px',
            }}
          >
            <div
              className="flex justify-between gap-3"
              style={{
                flexDirection: isMobile ? 'column' : 'row',
                alignItems: isMobile ? 'stretch' : 'flex-end',
                marginBottom: isMobile ? 12 : 16,
              }}
            >
              <div>
                <div
                  className="font-extrabold text-text"
                  style={{ fontSize: isMobile ? 18 : 22, letterSpacing: '-0.4px' }}
                >
                  更新紀錄
                </div>
                <div className="text-[13px] mt-1" style={{ color: T.textMuted }}>
                  {latest ? (
                    <>
                      目前版本{' '}
                      <span style={{ fontFamily: MONO, color: T.textSec, fontWeight: 600 }}>
                        {latest.version}
                      </span>{' '}
                      · 發布於 {latest.date}
                    </>
                  ) : (
                    '尚無版本資料'
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <RnFilter value={filter} onChange={setFilter} all={allChanges} />
                {isAdmin && (
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-1.5 text-[13px] font-bold cursor-pointer flex-shrink-0"
                    style={{
                      color: T.accentStrong,
                      background: T.accentBg,
                      border: `1px solid ${T.accentBorder}`,
                      borderRadius: 8,
                      padding: '7px 14px',
                    }}
                  >
                    ✏️ 編輯
                  </button>
                )}
              </div>
            </div>

            <div style={{ marginBottom: isMobile ? 8 : 18 }}>
              <RnSearch value={query} onChange={setQuery} mobile={isMobile} />
              {query.trim() && !versions.loading && (
                <div className="text-xs mt-2 px-0.5" style={{ color: T.textMuted }}>
                  找到 {items.length} 個版本、{items.reduce((n, x) => n + x.changes.length, 0)} 項變更
                </div>
              )}
            </div>

            {versions.loading && <LoadingState />}
            {versions.error && <ErrorState message={versions.error} onRetry={versions.reload} />}
            {!versions.loading && !versions.error && (
              <Timeline items={items} typeMap={typeMap} query={query} mobile={isMobile} />
            )}
          </div>
        </main>
      </div>
      {isMobile && <MobileNav active="release-notes" onNav={onNav} />}

      {editing && (
        <ReleaseNoteEditor
          mobile={isMobile}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            versions.reload();
          }}
        />
      )}
    </div>
  );
}
