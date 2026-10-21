import { useEffect, useState } from 'react';
import { T } from '../tokens';
import { LoadingState, ErrorState } from './States';
import { useApi } from '../hooks/useApi';
import { fetchConfigInfo, fetchConfigSheetOrder, saveConfigSheetOrder } from '../api';
import { Card, Notice, PanelHeader, PrimaryButton, SecondaryButton, errMsg } from './AdminUploadParts';

const MONO = "'JetBrains Mono',monospace";

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="w-8 h-8 rounded-[6px] bg-white text-[13px] font-bold flex items-center justify-center"
      style={{
        border: `1px solid ${T.border}`,
        color: disabled ? T.textMuted : T.textSec,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {children}
    </button>
  );
}

/** 後台：調整「設定指引」分頁（System / Generator / …）的顯示順序，所有使用者看到同一順序。 */
export default function ConfigSheetOrderPanel() {
  const { data, loading, error, reload } = useApi(
    (signal) => Promise.all([fetchConfigSheetOrder(signal), fetchConfigInfo(signal)]),
    []
  );
  const [order, setOrder] = useState<string[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!data) return;
    setOrder(data[0].sheet_order);
    setSaved(data[0].sheet_order);
  }, [data]);

  const counts = Object.fromEntries((data?.[1].sheets ?? []).map((s) => [s.name, s.items]));
  const dirty = order.join('\u0000') !== saved.join('\u0000');

  const change = (next: string[]) => {
    setOrder(next);
    setMsg(null);
  };

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await saveConfigSheetOrder(order);
      setOrder(res.sheet_order);
      setSaved(res.sheet_order);
      setMsg({ tone: 'success', text: '已儲存，所有使用者的設定指引會依此順序顯示。' });
    } catch (e) {
      setMsg({ tone: 'error', text: `儲存失敗：${errMsg(e)}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-[640px]">
      <PanelHeader
        title="設定指引排序"
        subtitle="調整設定指引頁上方分頁（System、Generator…）的顯示順序，以及「全部」時的列出順序。可拖曳或用箭頭調整，儲存後對所有使用者生效。之後上傳的設定檔若有新分頁，會自動排在最後。"
      />

      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && (
        <Card>
          <ol className="list-none m-0 p-0">
            {order.map((sheet, i) => (
              <li
                key={sheet}
                draggable
                onDragStart={(e) => {
                  setDragFrom(i);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  if (dragFrom === null) return;
                  e.preventDefault();
                  if (dragFrom !== i) {
                    change(move(order, dragFrom, i));
                    setDragFrom(i);
                  }
                }}
                onDragEnd={() => setDragFrom(null)}
                className="flex items-center gap-3 rounded-[8px] px-3 py-2 mb-1.5 select-none"
                style={{
                  background: dragFrom === i ? T.accentBg : T.bg,
                  border: `1px solid ${dragFrom === i ? T.accentBorder : T.borderLight}`,
                  cursor: 'grab',
                }}
              >
                <span aria-hidden className="text-sm" style={{ color: T.textMuted }}>
                  ⋮⋮
                </span>
                <span
                  className="w-6 text-right text-xs font-bold tabular-nums"
                  style={{ color: T.textMuted }}
                >
                  {i + 1}
                </span>
                <span className="flex-1 min-w-0 truncate text-sm font-semibold text-text" style={{ fontFamily: MONO }}>
                  {sheet}
                </span>
                {counts[sheet] !== undefined && (
                  <span className="text-[11px] flex-shrink-0" style={{ color: T.textMuted }}>
                    {counts[sheet]} 項
                  </span>
                )}
                <div className="flex gap-1 flex-shrink-0">
                  <IconButton label={`將 ${sheet} 移到最前`} disabled={i === 0} onClick={() => change(move(order, i, 0))}>
                    ⤒
                  </IconButton>
                  <IconButton label={`將 ${sheet} 上移`} disabled={i === 0} onClick={() => change(move(order, i, i - 1))}>
                    ↑
                  </IconButton>
                  <IconButton
                    label={`將 ${sheet} 下移`}
                    disabled={i === order.length - 1}
                    onClick={() => change(move(order, i, i + 1))}
                  >
                    ↓
                  </IconButton>
                </div>
              </li>
            ))}
          </ol>

          {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

          <div className="flex gap-2 mt-4 flex-wrap">
            <PrimaryButton onClick={save} disabled={busy || !dirty}>
              {busy ? '儲存中…' : '儲存排序'}
            </PrimaryButton>
            <SecondaryButton onClick={() => change(saved)} disabled={busy || !dirty}>
              還原
            </SecondaryButton>
          </div>
        </Card>
      )}
    </div>
  );
}
