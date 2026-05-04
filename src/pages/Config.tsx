import { useState, useMemo } from 'react';
import { TopBar } from '../components/TopBar';
import { NavHeader } from '../components/NavHeader';
import { MobileNav } from '../components/MobileNav';
import { SearchFAB } from '../components/SearchFAB';
import { MobileSearchOverlay } from '../components/MobileSearchOverlay';
import { SidebarLabel, SidebarItem } from '../components/Sidebar';
import { LoadingState, EmptyState, ErrorState } from '../components/States';
import { ChevronRight, ChevronDown, TableIcon } from '../components/icons';
import { T } from '../tokens';
import { fetchConfig, type ConfigItem, type WorkbookData } from '../api';
import { useApi } from '../hooks/useApi';
import type { PageId } from '../types';
import { useIsMobile } from '../hooks/useMediaQuery';

interface Props {
  onNav: (id: PageId) => void;
  onLogout?: () => void;
  isAdmin?: boolean;
  onAdminClick?: () => void;
}

function ConfigDesktop({ onNav, onLogout, isAdmin, onAdminClick }: Props) {
  const { data, loading, error, reload } = useApi<WorkbookData>(
    (signal) => fetchConfig(signal),
    []
  );
  const sheets = useMemo(() => (data ? Object.keys(data) : []), [data]);
  const [active, setActive] = useState<string | null>(null);
  const sheet = active ?? sheets[0] ?? null;
  const items = sheet && data ? data[sheet] : [];

  return (
    <div className="w-full h-full flex flex-col bg-bg">
      <TopBar />
      <NavHeader
        active="config"
        onNav={onNav}
        onLogout={onLogout}
        isAdmin={isAdmin}
        onAdminClick={onAdminClick}
      />
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-[200px] bg-white border-r border-border px-2.5 py-4 flex-shrink-0 overflow-y-auto">
          <SidebarLabel>設定類別</SidebarLabel>
          {sheets.map((s) => (
            <SidebarItem key={s} active={sheet === s} onClick={() => setActive(s)}>
              {s}
            </SidebarItem>
          ))}
          {!loading && sheets.length === 0 && !error && (
            <div className="text-[11px] text-text-muted px-2">尚無設定資料</div>
          )}
          <div
            className="mt-5 rounded-[8px] p-3"
            style={{ background: T.amberBg, border: `1px solid ${T.amberBorder}` }}
          >
            <div className="text-[11px] font-bold text-amber mb-1">⚠️ 注意</div>
            <p className="text-[11px] leading-[1.6]" style={{ color: '#92400e' }}>
              修改後需<strong>重啟服務</strong>方能生效
            </p>
          </div>
        </aside>
        <main className="flex-1 overflow-y-auto px-7 py-5">
          {loading && <LoadingState />}
          {error && <ErrorState message={error} onRetry={reload} />}
          {!loading && !error && (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-[13px] text-text-muted">
                  <span>設定類別</span>
                  <ChevronRight width={12} height={12} />
                  <span className="font-bold text-text text-[17px]">{sheet ?? '—'}</span>
                </div>
                <span
                  className="text-[11px] text-text-muted bg-white px-3 py-[3px] rounded-[20px]"
                  style={{ border: `1px solid ${T.border}` }}
                >
                  {items.length} 個參數
                </span>
              </div>
              {sheet && items.length > 0 ? (
                <ConfigTable items={items} />
              ) : (
                <EmptyState title="此類別目前沒有參數" hint="請選擇其他類別或檢查資料來源。" />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function ConfigTable({ items }: { items: ConfigItem[] }) {
  return (
    <div
      className="bg-white rounded-xl overflow-hidden"
      style={{ border: `1px solid ${T.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
    >
      <div
        className="bg-bg px-4 py-2.5 text-xs font-bold text-text-sec flex items-center gap-1.5"
        style={{ borderBottom: `1px solid ${T.border}` }}
      >
        <TableIcon width={14} height={14} />
        參數列表
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-bg" style={{ borderBottom: `1px solid ${T.border}` }}>
            {['參數名稱', '說明', '類型', '預設值', 'UI 可設定'].map((h) => (
              <th
                key={h}
                className="px-4 py-2.5 text-[11px] font-bold text-text-muted text-left uppercase tracking-[0.5px] whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((p, i) => (
            <ConfigRow key={`${p.section}-${p.key}-${i}`} p={p} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

const SectionRow = ({ section }: { section: string }) => (
  <tr style={{ background: T.bg }}>
    <td
      colSpan={5}
      className="px-4 py-2 font-mono text-xs font-bold text-text-sec uppercase tracking-[0.5px]"
    >
      [{section}]
    </td>
  </tr>
);

function ConfigRow({ p }: { p: ConfigItem }) {
  if (p.section && !p.key) return <SectionRow section={p.section} />;
  return (
    <tr style={{ borderBottom: `1px solid ${T.borderLight}` }}>
      <td className="px-4 py-3 align-top">
        <span
          className="font-mono text-xs font-medium px-2 py-[3px] rounded-[5px]"
          style={{
            color: T.accentStrong,
            background: T.accentBg,
            border: `1px solid ${T.accentBorder}`,
          }}
        >
          {p.key}
        </span>
      </td>
      <td className="px-4 py-3 text-[13px] text-text align-top max-w-[360px]">{p.description}</td>
      <td className="px-4 py-3 align-top">
        {p.attribute && p.attribute !== '-' && (
          <span
            className="text-[11px] font-semibold px-2 py-[2px] rounded-[20px]"
            style={{ color: T.purple, background: T.purpleBg, border: `1px solid ${T.purpleBorder}` }}
          >
            {p.attribute}
          </span>
        )}
      </td>
      <td className="px-4 py-3 font-mono text-xs text-text-sec align-top">{p.default}</td>
      <td className="px-4 py-3 align-top">
        {p.ui_settable && p.ui_settable.toUpperCase() === 'YES' ? (
          <span
            className="text-[11px] font-bold px-2 py-[2px] rounded-[5px]"
            style={{ color: T.green, background: T.greenBg, border: `1px solid ${T.greenBorder}` }}
          >
            YES
          </span>
        ) : (
          <span className="text-[11px] text-text-muted">—</span>
        )}
      </td>
    </tr>
  );
}

function ConfigMobile({ onNav, onLogout, isAdmin, onAdminClick }: Props) {
  const { data, loading, error, reload } = useApi<WorkbookData>(
    (signal) => fetchConfig(signal),
    []
  );
  const sheets = useMemo(() => (data ? Object.keys(data) : []), [data]);
  const [active, setActive] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const sheet = active ?? sheets[0] ?? null;
  const items = sheet && data ? data[sheet] : [];

  const allParams = useMemo(() => {
    if (!data) return [];
    return Object.entries(data).flatMap(([cat, ps]) =>
      ps.filter((p) => p.key).map((p) => ({ ...p, cat }))
    );
  }, [data]);

  const renderResult = {
    match: (item: ConfigItem & { cat: string }, q: string) =>
      item.key.includes(q) || item.description.includes(q) || (item.default ?? '').includes(q),
    render: (item: ConfigItem & { cat: string }, i: number) => (
      <div
        key={i}
        className="bg-white rounded-[8px] px-3.5 py-3 mb-2.5"
        style={{ border: `1px solid ${T.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
      >
        <div className="flex items-center justify-between gap-2 mb-1">
          <span
            className="font-mono text-xs px-2 py-[3px] rounded-[5px] break-all"
            style={{
              color: T.accentStrong,
              background: T.accentBg,
              border: `1px solid ${T.accentBorder}`,
            }}
          >
            {item.key}
          </span>
          <span
            className="text-[10px] text-text-muted bg-bg px-2 py-[2px] rounded-[10px] whitespace-nowrap flex-shrink-0"
            style={{ border: `1px solid ${T.border}` }}
          >
            {item.cat}
          </span>
        </div>
        <div className="text-[13px] text-text mb-1">{item.description}</div>
        <div className="text-[11px] text-text-muted">
          預設：<span className="font-mono text-text-sec">{item.default}</span>
        </div>
      </div>
    ),
  };

  return (
    <div className="w-full h-full flex flex-col bg-bg font-sans relative">
      <TopBar />
      <NavHeader
        active="config"
        onNav={onNav}
        onLogout={onLogout}
        isAdmin={isAdmin}
        onAdminClick={onAdminClick}
        mobile
      />
      <MobileSearchOverlay
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        placeholder="搜尋參數名稱或說明..."
        data={allParams}
        renderResult={renderResult}
      />
      <div
        className="bg-white px-3.5 py-2.5 flex items-center gap-2.5"
        style={{ borderBottom: `1px solid ${T.border}` }}
      >
        <button
          onClick={() => setShowList(!showList)}
          className="flex items-center gap-2 flex-1 bg-bg rounded-[8px] px-3 py-2.5 text-sm font-semibold text-text justify-between cursor-pointer"
          style={{ border: `1px solid ${T.border}` }}
        >
          <span>{sheet ?? '—'}</span>
          <ChevronDown width={14} height={14} />
        </button>
        <span
          className="text-[11px] text-text-muted bg-white px-2.5 py-1 rounded-[20px] whitespace-nowrap"
          style={{ border: `1px solid ${T.border}` }}
        >
          {items.length} 項
        </span>
      </div>
      {showList && sheets.length > 0 && (
        <div
          className="bg-white rounded-[8px] mx-3.5 absolute left-0 right-0 z-50"
          style={{
            top: 130,
            border: `1px solid ${T.border}`,
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          }}
        >
          {sheets.map((c) => (
            <button
              key={c}
              onClick={() => {
                setActive(c);
                setShowList(false);
              }}
              className="block w-full px-4 py-3 border-0 text-sm cursor-pointer text-left"
              style={{
                borderBottom: `1px solid ${T.borderLight}`,
                background: sheet === c ? T.accentBg : 'transparent',
                color: sheet === c ? T.accentStrong : T.text,
                fontWeight: sheet === c ? 600 : 400,
              }}
            >
              {c}
            </button>
          ))}
        </div>
      )}
      <main className="flex-1 overflow-y-auto px-3.5 pt-3.5 pb-20">
        {loading && <LoadingState />}
        {error && <ErrorState message={error} onRetry={reload} />}
        {!loading && !error && items.filter((p) => p.key).length === 0 && (
          <EmptyState title="此類別目前沒有參數" />
        )}
        {!loading && !error &&
          items.map((p, i) => {
            if (!p.key) {
              return p.section ? (
                <div
                  key={`s-${i}`}
                  className="font-mono text-[11px] font-bold text-text-muted uppercase tracking-[1px] mt-3 mb-1.5 px-1"
                >
                  [{p.section}]
                </div>
              ) : null;
            }
            return (
              <div
                key={`${p.key}-${i}`}
                className="bg-white rounded-[8px] px-3.5 py-3 mb-2.5"
                style={{
                  border: `1px solid ${T.border}`,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                }}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span
                    className="font-mono text-xs font-medium px-2 py-[3px] rounded-[5px] break-all"
                    style={{
                      color: T.accentStrong,
                      background: T.accentBg,
                      border: `1px solid ${T.accentBorder}`,
                    }}
                  >
                    {p.key}
                  </span>
                  {p.ui_settable?.toUpperCase() === 'YES' && (
                    <span
                      className="text-[10px] font-bold px-1.5 py-[2px] rounded-[4px] whitespace-nowrap flex-shrink-0"
                      style={{
                        color: T.green,
                        background: T.greenBg,
                        border: `1px solid ${T.greenBorder}`,
                      }}
                    >
                      UI
                    </span>
                  )}
                </div>
                <div className="text-[13px] text-text mb-1.5">{p.description}</div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-text-muted">預設：</span>
                  <span className="font-mono text-xs text-text-sec">{p.default}</span>
                  {p.attribute && p.attribute !== '-' && (
                    <span
                      className="ml-auto text-[11px] font-semibold px-1.5 py-[2px] rounded-[20px]"
                      style={{
                        color: T.purple,
                        background: T.purpleBg,
                        border: `1px solid ${T.purpleBorder}`,
                      }}
                    >
                      {p.attribute}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
      </main>
      <SearchFAB onOpen={() => setSearchOpen(true)} />
      <MobileNav active="config" onNav={onNav} />
    </div>
  );
}

export default function Config(props: Props) {
  const isMobile = useIsMobile();
  return isMobile ? <ConfigMobile {...props} /> : <ConfigDesktop {...props} />;
}
