import type { ReactNode } from 'react';

interface BadgeProps {
  color: string;
  bg: string;
  border: string;
  children: ReactNode;
  size?: 'sm' | 'md';
}

export function Badge({ color, bg, border, children, size = 'md' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center font-bold whitespace-nowrap rounded-[20px] ${
        size === 'sm' ? 'text-[10px] px-2 py-[1px]' : 'text-[11px] px-[9px] py-[2px]'
      }`}
      style={{ color, background: bg, border: `1px solid ${border}` }}
    >
      {children}
    </span>
  );
}
