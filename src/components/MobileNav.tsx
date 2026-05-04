import type { PageId } from '../types';

interface Props {
  active: PageId;
  onNav: (id: PageId) => void;
}

const pages: Array<{ id: PageId; icon: string; label: string }> = [
  { id: 'config', icon: '⚙️', label: '設定' },
  { id: 'issues', icon: '📋', label: '回報' },
  { id: 'troubleshooting', icon: '🔧', label: '排除' },
  { id: 'release-notes', icon: '📦', label: '更新' },
];

export function MobileNav({ active, onNav }: Props) {
  return (
    <nav className="sticky bottom-0 left-0 right-0 bg-white border-t border-border flex flex-shrink-0 z-20">
      {pages.map((p) => {
        const isActive = active === p.id;
        return (
          <button
            key={p.id}
            onClick={() => onNav(p.id)}
            className="flex-1 flex flex-col items-center gap-[3px] pt-2 pb-2.5 border-0 bg-transparent cursor-pointer text-[10px] font-semibold transition-all duration-150"
            style={{
              color: isActive ? '#0f172a' : '#94a3b8',
              borderTop: isActive ? '2px solid #0f172a' : '2px solid transparent',
            }}
          >
            <span className="text-lg leading-none">{p.icon}</span>
            {p.label}
          </button>
        );
      })}
    </nav>
  );
}
