import { SearchIcon } from './icons';

interface Props {
  onOpen: () => void;
}

export function SearchFAB({ onOpen }: Props) {
  return (
    <button
      onClick={onOpen}
      className="fixed bottom-[70px] right-4 w-12 h-12 rounded-full bg-primary text-white border-0 cursor-pointer flex items-center justify-center transition-transform duration-150 active:scale-95 z-30"
      style={{ boxShadow: '0 4px 14px rgba(15,23,42,0.35)' }}
      aria-label="搜尋"
    >
      <SearchIcon width={20} height={20} strokeWidth={2.5} className="text-white" />
    </button>
  );
}
