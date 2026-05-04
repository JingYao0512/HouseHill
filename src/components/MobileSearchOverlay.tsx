import { useEffect, useRef, useState, type ReactNode } from 'react';
import { SearchIcon } from './icons';

interface SearchRenderer<T> {
  match: (item: T, q: string) => boolean;
  render: (item: T, index: number, onClose: () => void) => ReactNode;
}

interface Props<T> {
  open: boolean;
  onClose: () => void;
  placeholder: string;
  data: T[];
  renderResult: SearchRenderer<T>;
}

export function MobileSearchOverlay<T>({
  open,
  onClose,
  placeholder,
  data,
  renderResult,
}: Props<T>) {
  const [q, setQ] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setSubmitted(false);
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!open) return null;

  const results = submitted && q.trim() ? data.filter((item) => renderResult.match(item, q)) : [];

  return (
    <div className="fixed inset-0 z-[200] bg-white flex flex-col">
      {/* Search bar */}
      <div className="bg-primary px-3.5 py-3 flex items-center gap-2.5 flex-shrink-0">
        <button
          onClick={onClose}
          className="bg-transparent border-0 cursor-pointer text-white/70 text-[20px] leading-none p-1 flex-shrink-0"
          aria-label="關閉"
        >
          ←
        </button>
        <div
          className="flex-1 bg-white/10 border border-white/20 rounded-3xl flex items-center gap-2 px-3.5 py-2.5"
        >
          <SearchIcon width={14} height={14} className="text-white/60" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSubmitted(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setSubmitted(true);
            }}
            className="bg-transparent border-0 outline-none text-white text-[15px] flex-1 placeholder-white/50"
            placeholder={placeholder}
          />
          {q && (
            <button
              onClick={() => {
                setQ('');
                setSubmitted(false);
                inputRef.current?.focus();
              }}
              className="bg-transparent border-0 cursor-pointer text-white/50 text-base p-0 leading-none"
            >
              ×
            </button>
          )}
        </div>
        <button
          onClick={() => setSubmitted(true)}
          className="bg-accent/80 border-0 rounded-[20px] text-white text-[13px] font-bold cursor-pointer px-3.5 py-2 flex-shrink-0"
        >
          搜尋
        </button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {!submitted ? (
          <div className="px-5 py-8 text-center">
            <div className="text-4xl mb-3">🔍</div>
            <div className="text-sm font-semibold text-text-sec mb-1.5">輸入關鍵字後按搜尋</div>
            <div className="text-xs text-text-muted">{placeholder}</div>
          </div>
        ) : results.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <div className="text-4xl mb-3">😔</div>
            <div className="text-sm font-semibold text-text-sec mb-1.5">
              找不到「{q}」的相關結果
            </div>
            <div className="text-xs text-text-muted">請嘗試不同的關鍵字</div>
          </div>
        ) : (
          <div className="px-3.5 py-3">
            <div className="text-xs text-text-muted mb-2.5 pl-0.5">
              找到 {results.length} 筆結果
            </div>
            {results.map((item, i) => renderResult.render(item, i, onClose))}
          </div>
        )}
      </div>
    </div>
  );
}
