import { useState, useMemo, useEffect } from 'react';
import { TopBar } from '../components/TopBar';
import { NavHeader } from '../components/NavHeader';
import { MobileNav } from '../components/MobileNav';
import { SearchFAB } from '../components/SearchFAB';
import { MobileSearchOverlay } from '../components/MobileSearchOverlay';
import { SidebarLabel } from '../components/Sidebar';
import { LoadingState, EmptyState, ErrorState } from '../components/States';
import { ChevronDown } from '../components/icons';
import { T, rnTypeStyle, type ReleaseType } from '../tokens';
import {
  fetchVersions,
  fetchVersion,
  type ReleaseVersionListItem,
  type ReleaseVersionFull,
} from '../api';
import { useApi } from '../hooks/useApi';
import { safeHTML } from '../sanitize';
import type { PageId } from '../types';
import { useIsMobile } from '../hooks/useMediaQuery';

interface Props {
  onNav: (id: PageId) => void;
  onLogout?: () => void;
  isAdmin?: boolean;
  onAdminClick?: () => void;
}

type SectionKey = 'new' | 'improve' | 'fix' | 'other';

interface ParsedSection {
  key: SectionKey;
  title: string;
  html: string;
}

const SECTION_META: Record<Exclude<SectionKey, 'other'>, { emoji: string; label: string; shortLabel: string; color: string; bg: string; border: string }> = {
  new: { emoji: '🆕', label: '新功能', shortLabel: '新增', color: T.green, bg: T.greenBg, border: T.greenBorder },
  improve: { emoji: '🔧', label: '改善項目', shortLabel: '改善', color: T.accent, bg: T.accentBg, border: T.accentBorder },
  fix: { emoji: '🐛', label: '修復問題', shortLabel: '修復', color: T.amber, bg: T.amberBg, border: T.amberBorder },
};

const SECTION_ORDER: SectionKey[] = ['new', 'improve', 'fix', 'other'];

function classifyHeading(title: string): SectionKey {
  const t = title.replace(/\s+/g, '');
  if (t.includes('新功能') || t.includes('新增功能')) return 'new';
  if (t.includes('改善') || t.includes('改進') || t.includes('優化')) return 'improve';
  if (t.includes('修正') || t.includes('修復')) return 'fix';
  return 'other';
}

function classifySummaryLine(line: string): SectionKey {
  const stripped = line.replace(/^[\s*\-•]+/, '').trim();
  // [重要] / [重點] tagged lines are highlighted as key points regardless of verb.
  if (/^\[[^\]]*[重要點][^\]]*\]/.test(stripped)) return 'other';
  const t = stripped.replace(/^\[[^\]]+\]\s*/, '').trim();
  if (/^(新增|新功能|增加|加入|支援)/.test(t)) return 'new';
  if (/^(改善|改進|優化|調整|更新)/.test(t)) return 'improve';
  if (/^(修正|修復|解決)/.test(t)) return 'fix';
  return 'other';
}

interface ClassifiedLines {
  new: string[];
  improve: string[];
  fix: string[];
  other: string[];
}

function classifySummary(summary: string): ClassifiedLines {
  const out: ClassifiedLines = { new: [], improve: [], fix: [], other: [] };
  if (!summary) return out;
  summary
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .forEach((line) => {
      out[classifySummaryLine(line)].push(line);
    });
  return out;
}

function parseSections(rawHtml: string): ParsedSection[] {
  if (typeof window === 'undefined' || !rawHtml) return [];
  const doc = new DOMParser().parseFromString(rawHtml, 'text/html');
  const sections: ParsedSection[] = [];
  let buffer: Node[] = [];
  let currentTitle: string | null = null;

  const flush = () => {
    if (currentTitle === null) {
      buffer = [];
      return;
    }
    const wrapper = doc.createElement('div');
    buffer.forEach((n) => wrapper.appendChild(n.cloneNode(true)));
    const html = wrapper.innerHTML.trim();
    if (html) {
      sections.push({
        key: classifyHeading(currentTitle),
        title: currentTitle,
        html,
      });
    }
    buffer = [];
  };

  Array.from(doc.body.childNodes).forEach((node) => {
    if (node.nodeType === 1 && (node as Element).tagName === 'H3') {
      flush();
      currentTitle = (node as Element).textContent?.trim() ?? '';
    } else if (currentTitle !== null) {
      buffer.push(node);
    }
  });
  flush();

  return sections;
}

function inferReleaseType(version: string, prev?: string): ReleaseType {
  const parse = (v: string) => v.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const c = parse(version);
  if (!prev) return 'patch';
  const p = parse(prev);
  if ((c[0] ?? 0) !== (p[0] ?? 0)) return 'major';
  if ((c[1] ?? 0) !== (p[1] ?? 0)) return 'major';
  if ((c[2] ?? 0) !== (p[2] ?? 0)) return 'minor';
  return 'patch';
}

function buildTypeMap(list: ReleaseVersionListItem[]): Record<string, ReleaseType> {
  const map: Record<string, ReleaseType> = {};
  list.forEach((item, i) => {
    const next = list[i + 1];
    map[item.slug] = inferReleaseType(item.version, next?.version);
  });
  return map;
}

function TypeBadge({ type, size = 'sm' }: { type: ReleaseType; size?: 'sm' | 'md' }) {
  const style = rnTypeStyle[type];
  const isMd = size === 'md';
  return (
    <span
      className="font-bold uppercase"
      style={{
        fontSize: isMd ? 11 : 10,
        color: style.color,
        background: style.bg,
        border: isMd ? `1px solid ${style.border}` : 'none',
        padding: isMd ? '3px 10px' : '2px 7px',
        borderRadius: isMd ? 20 : 4,
        letterSpacing: 0.4,
        flexShrink: 0,
      }}
    >
      {type}
    </span>
  );
}

function AbstractBlock({
  summary,
  compact,
}: {
  summary: string;
  compact?: boolean;
}) {
  const classified = useMemo(() => classifySummary(summary), [summary]);
  const cols = (['new', 'improve', 'fix'] as const).map((key) => ({
    key,
    items: classified[key],
    meta: SECTION_META[key],
  }));
  const total = cols.reduce((sum, c) => sum + c.items.length, 0) + classified.other.length;
  if (total === 0) return null;

  return (
    <div
      className="bg-white overflow-hidden"
      style={{
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        marginBottom: compact ? 14 : 18,
      }}
    >
      <div
        style={{
          background: T.bg,
          borderBottom: `1px solid ${T.border}`,
          padding: compact ? '9px 14px' : '10px 18px',
          fontSize: compact ? 12 : 13,
          fontWeight: 700,
          color: T.textSec,
          letterSpacing: 0.3,
        }}
      >
        📋 重點摘要
      </div>
      {classified.other.length > 0 && (
        <div
          style={{
            background: '#fffaf0',
            borderBottom: `1px solid ${T.amberBorder}`,
            padding: compact ? '11px 14px' : '13px 18px',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: T.amber,
                background: T.amberBg,
                border: `1px solid ${T.amberBorder}`,
                padding: '2px 8px',
                borderRadius: 20,
              }}
            >
              ⭐ 重要變更
            </span>
            <span
              className="font-mono font-bold"
              style={{ fontSize: 14, color: T.amber }}
            >
              {classified.other.length}
            </span>
            <span className="text-[11px] text-text-muted">項</span>
          </div>
          <ul style={{ paddingLeft: 16, margin: 0, listStyle: 'disc' }}>
            {classified.other.map((item, j) => (
              <li
                key={j}
                style={{
                  fontSize: 12.5,
                  color: T.text,
                  fontWeight: 500,
                  lineHeight: 1.6,
                  marginBottom: 3,
                }}
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div
        style={
          compact
            ? { display: 'flex', flexDirection: 'column' }
            : { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }
        }
      >
        {cols.map((c, i) => {
          const last = i === cols.length - 1;
          return (
            <div
              key={c.key}
              style={{
                padding: compact ? '12px 14px' : '14px 18px',
                borderRight: !compact && !last ? `1px solid ${T.borderLight}` : undefined,
                borderBottom: compact && !last ? `1px solid ${T.borderLight}` : undefined,
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: c.meta.color,
                    background: c.meta.bg,
                    border: `1px solid ${c.meta.border}`,
                    padding: '2px 8px',
                    borderRadius: 20,
                  }}
                >
                  {c.meta.emoji} {c.meta.shortLabel}
                </span>
                <span
                  className="font-mono font-bold"
                  style={{ fontSize: 14, color: c.meta.color }}
                >
                  {c.items.length}
                </span>
                <span className="text-[11px] text-text-muted">項</span>
              </div>
              {c.items.length === 0 ? (
                <div className="text-[11px] text-text-muted">—</div>
              ) : (
                <ul style={{ paddingLeft: 16, margin: 0, listStyle: 'disc' }}>
                  {c.items.map((item, j) => (
                    <li
                      key={j}
                      style={{
                        fontSize: 12,
                        color: T.textSec,
                        lineHeight: 1.55,
                        marginBottom: 3,
                      }}
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SectionCard({
  meta,
  html,
  compact,
}: {
  meta: typeof SECTION_META[Exclude<SectionKey, 'other'>];
  html: string;
  compact?: boolean;
}) {
  return (
    <div
      className="bg-white overflow-hidden"
      style={{
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        marginBottom: compact ? 12 : 14,
      }}
    >
      <div
        style={{
          background: meta.bg,
          borderBottom: `1px solid ${meta.border}`,
          padding: compact ? '9px 14px' : '10px 18px',
          fontSize: compact ? 12 : 13,
          fontWeight: 700,
          color: meta.color,
        }}
      >
        {meta.emoji} {meta.label}
      </div>
      <div
        className="release-note-body"
        style={{ padding: compact ? '4px 14px 8px' : '6px 18px 10px' }}
        dangerouslySetInnerHTML={{ __html: safeHTML(html) }}
      />
    </div>
  );
}

function OtherCard({ title, html, compact }: { title: string; html: string; compact?: boolean }) {
  return (
    <div
      className="bg-white overflow-hidden"
      style={{
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        marginBottom: compact ? 12 : 14,
      }}
    >
      <div
        style={{
          background: T.borderLight,
          borderBottom: `1px solid ${T.border}`,
          padding: compact ? '9px 14px' : '10px 18px',
          fontSize: compact ? 12 : 13,
          fontWeight: 700,
          color: T.textSec,
        }}
      >
        {title}
      </div>
      <div
        className="release-note-body"
        style={{ padding: compact ? '4px 14px 8px' : '6px 18px 10px' }}
        dangerouslySetInnerHTML={{ __html: safeHTML(html) }}
      />
    </div>
  );
}

function VersionBody({ slug, compact }: { slug: string | null; compact?: boolean }) {
  const { data, loading, error, reload } = useApi<ReleaseVersionFull | null>(
    (signal) => (slug ? fetchVersion(slug, signal) : Promise.resolve(null)),
    [slug]
  );

  const sections = useMemo(() => (data ? parseSections(data.html_body) : []), [data]);

  if (!slug) return <EmptyState title="尚無版本資料" />;
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <EmptyState title="找不到此版本" />;

  if (sections.length === 0) {
    return (
      <div
        className="bg-white overflow-hidden mb-3.5"
        style={{
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}
      >
        <div
          className={`release-note-body ${compact ? 'px-4 py-4' : 'px-6 py-5'}`}
          dangerouslySetInnerHTML={{ __html: safeHTML(data.html_body) }}
        />
      </div>
    );
  }

  const grouped: Record<SectionKey, ParsedSection[]> = {
    new: [],
    improve: [],
    fix: [],
    other: [],
  };
  sections.forEach((s) => grouped[s.key].push(s));

  return (
    <>
      <AbstractBlock summary={data.summary ?? ''} compact={compact} />
      {SECTION_ORDER.map((key) => {
        const items = grouped[key];
        if (items.length === 0) return null;
        if (key === 'other') {
          return items.map((s, i) => (
            <OtherCard key={`other-${i}`} title={s.title} html={s.html} compact={compact} />
          ));
        }
        const meta = SECTION_META[key];
        const html = items.map((s) => s.html).join('');
        return <SectionCard key={key} meta={meta} html={html} compact={compact} />;
      })}
    </>
  );
}

function ReleaseNotesDesktop({ onNav, onLogout, isAdmin, onAdminClick }: Props) {
  const versions = useApi<ReleaseVersionListItem[]>((signal) => fetchVersions(signal), []);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const list = versions.data ?? [];
  const typeMap = useMemo(() => buildTypeMap(list), [list]);

  const filteredList = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((rv) =>
      [rv.version, rv.date, rv.summary]
        .filter(Boolean)
        .some((s) => s.toLowerCase().includes(q))
    );
  }, [list, query]);

  useEffect(() => {
    if (!activeSlug && list.length > 0) setActiveSlug(list[0].slug);
  }, [activeSlug, list]);

  useEffect(() => {
    if (!query.trim()) return;
    if (!filteredList.find((v) => v.slug === activeSlug) && filteredList[0]) {
      setActiveSlug(filteredList[0].slug);
    }
  }, [filteredList, activeSlug, query]);

  const active = list.find((v) => v.slug === activeSlug) ?? null;
  const activeType = active ? typeMap[active.slug] ?? 'patch' : 'patch';

  return (
    <div className="w-full h-full flex flex-col bg-bg">
      <TopBar />
      <NavHeader
        active="release-notes"
        onNav={onNav}
        onSearch={setQuery}
        onLogout={onLogout}
        isAdmin={isAdmin}
        onAdminClick={onAdminClick}
      />
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-[200px] bg-white border-r border-border px-2.5 py-4 flex-shrink-0 overflow-y-auto">
          <SidebarLabel>版本列表</SidebarLabel>
          {versions.loading && <LoadingState label="載入中" />}
          {versions.error && (
            <div className="text-[11px] text-red px-2 py-1">無法載入版本：{versions.error}</div>
          )}
          {!versions.loading && !versions.error && list.length === 0 && (
            <div className="text-[11px] text-text-muted px-2">尚無版本資料</div>
          )}
          {!versions.loading && !versions.error && query && filteredList.length === 0 && (
            <div className="text-[11px] text-text-muted px-2">找不到「{query}」</div>
          )}
          {filteredList.map((rv) => {
            const isActive = activeSlug === rv.slug;
            const t = typeMap[rv.slug] ?? 'patch';
            return (
              <button
                key={rv.slug}
                onClick={() => setActiveSlug(rv.slug)}
                className="flex items-center justify-between gap-2 w-full mb-0.5 transition-all duration-150 cursor-pointer rounded-[8px] text-left"
                style={{
                  padding: '10px 10px',
                  border: isActive ? `1px solid ${T.accentBorder}` : '1px solid transparent',
                  background: isActive ? T.accentBg : 'transparent',
                }}
              >
                <div className="min-w-0">
                  <div
                    className="font-mono text-[13px] font-semibold truncate"
                    style={{ color: isActive ? T.accentStrong : T.text }}
                  >
                    {rv.version}
                  </div>
                  <div className="text-[11px] text-text-muted mt-0.5">{rv.date}</div>
                </div>
                <TypeBadge type={t} />
              </button>
            );
          })}
        </aside>
        <main className="flex-1 overflow-y-auto px-8 py-6">
          {active && (
            <div className="mb-5">
              <div className="flex items-center gap-2.5 mb-1">
                <span className="font-mono text-[22px] font-extrabold text-text">
                  {active.version}
                </span>
                <TypeBadge type={activeType} size="md" />
              </div>
              <div className="text-[13px] text-text-muted">發布日期：{active.date}</div>
            </div>
          )}
          <VersionBody slug={activeSlug} />
        </main>
      </div>
    </div>
  );
}

function ReleaseNotesMobile({ onNav, onLogout, isAdmin, onAdminClick }: Props) {
  const versions = useApi<ReleaseVersionListItem[]>((signal) => fetchVersions(signal), []);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const list = versions.data ?? [];
  const typeMap = useMemo(() => buildTypeMap(list), [list]);

  useEffect(() => {
    if (!activeSlug && list.length > 0) setActiveSlug(list[0].slug);
  }, [activeSlug, list]);

  const active = list.find((v) => v.slug === activeSlug) ?? null;
  const activeType = active ? typeMap[active.slug] ?? 'patch' : 'patch';

  const renderResult = {
    match: (item: ReleaseVersionListItem, q: string) =>
      item.version.includes(q) ||
      (item.summary ?? '').includes(q) ||
      item.date.includes(q),
    render: (item: ReleaseVersionListItem, i: number, onClose: () => void) => {
      const t = typeMap[item.slug] ?? 'patch';
      return (
        <div
          key={i}
          className="bg-white px-3.5 py-3 mb-2.5 cursor-pointer"
          style={{
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          }}
          onClick={() => {
            setActiveSlug(item.slug);
            onClose();
          }}
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <span
              className="font-mono text-[12px] font-bold"
              style={{ color: T.accentStrong }}
            >
              {item.version}
            </span>
            <TypeBadge type={t} />
            <span className="text-[11px] text-text-muted ml-auto">{item.date}</span>
          </div>
          {item.summary && (
            <div className="text-[12px] text-text-sec leading-[1.5] line-clamp-2">{item.summary}</div>
          )}
        </div>
      );
    },
  };

  return (
    <div className="w-full h-full flex flex-col bg-bg font-sans relative">
      <TopBar />
      <NavHeader
        active="release-notes"
        onNav={onNav}
        onLogout={onLogout}
        isAdmin={isAdmin}
        onAdminClick={onAdminClick}
        mobile
      />
      <MobileSearchOverlay
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        placeholder="搜尋版本或內容..."
        data={list}
        renderResult={renderResult}
      />
      <div
        className="bg-white px-3.5 py-2.5 flex-shrink-0 relative"
        style={{ borderBottom: `1px solid ${T.border}` }}
      >
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="flex items-center gap-2.5 w-full bg-bg rounded-[8px] px-3 py-2.5 cursor-pointer justify-between"
          style={{ border: `1px solid ${T.border}` }}
        >
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-text">
              {active?.version ?? '—'}
            </span>
            {active && <TypeBadge type={activeType} />}
            {active && <span className="text-[11px] text-text-muted">{active.date}</span>}
          </div>
          <ChevronDown width={14} height={14} className="text-text-muted" />
        </button>
        {showPicker && list.length > 0 && (
          <div
            className="absolute left-3.5 right-3.5 bg-white rounded-[8px] z-50 max-h-[60vh] overflow-y-auto"
            style={{
              top: '100%',
              border: `1px solid ${T.border}`,
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            }}
          >
            {list.map((rv, i) => {
              const isActive = activeSlug === rv.slug;
              const t = typeMap[rv.slug] ?? 'patch';
              return (
                <button
                  key={rv.slug}
                  onClick={() => {
                    setActiveSlug(rv.slug);
                    setShowPicker(false);
                  }}
                  className="flex items-center justify-between gap-2 w-full px-3.5 py-3 border-0 cursor-pointer text-left"
                  style={{
                    borderBottom: i < list.length - 1 ? `1px solid ${T.borderLight}` : 'none',
                    background: isActive ? T.accentBg : 'transparent',
                  }}
                >
                  <div className="min-w-0">
                    <div
                      className="font-mono text-sm font-semibold truncate"
                      style={{ color: isActive ? T.accentStrong : T.text }}
                    >
                      {rv.version}
                    </div>
                    <div className="text-[11px] text-text-muted">{rv.date}</div>
                  </div>
                  <TypeBadge type={t} />
                </button>
              );
            })}
          </div>
        )}
      </div>
      <main className="flex-1 overflow-y-auto px-3.5 pt-3.5 pb-20">
        {versions.loading && <LoadingState />}
        {versions.error && <ErrorState message={versions.error} onRetry={versions.reload} />}
        {!versions.loading && !versions.error && list.length === 0 && (
          <EmptyState title="尚無版本資料" />
        )}
        {active && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-lg font-extrabold text-text">{active.version}</span>
              <TypeBadge type={activeType} size="md" />
            </div>
            <div className="text-xs text-text-muted">發布日期：{active.date}</div>
          </div>
        )}
        <VersionBody slug={activeSlug} compact />
      </main>
      <SearchFAB onOpen={() => setSearchOpen(true)} />
      <MobileNav active="release-notes" onNav={onNav} />
    </div>
  );
}

export default function ReleaseNotes(props: Props) {
  const isMobile = useIsMobile();
  return isMobile ? <ReleaseNotesMobile {...props} /> : <ReleaseNotesDesktop {...props} />;
}
