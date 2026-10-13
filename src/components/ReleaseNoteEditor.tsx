import { useState, useMemo, useEffect } from 'react';
import { LoadingState, ErrorState } from './States';
import { T } from '../tokens';
import { fetchReleaseNoteRaw, saveReleaseNote, ApiError } from '../api';

// ── Release note editor (admin only) ─────────────────────────────────
// 更新紀錄是「一整份 Markdown」，儲存＝整份覆寫。編輯前先讀原始全文，
// 存檔前用與後端相同的規則掃出版本標題，避免格式寫壞導致版本全部消失。

const RN_VERSION_RE = /^# XRESTA (v[\d.]+)/gm;
const RN_DATE_RE = /發布日期[：:]\s*(.+?)(?:\*|$)/;

function detectVersions(text: string): { version: string; date: string }[] {
  const matches = [...text.matchAll(RN_VERSION_RE)];
  return matches.map((m, i) => {
    const start = m.index ?? 0;
    const end = i + 1 < matches.length ? matches[i + 1].index ?? text.length : text.length;
    const d = text.slice(start, end).match(RN_DATE_RE);
    return { version: m[1], date: d ? d[1].trim() : '' };
  });
}

export function ReleaseNoteEditor({
  onClose,
  onSaved,
  mobile = false,
}: {
  onClose: () => void;
  onSaved: () => void;
  mobile?: boolean;
}) {
  const [content, setContent] = useState<string | null>(null);
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchReleaseNoteRaw(ctrl.signal)
      .then((r) => setContent(r.content))
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === 'AbortError') return;
        setLoadErr(e instanceof ApiError ? e.message : (e as Error).message);
      });
    return () => ctrl.abort();
  }, []);

  const detected = useMemo(() => detectVersions(content ?? ''), [content]);

  const pickFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setContent(String(reader.result ?? ''));
      setTab('write');
    };
    reader.readAsText(file, 'utf-8');
  };

  const save = async () => {
    if (content === null) return;
    if (
      detected.length === 0 &&
      !window.confirm(
        '目前內容找不到任何「# XRESTA vX.Y.Z」版本標題，儲存後更新紀錄頁將看不到任何版本。仍要儲存？'
      )
    )
      return;
    setSaving(true);
    setSaveErr(null);
    try {
      await saveReleaseNote(content);
      onSaved();
    } catch (e) {
      setSaveErr(e instanceof ApiError ? e.message : (e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3"
      style={{ background: 'rgba(15,23,42,0.45)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[14px] w-full max-w-[880px] max-h-[92vh] flex flex-col overflow-hidden"
        style={{ boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-3.5 flex-shrink-0"
          style={{ borderBottom: `1px solid ${T.border}` }}
        >
          <div>
            <div className="text-[15px] font-bold text-text">編輯更新紀錄</div>
            <div className="text-[11px] text-text-muted mt-0.5">
              整份 Markdown，儲存後將覆寫現有內容
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted text-lg cursor-pointer bg-transparent border-0 leading-none"
            aria-label="關閉"
          >
            ✕
          </button>
        </div>

        <div
          className="flex items-center gap-1 px-3 flex-shrink-0 bg-bg"
          style={{ borderBottom: `1px solid ${T.border}` }}
        >
          {(['write', 'preview'] as const).map((id) => {
            const isActive = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className="px-3.5 py-2 border-0 bg-transparent text-xs font-semibold cursor-pointer"
                style={{
                  color: isActive ? T.accent : T.textMuted,
                  borderBottom: isActive ? `2px solid ${T.accent}` : '2px solid transparent',
                }}
              >
                {id === 'write' ? '編輯' : `版本檢查（${detected.length}）`}
              </button>
            );
          })}
          <label
            className="ml-auto my-1.5 px-3 py-1 text-[11px] font-semibold text-text-sec rounded-[6px] bg-white cursor-pointer whitespace-nowrap"
            style={{ border: `1px solid ${T.border}` }}
          >
            ⬆️ 匯入 .md 檔
            <input
              type="file"
              accept=".md,.markdown,text/markdown,text/plain"
              className="hidden"
              onChange={(e) => {
                pickFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadErr && <ErrorState message={loadErr} />}
          {!loadErr && content === null && <LoadingState label="讀取原始內容中…" />}
          {!loadErr &&
            content !== null &&
            (tab === 'write' ? (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                spellCheck={false}
                className="block w-full px-4 py-3.5 border-0 outline-none resize-none font-mono text-[12px] text-text bg-white leading-[1.7]"
                style={{ minHeight: mobile ? '48vh' : '56vh' }}
                placeholder={'# XRESTA v1.0.0.0 發布通知\n\n*發布日期：2026 年 01 月 01 日*\n\n## 版本摘要\n\n### 新功能\n- …'}
              />
            ) : (
              <div className="px-4 py-4">
                {detected.length === 0 ? (
                  <div
                    className="rounded-[8px] px-3.5 py-3 text-xs"
                    style={{ background: T.redBg, border: `1px solid ${T.redBorder}`, color: T.red }}
                  >
                    找不到任何版本標題。每個版本需以 <code>{'# XRESTA v1.2.3.4'}</code> 開頭，
                    否則更新紀錄頁會是空的。
                  </div>
                ) : (
                  <>
                    <div className="text-[11px] text-text-muted mb-2">
                      系統將解析出以下 {detected.length} 個版本（順序即頁面顯示順序）：
                    </div>
                    {detected.map((v, i) => (
                      <div
                        key={`${v.version}-${i}`}
                        className="flex items-center gap-3 px-3 py-2 mb-1.5 rounded-[8px] bg-white"
                        style={{ border: `1px solid ${T.border}` }}
                      >
                        <span className="font-mono text-[13px] font-semibold text-text">
                          {v.version}
                        </span>
                        <span className="text-[11px] text-text-muted">
                          {v.date || '⚠️ 未偵測到發布日期'}
                        </span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            ))}
        </div>

        <div
          className="flex items-center justify-end gap-2 px-5 py-3 flex-shrink-0"
          style={{ borderTop: `1px solid ${T.border}` }}
        >
          {saveErr && <span className="mr-auto text-xs text-red font-semibold">{saveErr}</span>}
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] font-semibold text-text-sec rounded-[8px] cursor-pointer bg-white"
            style={{ border: `1px solid ${T.border}` }}
          >
            取消
          </button>
          <button
            onClick={save}
            disabled={saving || content === null}
            className="px-4 py-2 text-[13px] font-bold text-white bg-primary rounded-[8px] cursor-pointer border-0 disabled:opacity-60"
          >
            {saving ? '儲存中…' : '儲存'}
          </button>
        </div>
      </div>
    </div>
  );
}
