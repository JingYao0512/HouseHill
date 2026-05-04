import type { ReactNode } from 'react';

export function SidebarLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[10px] font-bold text-text-muted uppercase tracking-[1px] px-2 mb-2.5">
      {children}
    </div>
  );
}

interface SidebarItemProps {
  active?: boolean;
  onClick?: () => void;
  dotColor?: string;
  activeBg?: string;
  activeBorder?: string;
  activeColor?: string;
  children: ReactNode;
  trailing?: ReactNode;
}

export function SidebarItem({
  active,
  onClick,
  dotColor,
  activeBg = '#eff6ff',
  activeBorder = '#bfdbfe',
  activeColor = '#1e40af',
  children,
  trailing,
}: SidebarItemProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 w-full text-left rounded-[8px] mb-0.5 transition-all duration-150 cursor-pointer"
      style={{
        padding: '9px 10px',
        border: active ? `1px solid ${activeBorder}` : '1px solid transparent',
        background: active ? activeBg : 'transparent',
        color: active ? activeColor : '#475569',
        fontSize: 13,
        fontWeight: active ? 600 : 500,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: active ? '#3b82f6' : dotColor ?? '#cbd5e1' }}
      />
      <span className="flex-1 truncate">{children}</span>
      {trailing}
    </button>
  );
}
