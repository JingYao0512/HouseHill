import { useState, useMemo, useEffect } from 'react';
import { TopBar } from '../components/TopBar';
import { NavHeader } from '../components/NavHeader';
import { MobileNav } from '../components/MobileNav';
import { SearchFAB } from '../components/SearchFAB';
import { MobileSearchOverlay } from '../components/MobileSearchOverlay';
import { SidebarLabel } from '../components/Sidebar';
import { LoadingState, EmptyState, ErrorState } from '../components/States';
import { ChevronDown } from '../components/icons';
import { T } from '../tokens';
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

function VersionBody({ slug }: { slug: string | null }) {
  const { data, loading, error, reload } = useApi<ReleaseVersionFull | null>(
    (signal) => (slug ? fetchVersion(slug, signal) : Promise.resolve(null)),
    [slug]
  );

  if (!slug) return <EmptyState title="尚無版本資料" />;
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <EmptyState title="找不到此版本" />;

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
        className="release-note-body px-6 py-5 text-[13.5px] leading-[1.85] text-text"
        dangerouslySetInnerHTML={{ __html: safeHTML(data.html_body) }}
      />
    </div>
  );
}

function ReleaseNotesDesktop({ onNav, onLogout, isAdmin, onAdminClick }: Props) {
  const versions = useApi<ReleaseVersionListItem[]>((signal) => fetchVersions(signal), []);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  const list = versions.data ?? [];
  useEffect(() => {
    if (!activeSlug && list.length > 0) setActiveSlug(list[0].slug);
  }, [activeSlug, list]);

  const active = list.find((v) => v.slug === activeSlug) ?? null;

  return (
    <div className="w-full h-full flex flex-col bg-bg">
      <TopBar />
      <NavHeader
        active="release-notes"
        onNav={onNav}
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
          {list.map((rv) => {
            const isActive = activeSlug === rv.slug;
            return (
              <button
                key={rv.slug}
                onClick={() => setActiveSlug(rv.slug)}
                className="flex items-center justify-between w-full mb-0.5 transition-all duration-150 cursor-pointer rounded-[8px] text-left"
                style={{
                  padding: '10px 10px',
                  border: isActive ? `1px solid ${T.accentBorder}` : '1px solid transparent',
                  background: isActive ? T.accentBg : 'transparent',
                }}
              >
                <div>
                  <div
                    className="font-mono text-[13px] font-semibold"
                    style={{ color: isActive ? T.accentStrong : T.text }}
                  >
                    {rv.version}
                  </div>
                  <div className="text-[11px] text-text-muted mt-0.5">{rv.date}</div>
                </div>
              </button>
            );
          })}
        </aside>
        <main className="flex-1 overflow-y-auto px-8 py-6">
          {active && (
            <div className="flex items-start gap-3 mb-5">
              <div>
                <div className="flex items-center gap-2.5 mb-1">
                  <span className="font-mono text-[22px] font-extrabold text-text">
                    {active.version}
                  </span>
                </div>
                <div className="text-[13px] text-text-muted">發布日期：{active.date}</div>
                {active.summary && (
                  <div className="text-[13px] text-text-sec mt-2 max-w-[600px] leading-[1.6]">
                    {active.summary}
                  </div>
                )}
              </div>
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
  useEffect(() => {
    if (!activeSlug && list.length > 0) setActiveSlug(list[0].slug);
  }, [activeSlug, list]);

  const active = list.find((v) => v.slug === activeSlug) ?? null;

  const renderResult = {
    match: (item: ReleaseVersionListItem, q: string) =>
      item.version.includes(q) ||
      (item.summary ?? '').includes(q) ||
      item.date.includes(q),
    render: (item: ReleaseVersionListItem, i: number, onClose: () => void) => (
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
          <span className="text-[11px] text-text-muted">{item.date}</span>
        </div>
        {item.summary && (
          <div className="text-[12px] text-text-sec leading-[1.5] line-clamp-2">{item.summary}</div>
        )}
      </div>
    ),
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
            {active && <span className="text-[11px] text-text-muted">{active.date}</span>}
          </div>
          <ChevronDown width={14} height={14} className="text-text-muted" />
        </button>
        {showPicker && list.length > 0 && (
          <div
            className="absolute left-3.5 right-3.5 bg-white rounded-[8px] z-50"
            style={{
              top: '100%',
              border: `1px solid ${T.border}`,
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            }}
          >
            {list.map((rv, i) => {
              const isActive = activeSlug === rv.slug;
              return (
                <button
                  key={rv.slug}
                  onClick={() => {
                    setActiveSlug(rv.slug);
                    setShowPicker(false);
                  }}
                  className="flex items-center justify-between w-full px-3.5 py-3 border-0 cursor-pointer text-left"
                  style={{
                    borderBottom: i < list.length - 1 ? `1px solid ${T.borderLight}` : 'none',
                    background: isActive ? T.accentBg : 'transparent',
                  }}
                >
                  <div>
                    <div
                      className="font-mono text-sm font-semibold"
                      style={{ color: isActive ? T.accentStrong : T.text }}
                    >
                      {rv.version}
                    </div>
                    <div className="text-[11px] text-text-muted">{rv.date}</div>
                  </div>
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
            </div>
            <div className="text-xs text-text-muted">發布日期：{active.date}</div>
            {active.summary && (
              <div className="text-[12px] text-text-sec mt-2 leading-[1.6]">{active.summary}</div>
            )}
          </div>
        )}
        <VersionBody slug={activeSlug} />
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
