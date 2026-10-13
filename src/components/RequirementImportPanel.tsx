import { useRef, useState } from 'react';
import { T, priStyle, reqmtStatusOf, softwareOf } from '../tokens';
import { Badge } from './Badge';
import { LoadingState } from './States';
import {
  previewRequirementImport,
  commitRequirementImport,
  type ImportRow,
  type RequirementImportReport,
  type RequirementImportResult,
} from '../api';
import {
  Card,
  Notice,
  PanelHeader,
  PrimaryButton,
  SecondaryButton,
  StatTile,
  XlsxDropZone,
  errMsg,
} from './AdminUploadParts';

const NEW_ROWS_PREVIEW = 20;

const statusLabel = (s: string) => reqmtStatusOf(s).label;

function SectionTitle({ children, hint }: { children: string; hint?: string }) {
  return (
    <div className="mt-5 mb-2">
      <div className="text-[13px] font-bold text-text">{children}</div>
      {hint && (
        <div className="text-[11px] mt-0.5 leading-[1.6]" style={{ color: T.textMuted }}>
          {hint}
        </div>
      )}
    </div>
  );
}

function RowMeta({ row }: { row: ImportRow }) {
  const sw = softwareOf(row.software);
  const p = priStyle[row.priority];
  const s = reqmtStatusOf(row.status);
  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
      {sw && (
        <Badge size="sm" color={sw.color} bg={sw.bg} border={sw.border}>
          {sw.label}
        </Badge>
      )}
      <Badge size="sm" color={p.color} bg={p.bg} border={p.border}>
        優先 {p.label}
      </Badge>
      <Badge size="sm" color={s.color} bg={s.bg} border={s.border}>
        {s.label}
      </Badge>
      {(row.submitted_date || row.target_version || row.dev_id) && (
        <span className="text-[11px]" style={{ color: T.textMuted }}>
          {[row.submitted_date, row.target_version && `版本 ${row.target_version}`, row.dev_id]
            .filter(Boolean)
            .join(' · ')}
        </span>
      )}
    </div>
  );
}

/** 「人醫 第 12 列」—— 多分頁時必須帶分頁名稱才能定位 */
function RefTag({ sheet, row }: { sheet: string; row: number }) {
  return (
    <span className="text-[11px] font-bold font-mono flex-shrink-0" style={{ color: T.textMuted }}>
      {sheet} 第 {row} 列
    </span>
  );
}

function Report({
  report,
  include,
  onToggle,
}: {
  report: RequirementImportReport;
  include: Set<string>;
  onToggle: (ref: string) => void;
}) {
  const [showAllNew, setShowAllNew] = useState(false);
  const changedDups = report.duplicates.filter((d) => d.diffs.length > 0);
  const newRows = showAllNew ? report.new : report.new.slice(0, NEW_ROWS_PREVIEW);

  return (
    <>
      <div className="text-[12px] break-all" style={{ color: T.textMuted }}>
        {report.source_file} · Excel 有效列 {report.rows_total} 筆 · 資料庫現有 {report.existing_total} 筆
      </div>
      {report.sheets.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mt-2 text-[12px]" style={{ color: T.textSec }}>
          <span>分頁對應軟體：</span>
          {report.sheets.map((sh) => {
            const sw = softwareOf(sh.software);
            return (
              <span key={sh.sheet} className="inline-flex items-center gap-1">
                「{sh.sheet}」→
                {sw && (
                  <Badge size="sm" color={sw.color} bg={sw.bg} border={sw.border}>
                    {sw.label}
                  </Badge>
                )}
                <span style={{ color: T.textMuted }}>{sh.rows} 列</span>
              </span>
            );
          })}
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
        <StatTile label="將新增" value={report.new.length} color={T.green} />
        <StatTile label="已存在（略過）" value={report.duplicates.length} color={T.textSec} />
        <StatTile label="疑似重複" value={report.similar.length} color={T.amber} />
        <StatTile
          label="提示（未猜測）"
          value={report.warnings.length + report.notes.length}
          color={T.amber}
        />
      </div>

      {report.similar.length > 0 && (
        <>
          <SectionTitle hint="內容與既有需求的相似度達 85% 以上，預設不匯入。確定是不同的需求才勾選。">
            疑似重複
          </SectionTitle>
          {report.similar.map(({ row, existing, score }) => {
            const checked = include.has(row.ref);
            return (
              <label
                key={row.ref}
                className="block rounded-[8px] px-3 py-2.5 mb-2 cursor-pointer"
                style={{
                  background: checked ? T.accentBg : T.surface,
                  border: `1px solid ${checked ? T.accentBorder : T.border}`,
                }}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(row.ref)}
                    className="w-4 h-4 cursor-pointer accent-[#3b82f6]"
                  />
                  <span className="text-[12px] font-semibold text-text">一併匯入</span>
                  <span className="ml-auto flex items-center gap-2">
                    <RefTag sheet={row.sheet} row={row.excel_row} />
                    <Badge size="sm" color={T.amber} bg={T.amberBg} border={T.amberBorder}>
                      {/* 無條件捨去：只差一個字的內容不應顯示成 100% */}
                      相似度 {Math.floor(score * 100)}%
                    </Badge>
                  </span>
                </div>
                <div className="grid md:grid-cols-2 gap-2 mt-2">
                  {(
                    [
                      ['Excel 內容', row.content],
                      [`既有需求（${statusLabel(existing.status)}）`, existing.content],
                    ] as [string, string][]
                  ).map(([k, v]) => (
                    <div
                      key={k}
                      className="rounded-[6px] px-2.5 py-2 text-[12px] leading-[1.6]"
                      style={{ background: T.bg, border: `1px solid ${T.borderLight}` }}
                    >
                      <div className="text-[10px] font-bold mb-0.5" style={{ color: T.textMuted }}>
                        {k}
                      </div>
                      <div className="text-text whitespace-pre-wrap break-words">{v}</div>
                    </div>
                  ))}
                </div>
              </label>
            );
          })}
        </>
      )}

      {report.new.length > 0 && (
        <>
          <SectionTitle>將新增的需求</SectionTitle>
          {newRows.map((row) => (
            <div
              key={row.ref}
              className="rounded-[8px] px-3 py-2.5 mb-2"
              style={{ border: `1px solid ${T.border}` }}
            >
              <div className="flex gap-2 items-start">
                <RefTag sheet={row.sheet} row={row.excel_row} />
                <div className="text-[13px] text-text leading-[1.6] line-clamp-2 break-words min-w-0">
                  {row.content || '（無內容）'}
                </div>
              </div>
              <RowMeta row={row} />
            </div>
          ))}
          {report.new.length > NEW_ROWS_PREVIEW && (
            <button
              onClick={() => setShowAllNew((v) => !v)}
              className="text-[12px] font-semibold bg-transparent border-0 cursor-pointer p-0"
              style={{ color: T.accent }}
            >
              {showAllNew ? '收合' : `顯示全部 ${report.new.length} 筆`}
            </button>
          )}
        </>
      )}

      {report.notes.length > 0 && (
        <>
          <SectionTitle hint="分頁名稱必須是已知的軟體（人醫、獸醫、Human、Vet、HCR、Viewer），否則整頁不匯入。">
            略過的分頁
          </SectionTitle>
          <ul
            className="rounded-[8px] px-3 py-2 text-[12px] leading-[1.8]"
            style={{ background: T.amberBg, border: `1px solid ${T.amberBorder}`, color: T.textSec }}
          >
            {report.notes.map((n) => (
              <li key={n.sheet}>
                「{n.sheet}」：{n.message}
              </li>
            ))}
          </ul>
        </>
      )}

      {report.warnings.length > 0 && (
        <>
          <SectionTitle hint="系統不做猜測：無法對應的進度一律為「未評估」、無法解析的日期留白、檔案內重複的列以第一次出現的為準。匯入後可在需求管理頁修正。">
            列提示
          </SectionTitle>
          <ul
            className="rounded-[8px] px-3 py-2 text-[12px] leading-[1.8] max-h-[260px] overflow-y-auto"
            style={{ background: T.amberBg, border: `1px solid ${T.amberBorder}`, color: T.textSec }}
          >
            {report.warnings.map((w, i) => (
              <li key={`${w.ref}-${w.field}-${i}`}>
                <span className="font-mono font-bold" style={{ color: T.textMuted }}>
                  {w.sheet} 第 {w.excel_row} 列
                </span>
                ：{w.message}
              </li>
            ))}
          </ul>
        </>
      )}

      {changedDups.length > 0 && (
        <details className="mt-5">
          <summary className="cursor-pointer text-[13px] font-bold text-text select-none">
            已存在、但 Excel 有不同資訊（{changedDups.length}）
          </summary>
          <div className="text-[11px] mt-1 mb-2 leading-[1.6]" style={{ color: T.textMuted }}>
            App 是主檔，匯入不會修改既有需求。若 Excel 的資訊較新，請到需求管理頁手動調整。
          </div>
          <ul
            className="rounded-[8px] px-3 py-2 text-[12px] leading-[1.7] max-h-[260px] overflow-y-auto"
            style={{ background: T.bg, border: `1px solid ${T.border}`, color: T.textSec }}
          >
            {changedDups.map((d) => (
              <li key={d.row.ref} className="mb-1.5">
                <span className="font-mono font-bold" style={{ color: T.textMuted }}>
                  {d.row.sheet} 第 {d.row.excel_row} 列
                </span>{' '}
                <span className="text-text">{d.row.content.slice(0, 40)}</span>
                <div>差異：{d.diffs.join('；')}</div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

/** 後台：上傳需求 Excel。先預覽比對結果（不寫入），確認後只新增資料。 */
export default function RequirementImportPanel({
  onOpenRequirements,
}: {
  onOpenRequirements: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<RequirementImportReport | null>(null);
  const [include, setInclude] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<'preview' | 'save' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RequirementImportResult | null>(null);
  const seq = useRef(0);

  const pick = async (f: File) => {
    const id = ++seq.current;
    setFile(f);
    setReport(null);
    setInclude(new Set());
    setError(null);
    setResult(null);
    setBusy('preview');
    try {
      const r = await previewRequirementImport(f);
      if (id === seq.current) setReport(r);
    } catch (e) {
      if (id === seq.current) {
        setError(errMsg(e));
        setFile(null);
      }
    } finally {
      if (id === seq.current) setBusy(null);
    }
  };

  const toggle = (ref: string) =>
    setInclude((prev) => {
      const next = new Set(prev);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
      return next;
    });

  const cancel = () => {
    seq.current++;
    setFile(null);
    setReport(null);
    setInclude(new Set());
    setError(null);
    setBusy(null);
  };

  const confirm = async () => {
    if (!file) return;
    const id = ++seq.current;
    setBusy('save');
    setError(null);
    try {
      const res = await commitRequirementImport(file, [...include].sort());
      if (id !== seq.current) return;
      setResult(res);
      setFile(null);
      setReport(null);
      setInclude(new Set());
    } catch (e) {
      if (id === seq.current) setError(errMsg(e));
    } finally {
      if (id === seq.current) setBusy(null);
    }
  };

  const toCreate = report ? report.new.length + include.size : 0;

  return (
    <div className="max-w-[860px]">
      <PanelHeader
        title="需求匯入"
        subtitle="上傳客戶需求 Excel 來新增需求。App 是主檔：匯入只會新增資料，不會修改或刪除既有需求；進度、負責人、預計完成日請在需求管理頁維護。"
      />

      {result && (
        <Notice tone="success">
          已從「{result.source_file}」新增 {result.created} 筆需求。
          {result.skipped_duplicate > 0 && <>已存在的 {result.skipped_duplicate} 筆未匯入。</>}
          {result.skipped_similar > 0 && <>未勾選的疑似重複 {result.skipped_similar} 筆未匯入。</>}{' '}
          <button
            onClick={onOpenRequirements}
            className="font-bold underline bg-transparent border-0 cursor-pointer p-0"
            style={{ color: 'inherit' }}
          >
            前往需求管理
          </button>
        </Notice>
      )}

      <div className="mt-4">
        <XlsxDropZone
          file={file}
          disabled={busy === 'save'}
          onPick={pick}
          hint="讀取所有分頁，分頁名稱決定軟體（人醫/Human、獸醫/Vet、HCR、Viewer）。必須有「內容」或「需求標題」欄；提出日期、優先程度、版本、進度、開發編號依表頭名稱對應，其他欄位忽略。"
        />
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {busy === 'preview' && <LoadingState label="讀取檔案、比對既有需求中…" />}

      {report && file && (
        <Card className="mt-4">
          <div className="text-[13px] font-bold text-text mb-0.5">匯入前確認</div>
          <Report report={report} include={include} onToggle={toggle} />
          {toCreate === 0 && (
            <Notice tone="info">
              沒有需要新增的資料。{report.similar.length > 0 && '如要匯入疑似重複的列，請勾選後再確認。'}
            </Notice>
          )}
          <div className="flex gap-2 mt-4 flex-wrap">
            <PrimaryButton onClick={confirm} disabled={busy === 'save' || toCreate === 0}>
              {busy === 'save' ? '匯入中…' : `確認匯入 ${toCreate} 筆`}
            </PrimaryButton>
            <SecondaryButton onClick={cancel} disabled={busy === 'save'}>
              取消
            </SecondaryButton>
          </div>
        </Card>
      )}
    </div>
  );
}
