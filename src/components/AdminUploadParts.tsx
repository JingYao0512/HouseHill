import { useRef, useState, type ReactNode } from 'react';
import { T } from '../tokens';
import { ApiError } from '../api';

/** 與後端 MAX_CONTENT_LENGTH 一致；超過就不必送出。 */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function errMsg(e: unknown): string {
  return e instanceof ApiError ? e.message : (e as Error).message;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** ISO 時間 → 本地「YYYY-MM-DD HH:mm」；空字串回傳空字串。 */
export function formatTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function PanelHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-4">
      <div className="text-lg font-bold text-text">{title}</div>
      <div className="text-[13px] text-text-muted mt-0.5 leading-[1.6]">{subtitle}</div>
    </div>
  );
}

type Tone = 'success' | 'error' | 'warn' | 'info';

const TONE: Record<Tone, { color: string; bg: string; border: string; icon: string }> = {
  success: { color: T.green, bg: T.greenBg, border: T.greenBorder, icon: '✓' },
  error: { color: T.red, bg: T.redBg, border: T.redBorder, icon: '!' },
  warn: { color: T.amber, bg: T.amberBg, border: T.amberBorder, icon: '!' },
  info: { color: T.accentStrong, bg: T.accentBg, border: T.accentBorder, icon: 'i' },
};

export function Notice({ tone, children }: { tone: Tone; children: ReactNode }) {
  const t = TONE[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className="flex gap-2 items-start rounded-[8px] px-3 py-2 mt-3 text-[12px] leading-[1.6]"
      style={{ background: t.bg, border: `1px solid ${t.border}`, color: t.color }}
    >
      <span
        aria-hidden
        className="w-4 h-4 mt-[2px] rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
        style={{ background: t.color }}
      >
        {t.icon}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function StatTile({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      className="rounded-[8px] px-3 py-2.5"
      style={{ background: T.bg, border: `1px solid ${T.border}` }}
    >
      <div className="text-[11px] font-semibold" style={{ color: T.textMuted }}>
        {label}
      </div>
      <div className="text-xl font-extrabold tabular-nums mt-0.5" style={{ color: value > 0 ? color : T.textMuted }}>
        {value}
      </div>
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`bg-white rounded-[12px] p-4 ${className}`}
      style={{ border: `1px solid ${T.border}`, boxShadow: T.shadow }}
    >
      {children}
    </div>
  );
}

export function PrimaryButton({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-2 bg-primary text-white border-0 rounded-[8px] text-[13px] font-bold"
      style={{ cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1 }}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-2 bg-white rounded-[8px] text-[13px] font-semibold text-text-sec"
      style={{
        border: `1px solid ${T.border}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {children}
    </button>
  );
}

/** 可收合的清單；total 超過顯示筆數時提示剩餘數量。 */
export function CollapsibleList({
  title,
  total,
  items,
  mono = false,
}: {
  title: string;
  total: number;
  items: string[];
  mono?: boolean;
}) {
  if (total === 0) return null;
  return (
    <details className="mt-2.5 group">
      <summary className="cursor-pointer text-[12px] font-semibold text-text-sec select-none">
        {title}（{total}）
      </summary>
      <ul
        className={`mt-1.5 rounded-[8px] px-3 py-2 text-[12px] leading-[1.7] max-h-[220px] overflow-y-auto break-all ${
          mono ? 'font-mono' : ''
        }`}
        style={{ background: T.bg, border: `1px solid ${T.border}`, color: T.textSec }}
      >
        {items.map((k, i) => (
          <li key={`${k}-${i}`}>{k}</li>
        ))}
        {total > items.length && (
          <li style={{ color: T.textMuted }}>…另有 {total - items.length} 筆未列出</li>
        )}
      </ul>
    </details>
  );
}

/** 點擊或拖放選擇 .xlsx；在前端先擋掉副檔名與大小不符的檔案。 */
export function XlsxDropZone({
  file,
  disabled,
  hint,
  onPick,
}: {
  file: File | null;
  disabled?: boolean;
  hint?: string;
  onPick: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const accept = (f: File | undefined) => {
    if (!f) return;
    if (!/\.xlsx$/i.test(f.name)) {
      setLocalError('只接受 .xlsx 檔案（舊版 .xls 請先用 Excel 另存為 .xlsx）');
      return;
    }
    if (f.size > MAX_UPLOAD_BYTES) {
      setLocalError(`檔案 ${formatBytes(f.size)}，超過 10 MB 上限`);
      return;
    }
    setLocalError(null);
    onPick(f);
  };

  const open = () => {
    if (!disabled) inputRef.current?.click();
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label="選擇 .xlsx 檔案"
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            open();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (!disabled) accept(e.dataTransfer.files[0]);
        }}
        className="rounded-[12px] px-4 py-6 text-center transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-accent"
        style={{
          border: `1.5px dashed ${over ? T.accent : T.border}`,
          background: over ? T.accentBg : T.surface,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <div className="text-2xl mb-1.5" aria-hidden>
          📄
        </div>
        {file ? (
          <>
            <div className="text-[13px] font-semibold text-text break-all">{file.name}</div>
            <div className="text-[11px] mt-0.5" style={{ color: T.textMuted }}>
              {formatBytes(file.size)} · 點擊或拖曳可更換檔案
            </div>
          </>
        ) : (
          <>
            <div className="text-[13px] font-semibold text-text">點擊選擇，或把 .xlsx 檔案拖曳到這裡</div>
            {hint && (
              <div className="text-[11px] mt-1 leading-[1.6]" style={{ color: T.textMuted }}>
                {hint}
              </div>
            )}
          </>
        )}
      </div>
      {/* 放在可點區塊外，避免 input 的 click 冒泡回去又觸發一次開檔 */}
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => {
          accept(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {localError && <Notice tone="error">{localError}</Notice>}
    </div>
  );
}
