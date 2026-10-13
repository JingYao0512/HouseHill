import { useRef, useState } from 'react';
import { T } from '../tokens';
import { Badge } from './Badge';
import { LoadingState, ErrorState } from './States';
import { useApi } from '../hooks/useApi';
import {
  fetchConfigInfo,
  previewConfigUpload,
  replaceConfig,
  type ConfigInfo,
  type ConfigPreview,
  type ConfigSource,
  type SheetCount,
} from '../api';
import {
  Card,
  CollapsibleList,
  Notice,
  PanelHeader,
  PrimaryButton,
  SecondaryButton,
  StatTile,
  XlsxDropZone,
  errMsg,
  formatBytes,
  formatTime,
} from './AdminUploadParts';

const SOURCE: Record<ConfigSource, { label: string; hint: string; color: string; bg: string; border: string }> = {
  cloud: {
    label: '後台上傳版本',
    hint: '存放在雲端。重新部署不會覆蓋它；要換內容請在這裡再上傳一次。',
    color: T.accentStrong,
    bg: T.accentBg,
    border: T.accentBorder,
  },
  bundled: {
    label: '部署內建版本',
    hint: '隨程式部署的 XRESTAConfig.xlsx，尚未在後台上傳過。',
    color: T.textSec,
    bg: T.bg,
    border: T.border,
  },
  local: {
    label: '本機檔案',
    hint: '本機開發模式：上傳會直接覆寫這個檔案，並保留一份 .bak 備份。',
    color: T.purple,
    bg: T.purpleBg,
    border: T.purpleBorder,
  },
};

function SheetChips({ sheets }: { sheets: SheetCount[] }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2.5">
      {sheets.map((s) => (
        <span
          key={s.name}
          className="text-[11px] px-2 py-[2px] rounded-[6px]"
          style={{ background: T.bg, border: `1px solid ${T.border}`, color: T.textSec }}
        >
          {s.name} · {s.items}
        </span>
      ))}
    </div>
  );
}

function CurrentConfigCard({ info }: { info: ConfigInfo }) {
  const s = SOURCE[info.source];
  const rows: [string, string][] = [
    ['檔案', info.filename],
    ['更新時間', formatTime(info.updated_at) || '—'],
    ['更新者', info.updated_by || '—'],
    ['內容', `${info.sheets.length} 個分頁、${info.total_items} 個參數`],
  ];
  return (
    <Card className="mb-4">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2.5">
        <div className="text-[13px] font-bold text-text">目前使用中的設定</div>
        <Badge color={s.color} bg={s.bg} border={s.border}>
          {s.label}
        </Badge>
      </div>
      {rows.map(([k, v]) => (
        <div key={k} className="flex gap-3 text-[13px] mb-1">
          <span className="flex-shrink-0 w-[60px]" style={{ color: T.textMuted }}>
            {k}
          </span>
          <span className="text-text break-all">{v}</span>
        </div>
      ))}
      <div className="text-[11px] mt-2 leading-[1.6]" style={{ color: T.textMuted }}>
        {s.hint}
      </div>
      <SheetChips sheets={info.sheets} />
    </Card>
  );
}

function PreviewCard({
  preview,
  saving,
  onConfirm,
  onCancel,
}: {
  preview: ConfigPreview;
  saving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const d = preview.diff;
  const unchanged =
    d.added + d.removed + d.changed + d.sheets_added.length + d.sheets_removed.length === 0;
  return (
    <Card className="mt-4">
      <div className="text-[13px] font-bold text-text">取代前確認</div>
      <div className="text-[12px] mt-0.5 break-all" style={{ color: T.textMuted }}>
        {preview.filename} · {formatBytes(preview.size)} · {preview.sheets.length} 個分頁、
        {preview.total_items} 個參數
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3">
        <StatTile label="新增參數" value={d.added} color={T.green} />
        <StatTile label="移除參數" value={d.removed} color={T.red} />
        <StatTile label="內容變更" value={d.changed} color={T.accent} />
      </div>

      {unchanged && <Notice tone="info">內容與目前使用中的設定完全相同。</Notice>}
      {d.sheets_added.length > 0 && (
        <Notice tone="info">新增分頁：{d.sheets_added.join('、')}</Notice>
      )}
      {(d.removed > 0 || d.sheets_removed.length > 0) && (
        <Notice tone="warn">
          {d.sheets_removed.length > 0 && <>分頁「{d.sheets_removed.join('、')}」會整個消失。</>}
          {d.removed > 0 && <>共 {d.removed} 個參數會從設定頁移除。</>}
          請確認上傳的是正確且完整的檔案。
        </Notice>
      )}

      <CollapsibleList title="新增的參數" total={d.added} items={d.added_keys} mono />
      <CollapsibleList title="移除的參數" total={d.removed} items={d.removed_keys} mono />
      <CollapsibleList title="內容變更的參數" total={d.changed} items={d.changed_keys} mono />

      <div className="text-[12px] font-semibold text-text-sec mt-3">新檔案的分頁</div>
      <SheetChips sheets={preview.sheets} />

      <div className="flex gap-2 mt-4 flex-wrap">
        <PrimaryButton onClick={onConfirm} disabled={saving}>
          {saving ? '更新中…' : '確認取代目前設定'}
        </PrimaryButton>
        <SecondaryButton onClick={onCancel} disabled={saving}>
          取消
        </SecondaryButton>
      </div>
    </Card>
  );
}

/** 後台：上傳 XRESTAConfig.xlsx。先預覽差異（不寫入），確認後才取代。 */
export default function ConfigUploadPanel() {
  const info = useApi<ConfigInfo>((signal) => fetchConfigInfo(signal), []);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ConfigPreview | null>(null);
  const [busy, setBusy] = useState<'preview' | 'save' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<ConfigInfo | null>(null);
  // 連續換檔時只採用最後一次請求的結果
  const seq = useRef(0);

  const pick = async (f: File) => {
    const id = ++seq.current;
    setFile(f);
    setPreview(null);
    setError(null);
    setSaved(null);
    setBusy('preview');
    try {
      const p = await previewConfigUpload(f);
      if (id === seq.current) setPreview(p);
    } catch (e) {
      if (id === seq.current) {
        setError(errMsg(e));
        setFile(null);
      }
    } finally {
      if (id === seq.current) setBusy(null);
    }
  };

  const cancel = () => {
    seq.current++;
    setFile(null);
    setPreview(null);
    setError(null);
    setBusy(null);
  };

  const confirm = async () => {
    if (!file) return;
    const id = ++seq.current;
    setBusy('save');
    setError(null);
    try {
      const res = await replaceConfig(file);
      if (id !== seq.current) return;
      setSaved(res);
      setFile(null);
      setPreview(null);
      info.reload();
    } catch (e) {
      if (id === seq.current) setError(errMsg(e));
    } finally {
      if (id === seq.current) setBusy(null);
    }
  };

  return (
    <div className="max-w-[860px]">
      <PanelHeader
        title="設定檔上傳"
        subtitle="上傳新的 XRESTAConfig.xlsx。系統會先列出與目前設定的差異，按下確認後才會取代。"
      />

      {info.loading && !info.data && <LoadingState label="讀取目前設定…" />}
      {info.error && <ErrorState message={info.error} onRetry={info.reload} />}
      {info.data && <CurrentConfigCard info={info.data} />}

      {saved && (
        <Notice tone="success">
          設定已更新為「{saved.filename}」：{saved.sheets.length} 個分頁、{saved.total_items} 個參數。
          {saved.storage === 'gcs'
            ? '其他使用者重新整理設定頁即可看到，雲端多台主機最多約 1 分鐘內同步。'
            : '重新整理設定頁即可看到。'}
        </Notice>
      )}

      <div className="mt-4">
        <XlsxDropZone
          file={file}
          disabled={busy === 'save'}
          onPick={pick}
          hint="每個分頁：A 欄 Key、B 說明、C 屬性、D 選項、E 預設值、F 可介面設定；[區段] 列為分組標題"
        />
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {busy === 'preview' && <LoadingState label="解析檔案、比對差異中…" />}
      {preview && file && (
        <PreviewCard
          preview={preview}
          saving={busy === 'save'}
          onConfirm={confirm}
          onCancel={cancel}
        />
      )}
    </div>
  );
}
