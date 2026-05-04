import { useState, useRef, useEffect } from 'react';
import type { PageId } from '../types';
import { SearchIcon } from './icons';

interface NavHeaderProps {
  active: PageId;
  onNav: (id: PageId) => void;
  onSearch?: (q: string) => void;
  onLogout?: () => void;
  isAdmin?: boolean;
  onAdminClick?: () => void;
  mobile?: boolean;
}

const pages: Array<{ id: PageId; icon: string; label: string }> = [
  { id: 'config', icon: '⚙️', label: '設定指引' },
  { id: 'issues', icon: '📋', label: '異常回報' },
  { id: 'troubleshooting', icon: '🔧', label: '故障排除' },
  { id: 'release-notes', icon: '📦', label: '更新紀錄' },
];

function AvatarMenu({
  isAdmin,
  onAdminClick,
  onLogout,
  mobile,
}: {
  isAdmin?: boolean;
  onAdminClick?: () => void;
  onLogout?: () => void;
  mobile?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`${
          mobile ? 'w-7 h-7' : 'w-[30px] h-[30px]'
        } rounded-full bg-[#e2e8f0] text-text-sec text-[11px] font-bold flex items-center justify-center cursor-pointer border-0`}
      >
        A
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 bg-white rounded-[8px] z-50 min-w-[160px] overflow-hidden"
          style={{
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          }}
        >
          <div
            className="px-3.5 py-2.5"
            style={{ borderBottom: '1px solid #f1f5f9' }}
          >
            <div className="text-[13px] font-semibold text-text">admin</div>
            <div className="text-[11px] text-text-muted">
              {isAdmin ? '管理員' : '一般使用者'}
            </div>
          </div>
          {isAdmin && onAdminClick && (
            <button
              onClick={() => {
                setOpen(false);
                onAdminClick();
              }}
              className="block w-full text-left px-3.5 py-2.5 text-[13px] text-text hover:bg-[#f1f5f9] cursor-pointer border-0 bg-transparent"
            >
              🛡️ 管理員後台
            </button>
          )}
          {onLogout && (
            <button
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              className="block w-full text-left px-3.5 py-2.5 text-[13px] text-red hover:bg-[#fef2f2] cursor-pointer border-0 bg-transparent"
            >
              登出
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function NavHeader({
  active,
  onNav,
  onSearch,
  onLogout,
  isAdmin,
  onAdminClick,
  mobile = false,
}: NavHeaderProps) {
  if (mobile) {
    return (
      <header className="bg-white border-b border-border h-[50px] px-4 flex items-center gap-2 flex-shrink-0">
        <div className="w-7 h-7 rounded-[7px] bg-primary flex items-center justify-center text-[14px]">
          🏔️
        </div>
        <span className="font-extrabold text-[15px] text-primary tracking-[-0.3px] flex-1">
          HouseHill
        </span>
        {isAdmin && onAdminClick && (
          <button
            onClick={onAdminClick}
            className="text-[11px] font-bold text-red px-2 py-1 rounded-[6px] bg-red-bg cursor-pointer"
            style={{ border: '1px solid #fecaca' }}
          >
            🛡️ 後台
          </button>
        )}
        <AvatarMenu
          isAdmin={isAdmin}
          onAdminClick={onAdminClick}
          onLogout={onLogout}
          mobile
        />
      </header>
    );
  }

  return (
    <header className="bg-white border-b border-border h-[52px] px-6 flex items-center flex-shrink-0">
      <div className="flex items-center gap-2.5 pr-5 border-r border-border mr-4">
        <div className="w-[30px] h-[30px] rounded-lg bg-primary flex items-center justify-center text-[15px]">
          🏔️
        </div>
        <span className="font-extrabold text-[16px] text-primary tracking-[-0.3px]">
          HouseHill
        </span>
      </div>
      {pages.map((p) => {
        const isActive = active === p.id;
        return (
          <button
            key={p.id}
            onClick={() => onNav(p.id)}
            className="flex items-center gap-1.5 px-3.5 h-[52px] border-0 bg-transparent text-[13px] font-semibold cursor-pointer transition-all duration-150"
            style={{
              color: isActive ? '#0f172a' : '#94a3b8',
              borderBottom: isActive ? '2px solid #0f172a' : '2px solid transparent',
            }}
          >
            <span>{p.icon}</span> {p.label}
          </button>
        );
      })}
      <div className="ml-auto flex items-center gap-2.5">
        <div className="flex items-center gap-1.5 bg-bg border border-border rounded-lg px-3 py-1.5">
          <SearchIcon width={13} height={13} className="text-text-muted" />
          <input
            onChange={(e) => onSearch?.(e.target.value)}
            className="bg-transparent border-0 outline-none text-[13px] text-text w-40 font-sans"
            placeholder="搜尋..."
          />
        </div>
        {isAdmin && onAdminClick && (
          <button
            onClick={onAdminClick}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold text-red rounded-[8px] cursor-pointer"
            style={{ background: '#fef2f2', border: '1px solid #fecaca' }}
          >
            🛡️ 管理員後台
          </button>
        )}
        <AvatarMenu
          isAdmin={isAdmin}
          onAdminClick={onAdminClick}
          onLogout={onLogout}
        />
        <div>
          <div className="text-[12px] font-semibold text-text">admin</div>
          <div className="text-[10px] text-red font-bold">
            {isAdmin ? '管理員' : '使用者'}
          </div>
        </div>
      </div>
    </header>
  );
}
