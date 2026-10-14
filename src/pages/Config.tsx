import { useState, useMemo } from 'react';
import { TopBar } from '../components/TopBar';
import { NavHeader } from '../components/NavHeader';
import { MobileNav } from '../components/MobileNav';
import { LoadingState, ErrorState } from '../components/States';
import { T } from '../tokens';
import {
  fetchConfig,
  fetchArticles,
  type ConfigItem,
  type WorkbookData,
  type ArticleListItem,
} from '../api';
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

/** 攤平後的參數：帶上所屬分頁，並給一個全域唯一 id（key 會跨分頁重複，共 17 個）。 */
type Param = ConfigItem & { sheet: string; uid: string };

const isBlank = (v: string) => !v || v.trim() === '' || v.trim() === '-';
const show = (v: string) => (isBlank(v) ? '—' : v.trim());

/** 長字串（路徑、逗號串接的清單）沒有空白可斷行時，允許在任意位置換行，避免撐破版面。 */
const WRAP = { overflowWrap: 'anywhere' } as const;

function flatten(data: WorkbookData | null): Param[] {
  if (!data) return [];
  return Object.entries(data).flatMap(([sheet, items]) =>
    items
      .filter((i) => i.key)
      .map((i) => ({ ...i, sheet, uid: `${sheet}|${i.section}|${i.key}` }))
  );
}

function matches(p: Param, q: string) {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return [p.key, p.description, p.default, p.options, p.attribute, p.section, p.sheet]
    .filter(Boolean)
    .some((x) => x.toLowerCase().includes(s));
}

// ── Search ───────────────────────────────────────────────────────────

function CfgSearch({
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
        height: mobile ? 44 : 48,
        boxShadow: T.shadow,
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          mobile ? '搜尋設定，例如：DICOM、Port' : '搜尋設定，例如：DICOM、Port、語系、SavingFolder'
        }
        className="flex-1 min-w-0 border-0 outline-none bg-transparent text-[15px] text-text font-sans"
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

// ── Category chips（分頁） ───────────────────────────────────────────

function CfgChips({
  cats,
  value,
  onChange,
  counts,
  mobile,
}: {
  cats: string[];
  value: string;
  onChange: (c: string) => void;
  counts: Record<string, number>;
  mobile?: boolean;
}) {
  return (
    <div
      className={`flex gap-1.5 ${
        mobile ? 'flex-nowrap overflow-x-auto pb-0.5 no-scrollbar' : 'flex-wrap'
      }`}
    >
      {['全部', ...cats].map((c) => {
        const on = value === c;
        return (
          <button
            key={c}
            onClick={() => onChange(c)}
            className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap transition-all duration-150"
            style={{
              padding: '6px 12px',
              borderRadius: 20,
              border: `1px solid ${on ? T.primary : T.border}`,
              background: on ? T.primary : T.surface,
              color: on ? 'white' : T.textSec,
            }}
          >
            {c}
            <span
              className="text-[11px] font-medium"
              style={{ color: on ? 'rgba(255,255,255,0.65)' : T.textMuted }}
            >
              {counts[c] ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Row ──────────────────────────────────────────────────────────────

function CfgRow({
  p,
  open,
  onToggle,
  related,
  onOpenArticle,
  mobile,
  last,
}: {
  p: Param;
  open: boolean;
  onToggle: () => void;
  related: ArticleListItem[];
  onOpenArticle: () => void;
  mobile?: boolean;
  last?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const uiSettable = p.ui_settable?.trim().toUpperCase() === 'YES';
  const line = `${p.key} = ${isBlank(p.default) ? '' : p.default.trim()}`;

  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      navigator.clipboard.writeText(line);
    } catch {
      /* 剪貼簿不可用時靜默略過 */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  // 預設值徽章：長值（最長約 50 字）會換行，不再撐開整列。
  const defaultBadge = (
    <span
      className="inline-block max-w-full text-left font-medium text-text bg-white"
      style={{
        fontFamily: MONO,
        fontSize: mobile ? 12 : 13,
        border: `1px solid ${T.border}`,
        padding: mobile ? '2px 8px' : '3px 10px',
        borderRadius: 6,
        ...WRAP,
      }}
    >
      {show(p.default)}
    </span>
  );

  return (
    <div style={{ borderBottom: last ? 'none' : `1px solid ${T.borderLight}` }}>
      <button
        onClick={onToggle}
        className="w-full flex items-center border-0 cursor-pointer text-left font-sans transition-colors duration-150"
        style={{
          gap: mobile ? 10 : 16,
          padding: mobile ? '12px 14px' : '14px 18px',
          background: open ? T.bg : 'transparent',
        }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-[3px] flex-wrap">
            {/* 保留 Excel 儲存格內的換行 */}
            <span className="text-sm font-semibold text-text whitespace-pre-line min-w-0" style={WRAP}>
              {show(p.description)}
            </span>
            {uiSettable && (
              <span
                className="text-[10px] font-bold whitespace-nowrap"
                style={{
                  color: T.green,
                  background: T.greenBg,
                  border: `1px solid ${T.greenBorder}`,
                  padding: '1px 6px',
                  borderRadius: 4,
                }}
              >
                介面可設定
              </span>
            )}
          </div>
          <div className="text-xs break-all" style={{ fontFamily: MONO, color: T.accentStrong }}>
            {p.key}
          </div>
          {/* 手機：預設值放在 key 下方，不和說明搶寬度 */}
          {mobile && (
            <div className="flex items-start gap-1.5 mt-1.5">
              <span className="text-[10px] flex-shrink-0 pt-[3px]" style={{ color: T.textMuted }}>
                預設值
              </span>
              {defaultBadge}
            </div>
          )}
        </div>
        {/* 桌機：預設值在右欄，最多佔 40% 寬，過長就換行 */}
        {!mobile && (
          <div className="text-right min-w-0 flex-shrink" style={{ maxWidth: '40%' }}>
            <div className="text-[10px] mb-1" style={{ color: T.textMuted }}>
              預設值
            </div>
            {defaultBadge}
          </div>
        )}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke={T.textMuted}
          strokeWidth="2"
          className="flex-shrink-0"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div style={{ padding: mobile ? '2px 14px 14px' : '2px 18px 16px', background: T.bg }}>
          <div
            className="flex items-start gap-2.5"
            style={{
              background: '#0f172a',
              borderRadius: 8,
              padding: '10px 12px 10px 14px',
              fontFamily: MONO,
              fontSize: 12.5,
              color: '#e2e8f0',
            }}
          >
            {/* 長值換行顯示，不用橫向捲動（手機上捲動條容易看不到後半段） */}
            <span className="flex-1 min-w-0 pt-[3px] leading-[1.6]" style={WRAP}>
              <span style={{ color: '#93c5fd' }}>{p.key}</span>
              {' = '}
              <span style={{ color: '#fde68a' }}>{show(p.default)}</span>
            </span>
            <button
              onClick={copy}
              className="flex-shrink-0 text-[11px] font-semibold text-white cursor-pointer font-sans"
              style={{
                border: '1px solid rgba(255,255,255,0.2)',
                background: copied ? 'rgba(22,163,74,0.35)' : 'rgba(255,255,255,0.08)',
                borderRadius: 6,
                padding: '4px 10px',
              }}
            >
              {copied ? '已複製' : '複製'}
            </button>
          </div>

          {/* 可填值：來源 Excel 有這欄（118/219 筆），舊版畫面從未顯示 */}
          {!isBlank(p.options) && (
            <div className="mt-2.5 text-xs flex gap-2" style={{ color: T.textSec }}>
              <span className="flex-shrink-0" style={{ color: T.textMuted }}>
                可填值
              </span>
              {/* 有些可填值在 Excel 裡是一行一個選項，保留換行 */}
              <span
                className="min-w-0 whitespace-pre-line leading-[1.6]"
                style={{ fontFamily: MONO, color: T.text, ...WRAP }}
              >
                {p.options.trim()}
              </span>
            </div>
          )}

          <div
            className="flex flex-wrap mt-2.5 text-xs"
            style={{ gap: mobile ? 12 : 20, color: T.textSec, ...WRAP }}
          >
            <span>
              類型{'　'}
              <span style={{ fontFamily: MONO, color: T.purple, fontWeight: 600 }}>
                {show(p.attribute)}
              </span>
            </span>
            <span>
              分類　{p.sheet}
              {p.section ? ` · ${p.section}` : ''}
            </span>
            <span>{uiSettable ? '可由軟體介面設定' : '需修改設定檔'}</span>
          </div>

          {related.length > 0 && (
            <div className="mt-3">
              <div className="text-[11px] font-bold mb-1.5" style={{ color: T.textMuted }}>
                相關故障排除
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {related.map((a) => (
                  <button
                    key={a.slug}
                    onClick={onOpenArticle}
                    className="text-xs cursor-pointer font-sans max-w-full text-left"
                    style={{
                      ...WRAP,
                      color: T.accentStrong,
                      background: T.accentBg,
                      border: `1px solid ${T.accentBorder}`,
                      padding: '3px 10px',
                      borderRadius: 20,
                    }}
                  >
                    {a.title} →
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Body ─────────────────────────────────────────────────────────────

function CfgBody({
  mobile,
  query,
  setQuery,
  onNav,
}: {
  mobile?: boolean;
  query: string;
  setQuery: (q: string) => void;
  onNav: (id: PageId) => void;
}) {
  const { data, loading, error, reload } = useApi<WorkbookData>((signal) => fetchConfig(signal), []);
  const articles = useApi<ArticleListItem[]>((signal) => fetchArticles({}, signal), []);
  const [cat, setCat] = useState('全部');
  const [open, setOpen] = useState<string | null>(null);

  const all = useMemo(() => flatten(data), [data]);
  const sheets = useMemo(() => (data ? Object.keys(data) : []), [data]);
  const matched = useMemo(() => all.filter((p) => matches(p, query)), [all, query]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { 全部: matched.length };
    sheets.forEach((s) => {
      c[s] = matched.filter((p) => p.sheet === s).length;
    });
    return c;
  }, [matched, sheets]);

  /** 晶片依「分頁」篩選；群組再依 section 細分（System 有 147 項，只分到分頁太粗）。 */
  const groups = useMemo(() => {
    const visible = matched.filter((p) => cat === '全部' || p.sheet === cat);
    const out: { id: string; sheet: string; section: string; items: Param[] }[] = [];
    visible.forEach((p) => {
      const id = `${p.sheet}|${p.section}`;
      const g = out.find((x) => x.id === id);
      if (g) g.items.push(p);
      else out.push({ id, sheet: p.sheet, section: p.section, items: [p] });
    });
    return out;
  }, [matched, cat]);

  /** key → 有引用該 key 的故障排除文章 */
  const relatedByKey = useMemo(() => {
    const m: Record<string, ArticleListItem[]> = {};
    (articles.data ?? []).forEach((a) => {
      (a.related_config_keys ?? []).forEach((k) => {
        (m[k] ||= []).push(a);
      });
    });
    return m;
  }, [articles.data]);

  return (
    <div
      style={{
        maxWidth: 820,
        margin: '0 auto',
        padding: mobile ? '16px 14px 24px' : '28px 32px 40px',
      }}
    >
      <div
        className="font-extrabold text-text"
        style={{ fontSize: mobile ? 18 : 22, letterSpacing: '-0.4px' }}
      >
        設定指引
      </div>
      <div
        className="text-[13px] mt-1"
        style={{ color: T.textMuted, marginBottom: mobile ? 12 : 16 }}
      >
        搜尋要調整的設定，點選即可查看寫法與相關說明
      </div>

      <CfgSearch value={query} onChange={setQuery} mobile={mobile} />

      {sheets.length > 0 && (
        <div className="mt-3">
          <CfgChips cats={sheets} value={cat} onChange={setCat} counts={counts} mobile={mobile} />
        </div>
      )}

      <div
        className="text-xs"
        style={{
          marginTop: 12,
          marginBottom: mobile ? 16 : 22,
          color: '#92400e',
          background: T.amberBg,
          border: `1px solid ${T.amberBorder}`,
          borderRadius: 8,
          padding: '8px 12px',
        }}
      >
        <strong>注意：</strong>修改設定後需重啟服務方能生效
      </div>

      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && groups.length === 0 && (
        <div
          className="text-center"
          style={{
            padding: '40px 16px',
            background: T.surface,
            border: `1px dashed ${T.border}`,
            borderRadius: T.radius,
          }}
        >
          <div className="text-sm font-semibold mb-1" style={{ color: T.textSec }}>
            {query ? `找不到「${query}」相關的設定` : '目前沒有設定資料'}
          </div>
          <div className="text-xs" style={{ color: T.textMuted }}>
            試試其他關鍵字，或到「故障排除」搜尋
          </div>
        </div>
      )}

      {!loading &&
        !error &&
        groups.map((g) => (
          <section key={g.id} style={{ marginBottom: mobile ? 16 : 20 }}>
            <div className="flex flex-wrap items-baseline gap-x-2 mb-2 px-0.5">
              <span className="text-[13px] font-bold text-text min-w-0" style={WRAP}>
                {g.section || g.sheet}
              </span>
              {cat === '全部' && g.section && (
                <span className="text-[11px]" style={{ color: T.textMuted }}>
                  {g.sheet}
                </span>
              )}
              <span className="text-xs" style={{ color: T.textMuted }}>
                {g.items.length} 項
              </span>
            </div>
            <div
              className="bg-white overflow-hidden"
              style={{
                border: `1px solid ${T.border}`,
                borderRadius: T.radius,
                boxShadow: T.shadow,
              }}
            >
              {g.items.map((p, i) => (
                <CfgRow
                  key={p.uid}
                  p={p}
                  mobile={mobile}
                  last={i === g.items.length - 1}
                  open={open === p.uid}
                  onToggle={() => setOpen(open === p.uid ? null : p.uid)}
                  related={relatedByKey[p.key] ?? []}
                  onOpenArticle={() => onNav('troubleshooting')}
                />
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────

export default function Config({ onNav, onLogout, isAdmin, onAdminClick }: Props) {
  const isMobile = useIsMobile();
  const [query, setQuery] = useState('');

  return (
    <div className="w-full h-full flex flex-col bg-bg font-sans">
      <TopBar />
      <NavHeader
        active="config"
        onNav={onNav}
        onSearch={setQuery}
        onLogout={onLogout}
        isAdmin={isAdmin}
        onAdminClick={onAdminClick}
        mobile={isMobile}
      />
      <main className="flex-1 overflow-y-auto">
        <CfgBody mobile={isMobile} query={query} setQuery={setQuery} onNav={onNav} />
      </main>
      {isMobile && <MobileNav active="config" onNav={onNav} />}
    </div>
  );
}
