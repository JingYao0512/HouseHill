import { useState, useMemo } from 'react';
import { TopBar } from '../components/TopBar';
import { NavHeader } from '../components/NavHeader';
import { MobileNav } from '../components/MobileNav';
import { SearchFAB } from '../components/SearchFAB';
import { MobileSearchOverlay } from '../components/MobileSearchOverlay';
import { SidebarLabel, SidebarItem } from '../components/Sidebar';
import { LoadingState, EmptyState, ErrorState } from '../components/States';
import { SearchIcon } from '../components/icons';
import { T } from '../tokens';
import {
  fetchArticles,
  fetchArticle,
  fetchCategories,
  type ArticleListItem,
  type ArticleFull,
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

function ArticleDetailView({
  slug,
  onBack,
  dense = false,
}: {
  slug: string;
  onBack: () => void;
  dense?: boolean;
}) {
  const { data: article, loading, error, reload } = useApi<ArticleFull>(
    (signal) => fetchArticle(slug, signal),
    [slug]
  );

  return (
    <>
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[13px] font-semibold text-accent bg-transparent border-0 cursor-pointer pb-3"
      >
        ← 返回{dense ? '' : '列表'}
      </button>
      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {article && (
        <div
          className="bg-white overflow-hidden"
          style={{
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          }}
        >
          <div
            className={dense ? 'px-4 py-3.5 bg-bg' : 'px-6 py-5'}
            style={{ borderBottom: `1px solid ${T.border}` }}
          >
            <div className="flex flex-wrap gap-1.5 mb-2">
              <span className="font-mono text-[11px] text-text-muted">{article.slug}</span>
              {article.category && (
                <span
                  className="text-[11px] font-semibold px-2 py-[2px] rounded-[20px]"
                  style={{
                    color: T.accentStrong,
                    background: T.accentBg,
                    border: `1px solid ${T.accentBorder}`,
                  }}
                >
                  {article.category}
                </span>
              )}
              {article.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] text-text-sec px-2 py-[2px] rounded-[20px]"
                  style={{
                    background: dense ? T.surface : T.bg,
                    border: `1px solid ${T.border}`,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className={`${dense ? 'text-base' : 'text-[20px]'} font-bold text-text`}>
              {article.title}
            </div>
          </div>
          <div className={dense ? 'px-4 py-3.5' : 'px-6 py-5'}>
            {article.related_config_keys.length > 0 && (
              <div
                className={`bg-bg rounded-[8px] p-${dense ? '3' : '4'} mb-${dense ? '3' : '4'}`}
                style={{ border: `1px solid ${T.border}` }}
              >
                <div className={`${dense ? 'text-[11px]' : 'text-xs'} font-bold text-text-sec mb-2`}>
                  相關設定參數
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {article.related_config_keys.map((k) => (
                    <span
                      key={k}
                      className="font-mono text-[11px]"
                      style={{
                        color: T.accentStrong,
                        background: T.accentBg,
                        border: `1px solid ${T.accentBorder}`,
                        padding: dense ? '3px 8px' : '4px 10px',
                        borderRadius: dense ? 5 : 6,
                      }}
                    >
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div
              className="ts-article-body text-[13.5px] leading-[1.8] text-text"
              dangerouslySetInnerHTML={{ __html: safeHTML(article.html_body) }}
            />
          </div>
        </div>
      )}
    </>
  );
}

function TsCard({ a, onClick }: { a: ArticleListItem; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="bg-white cursor-pointer transition-all duration-150 hover:shadow-md"
      style={{
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        padding: '16px 18px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}
    >
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        {a.category && (
          <span
            className="text-[10px] font-semibold px-2 py-[2px] rounded-[20px]"
            style={{
              color: T.accentStrong,
              background: T.accentBg,
              border: `1px solid ${T.accentBorder}`,
            }}
          >
            {a.category}
          </span>
        )}
        {a.tags.slice(0, 2).map((t) => (
          <span
            key={t}
            className="text-[10px] text-text-sec px-1.5 py-[2px] rounded-[20px]"
            style={{ background: T.bg, border: `1px solid ${T.border}` }}
          >
            {t}
          </span>
        ))}
      </div>
      <div className="text-sm font-semibold text-text mb-2 leading-snug">{a.title}</div>
      {a.snippet && (
        <div className="text-xs text-text-sec leading-[1.6] mb-2.5 line-clamp-2">
          {a.snippet}
        </div>
      )}
      {a.related_config_keys.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {a.related_config_keys.slice(0, 4).map((k) => (
            <span
              key={k}
              className="font-mono text-[10px] px-1.5 py-[2px] rounded-[4px]"
              style={{
                color: T.accentStrong,
                background: T.accentBg,
                border: `1px solid ${T.accentBorder}`,
              }}
            >
              {k}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function TsCardMobile({ a, onClick }: { a: ArticleListItem; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="bg-white cursor-pointer"
      style={{
        border: `1px solid ${T.border}`,
        borderRadius: 8,
        padding: '12px 14px',
        marginBottom: 10,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}
    >
      <div className="flex gap-1.5 mb-1.5 flex-wrap">
        {a.category && (
          <span
            className="text-[10px] font-semibold px-1.5 py-[2px] rounded-[20px]"
            style={{
              color: T.accentStrong,
              background: T.accentBg,
              border: `1px solid ${T.accentBorder}`,
            }}
          >
            {a.category}
          </span>
        )}
        {a.tags.slice(0, 2).map((t) => (
          <span
            key={t}
            className="text-[10px] text-text-sec px-1.5 py-[2px] rounded-[20px]"
            style={{ background: T.bg, border: `1px solid ${T.border}` }}
          >
            {t}
          </span>
        ))}
      </div>
      <div className="text-sm font-semibold text-text mb-1">{a.title}</div>
      {a.snippet && (
        <div className="text-[11px] text-text-sec leading-[1.5] line-clamp-2">{a.snippet}</div>
      )}
    </div>
  );
}

function TroubleshootingDesktop({ onNav, onLogout, isAdmin, onAdminClick }: Props) {
  const [cat, setCat] = useState('全部');
  const [search, setSearch] = useState('');
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const articles = useApi<ArticleListItem[]>(
    (signal) => fetchArticles({ q: search, category: cat }, signal),
    [search, cat]
  );
  const categories = useApi<string[]>((signal) => fetchCategories(signal), []);

  const cats = useMemo(() => ['全部', ...(categories.data ?? [])], [categories.data]);
  const allArticles = articles.data ?? [];

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    allArticles.forEach((a) => m.set(a.category, (m.get(a.category) ?? 0) + 1));
    return m;
  }, [allArticles]);

  return (
    <div className="w-full h-full flex flex-col bg-bg">
      <TopBar />
      <NavHeader
        active="troubleshooting"
        onNav={onNav}
        onLogout={onLogout}
        isAdmin={isAdmin}
        onAdminClick={onAdminClick}
      />
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-[200px] bg-white border-r border-border px-2.5 py-4 flex-shrink-0 overflow-y-auto">
          <SidebarLabel>類別</SidebarLabel>
          {cats.map((c) => (
            <SidebarItem
              key={c}
              active={cat === c}
              onClick={() => setCat(c)}
              trailing={
                <span
                  className="text-[11px] px-1.5 py-px rounded-[10px] ml-auto"
                  style={{
                    color: cat === c ? T.accent : T.textMuted,
                    background: T.bg,
                  }}
                >
                  {c === '全部' ? allArticles.length : counts.get(c) ?? 0}
                </span>
              }
            >
              {c}
            </SidebarItem>
          ))}
        </aside>
        <main className="flex-1 overflow-y-auto px-7 py-5">
          {selectedSlug ? (
            <ArticleDetailView slug={selectedSlug} onBack={() => setSelectedSlug(null)} />
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-[17px] font-bold text-text flex-1">故障排除</span>
                <div
                  className="flex items-center gap-2 bg-white rounded-[8px] px-3 py-[7px]"
                  style={{ border: `1px solid ${T.border}` }}
                >
                  <SearchIcon width={14} height={14} className="text-text-muted" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="bg-transparent border-0 outline-none text-[13px] text-text w-[200px]"
                    placeholder="搜尋文章..."
                  />
                </div>
              </div>
              {articles.loading && <LoadingState />}
              {articles.error && <ErrorState message={articles.error} onRetry={articles.reload} />}
              {!articles.loading && !articles.error && allArticles.length === 0 && (
                <EmptyState
                  title={search ? '找不到符合的文章' : '尚無故障排除文章'}
                  hint={search ? '請嘗試不同的關鍵字。' : ''}
                />
              )}
              {!articles.loading && !articles.error && allArticles.length > 0 && (
                <div
                  className="grid gap-3.5"
                  style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
                >
                  {allArticles.map((a) => (
                    <TsCard key={a.slug} a={a} onClick={() => setSelectedSlug(a.slug)} />
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function TroubleshootingMobile({ onNav, onLogout, isAdmin, onAdminClick }: Props) {
  const [cat, setCat] = useState('全部');
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const articles = useApi<ArticleListItem[]>(
    (signal) => fetchArticles({ category: cat }, signal),
    [cat]
  );
  const categories = useApi<string[]>((signal) => fetchCategories(signal), []);
  const cats = useMemo(() => ['全部', ...(categories.data ?? [])], [categories.data]);
  const allArticles = articles.data ?? [];

  const renderResult = {
    match: (item: ArticleListItem, q: string) =>
      item.title.includes(q) ||
      (item.snippet ?? '').includes(q) ||
      item.tags.some((t) => t.includes(q)) ||
      item.related_config_keys.some((k) => k.includes(q)),
    render: (item: ArticleListItem, i: number, onClose: () => void) => (
      <TsCardMobile
        key={`s-${i}`}
        a={item}
        onClick={() => {
          setSelectedSlug(item.slug);
          onClose();
        }}
      />
    ),
  };

  return (
    <div className="w-full h-full flex flex-col bg-bg font-sans relative">
      <TopBar />
      <NavHeader
        active="troubleshooting"
        onNav={onNav}
        onLogout={onLogout}
        isAdmin={isAdmin}
        onAdminClick={onAdminClick}
        mobile
      />
      <MobileSearchOverlay
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        placeholder="搜尋故障排除文章..."
        data={allArticles}
        renderResult={renderResult}
      />
      {selectedSlug ? (
        <main className="flex-1 overflow-y-auto px-3.5 pt-3.5 pb-20">
          <ArticleDetailView
            slug={selectedSlug}
            onBack={() => setSelectedSlug(null)}
            dense
          />
        </main>
      ) : (
        <>
          <div
            className="bg-white px-3.5 py-2.5 flex gap-1.5 overflow-x-auto flex-shrink-0 no-scrollbar"
            style={{ borderBottom: `1px solid ${T.border}` }}
          >
            {cats.map((c) => {
              const isActive = cat === c;
              return (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className="rounded-[20px] text-[11px] font-semibold cursor-pointer whitespace-nowrap"
                  style={{
                    padding: '5px 12px',
                    background: isActive ? T.primary : 'white',
                    color: isActive ? 'white' : T.textMuted,
                    border: `1px solid ${isActive ? T.primary : T.border}`,
                  }}
                >
                  {c}
                </button>
              );
            })}
          </div>
          <main className="flex-1 overflow-y-auto px-3.5 pt-3 pb-20">
            <div className="text-[15px] font-bold text-text mb-3">故障排除</div>
            {articles.loading && <LoadingState />}
            {articles.error && <ErrorState message={articles.error} onRetry={articles.reload} />}
            {!articles.loading && !articles.error && allArticles.length === 0 && (
              <EmptyState title="尚無相關文章" />
            )}
            {!articles.loading &&
              !articles.error &&
              allArticles.map((a) => (
                <TsCardMobile key={a.slug} a={a} onClick={() => setSelectedSlug(a.slug)} />
              ))}
          </main>
        </>
      )}
      <SearchFAB onOpen={() => setSearchOpen(true)} />
      <MobileNav active="troubleshooting" onNav={onNav} />
    </div>
  );
}

export default function Troubleshooting(props: Props) {
  const isMobile = useIsMobile();
  return isMobile ? <TroubleshootingMobile {...props} /> : <TroubleshootingDesktop {...props} />;
}
