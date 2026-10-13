import { useState, useMemo } from 'react';
import { TopBar } from '../components/TopBar';
import { NavHeader } from '../components/NavHeader';
import { MobileNav } from '../components/MobileNav';
import { LoadingState, ErrorState } from '../components/States';
import { ReleaseNoteEditor } from '../components/ReleaseNoteEditor';
import { T, rnTypeStyle, type ReleaseType } from '../tokens';
import { fetchVersions, type ReleaseVersionListItem } from '../api';
import { useApi } from '../hooks/useApi';
import type { PageId } from '../types';
import { useIsMobile } from '../hooks/useMediaQuery';

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
  mobile,
}: {
  v: ReleaseVersionListItem;
  type: ReleaseType;
  latest: boolean;
  changes: Change[];
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
          {v.version}
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
              className="text-text"
              style={{ fontSize: mobile ? 13 : 13.5, lineHeight: 1.6 }}
            >
              {c.text}
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

function Timeline({
  list,
  typeMap,
  filter,
  mobile,
}: {
  list: ReleaseVersionListItem[];
  typeMap: Record<string, ReleaseType>;
  filter: 'all' | KindId;
  mobile?: boolean;
}) {
  const items = list
    .map((v, i) => ({
      v,
      i,
      changes: changesOf(v).filter((c) => filter === 'all' || c.kind.id === filter),
    }))
    .filter((x) => x.changes.length > 0);

  if (items.length === 0) {
    return (
      <div className="text-center text-[13px]" style={{ padding: 32, color: T.textMuted }}>
        沒有符合的更新項目
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
            mobile={mobile}
          />
        );

        if (mobile) {
          return (
            <div
              key={v.slug}
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

// ── Page ─────────────────────────────────────────────────────────────

export default function ReleaseNotes({ onNav, onLogout, isAdmin, onAdminClick }: Props) {
  const isMobile = useIsMobile();
  const versions = useApi<ReleaseVersionListItem[]>((signal) => fetchVersions(signal), []);
  const [filter, setFilter] = useState<'all' | KindId>('all');
  const [editing, setEditing] = useState(false);

  const list = versions.data ?? [];
  const typeMap = useMemo(() => buildTypeMap(list), [list]);
  const allChanges = useMemo(() => list.flatMap(changesOf), [list]);
  const latest = list[0];

  return (
    <div className="w-full h-full flex flex-col bg-bg font-sans relative">
      <TopBar />
      <NavHeader
        active="release-notes"
        onNav={onNav}
        onLogout={onLogout}
        isAdmin={isAdmin}
        onAdminClick={onAdminClick}
        mobile={isMobile}
      />
      <main className="flex-1 overflow-y-auto">
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
              marginBottom: isMobile ? 8 : 20,
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

          {versions.loading && <LoadingState />}
          {versions.error && <ErrorState message={versions.error} onRetry={versions.reload} />}
          {!versions.loading && !versions.error && (
            <Timeline list={list} typeMap={typeMap} filter={filter} mobile={isMobile} />
          )}
        </div>
      </main>
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
