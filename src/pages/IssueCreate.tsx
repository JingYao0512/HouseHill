import { useMemo, useState } from 'react';
import { TopBar } from '../components/TopBar';
import { NavHeader } from '../components/NavHeader';
import { MobileNav } from '../components/MobileNav';
import {
  ChevronRight,
  PencilIcon,
  FileTextIcon,
  TriangleIcon,
  PaperclipIcon,
  UploadIcon,
  SearchIcon,
} from '../components/icons';
import { T, sevStyle, type Severity } from '../tokens';
import { ApiError, createIssue, fetchConfig, type WorkbookData } from '../api';
import { useApi } from '../hooks/useApi';
import type { PageId } from '../types';
import { useIsMobile } from '../hooks/useMediaQuery';

interface Props {
  onNav: (id: PageId) => void;
  onDone: (issueId?: string) => void;
  onCancel: () => void;
  onLogout?: () => void;
  isAdmin?: boolean;
  onAdminClick?: () => void;
}

function SeverityOption({
  value,
  selected,
  onClick,
}: {
  value: Severity;
  selected: Severity;
  onClick: (v: Severity) => void;
}) {
  const s = sevStyle[value];
  const isSelected = selected === value;
  return (
    <button
      onClick={() => onClick(value)}
      className="flex-1 cursor-pointer transition-all duration-150 text-center relative"
      style={{
        padding: '12px 10px',
        border: `1.5px solid ${isSelected ? s.color : T.border}`,
        borderRadius: 10,
        background: isSelected ? s.bg : T.surface,
      }}
    >
      {isSelected && (
        <div
          className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full flex items-center justify-center"
          style={{ background: s.color }}
        >
          <span className="text-white text-[9px] font-black">✓</span>
        </div>
      )}
      <div
        className="inline-block text-[11px] font-bold px-2.5 py-[3px] rounded-[20px] mb-1.5"
        style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}
      >
        {s.label}
      </div>
      <div className="text-[11px] text-text-muted leading-snug">{s.desc}</div>
    </button>
  );
}

function MdEditor({
  value,
  onChange,
  minHeight = 160,
}: {
  value: string;
  onChange: (v: string) => void;
  minHeight?: number;
}) {
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  return (
    <div
      className="overflow-hidden bg-white"
      style={{ border: `1.5px solid ${T.border}`, borderRadius: 10 }}
    >
      <div className="flex bg-bg" style={{ borderBottom: `1px solid ${T.border}` }}>
        {(['write', 'preview'] as const).map((id) => {
          const isActive = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="px-4 py-2 border-0 bg-transparent text-xs font-semibold cursor-pointer transition-all duration-150"
              style={{
                color: isActive ? T.accent : T.textMuted,
                borderBottom: isActive ? `2px solid ${T.accent}` : '2px solid transparent',
              }}
            >
              {id === 'write' ? '編輯' : '預覽'}
            </button>
          );
        })}
        <div className="ml-auto px-3 py-2 text-[11px] text-text-muted flex items-center gap-2">
          {['**B**', '_I_', '`code`', '```block```'].map((hint) => (
            <span
              key={hint}
              className="font-mono text-[10px] text-text-muted bg-bg px-1.5 py-px rounded-[3px] cursor-pointer"
              style={{ border: `1px solid ${T.border}` }}
            >
              {hint}
            </span>
          ))}
        </div>
      </div>
      {tab === 'write' ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="block w-full px-4 py-3.5 border-0 outline-none resize-y font-mono text-[13px] text-text bg-white leading-[1.7]"
          style={{ minHeight }}
          placeholder={`請描述異常情況...\n\n## 問題描述\n\n## 重現步驟\n1. \n2. \n\n## 預期行為\n\n## 實際行為`}
        />
      ) : (
        <div className="px-4 py-3.5 text-[13px] text-text leading-[1.8]" style={{ minHeight }}>
          {value ? (
            <pre className="font-sans whitespace-pre-wrap m-0 leading-[1.8]">{value}</pre>
          ) : (
            <span className="text-text-muted italic">（尚無內容）</span>
          )}
        </div>
      )}
    </div>
  );
}

function ParamSelector({
  selected,
  onChange,
  config,
}: {
  selected: string;
  onChange: (v: string) => void;
  config: WorkbookData | null;
}) {
  const [search, setSearch] = useState('');
  const allKeys = useMemo(() => {
    if (!config) return [];
    const keys = new Set<string>();
    Object.values(config).forEach((items) => items.forEach((p) => p.key && keys.add(p.key)));
    return Array.from(keys).sort();
  }, [config]);
  const filtered = allKeys.filter((k) => k.includes(search));
  return (
    <div className="overflow-hidden" style={{ border: `1.5px solid ${T.border}`, borderRadius: 10 }}>
      <div
        className="px-3 py-2 bg-bg flex items-center gap-2"
        style={{ borderBottom: `1px solid ${T.border}` }}
      >
        <SearchIcon width={13} height={13} className="text-text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-transparent border-0 outline-none text-xs font-mono text-text flex-1"
          placeholder="搜尋參數..."
        />
      </div>
      <div className="max-h-[120px] overflow-y-auto px-2.5 py-2 flex flex-wrap gap-1.5">
        {allKeys.length === 0 ? (
          <div className="text-[11px] text-text-muted px-1 py-2">
            （尚未載入設定資料，您仍可手動輸入參數名稱）
          </div>
        ) : (
          filtered.map((k) => {
            const isOn = selected === k;
            return (
              <button
                key={k}
                onClick={() => onChange(isOn ? '' : k)}
                className="font-mono text-[11px] font-medium cursor-pointer transition-all duration-150"
                style={{
                  color: isOn ? T.accentStrong : T.textSec,
                  background: isOn ? T.accentBg : T.bg,
                  border: `1px solid ${isOn ? T.accentBorder : T.border}`,
                  padding: '3px 9px',
                  borderRadius: 5,
                }}
              >
                {isOn ? '✓ ' : ''}
                {k}
              </button>
            );
          })
        )}
      </div>
      <div
        className="px-3 py-2 bg-bg"
        style={{ borderTop: `1px solid ${T.border}` }}
      >
        <input
          value={selected}
          onChange={(e) => onChange(e.target.value)}
          className="bg-white w-full px-2 py-1 rounded text-xs font-mono outline-none"
          style={{ border: `1px solid ${T.border}` }}
          placeholder="或手動輸入參數名稱"
        />
      </div>
    </div>
  );
}

function CardHeader({
  icon,
  title,
  required,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div
      className="bg-bg px-5 py-3 text-[13px] font-bold text-text-sec flex items-center gap-2"
      style={{ borderBottom: `1px solid ${T.border}` }}
    >
      {icon}
      {title}
      {required && <span className="text-[11px] font-bold text-red">*</span>}
      {hint && <span className="ml-auto text-[11px] text-text-muted font-normal">{hint}</span>}
    </div>
  );
}

function useIssueForm(onDone: (id?: string) => void) {
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<Severity>('medium');
  const [description, setDescription] = useState('');
  const [relatedConfigKey, setRelatedConfigKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim() || !description.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const issue = await createIssue({
        title: title.trim(),
        description: description.trim(),
        severity,
        related_config_key: relatedConfigKey.trim(),
      });
      setSubmittedId(issue.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setTitle('');
    setSeverity('medium');
    setDescription('');
    setRelatedConfigKey('');
    setSubmittedId(null);
    setError(null);
  };

  return {
    title,
    setTitle,
    severity,
    setSeverity,
    description,
    setDescription,
    relatedConfigKey,
    setRelatedConfigKey,
    submitting,
    submittedId,
    error,
    submit,
    reset,
    finish: () => onDone(submittedId ?? undefined),
  };
}

function IssueCreateDesktop({ onNav, onDone, onCancel, onLogout, isAdmin, onAdminClick }: Props) {
  const f = useIssueForm(onDone);
  const config = useApi<WorkbookData>((signal) => fetchConfig(signal), []);

  if (f.submittedId) {
    return (
      <div className="w-full h-full flex flex-col bg-bg">
        <TopBar />
        <NavHeader
          active="issues"
          onNav={onNav}
          onLogout={onLogout}
          isAdmin={isAdmin}
          onAdminClick={onAdminClick}
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-[400px]">
            <div
              className="w-[72px] h-[72px] rounded-full bg-green-bg mx-auto mb-5 flex items-center justify-center text-[32px]"
              style={{
                border: `2px solid ${T.greenBorder}`,
                boxShadow: '0 8px 24px rgba(22,163,74,0.2)',
              }}
            >
              ✓
            </div>
            <div className="text-[22px] font-extrabold text-text mb-2">回報已送出</div>
            <div className="text-sm text-text-muted leading-[1.7] mb-2">
              異常回報{' '}
              <span className="font-mono font-semibold" style={{ color: T.accentStrong }}>
                #{f.submittedId.slice(0, 8)}
              </span>{' '}
              已建立
            </div>
            <div className="text-[13px] text-text-muted mb-7">系統將通知相關負責人員跟進處理</div>
            <div className="flex gap-2.5 justify-center">
              <button
                onClick={f.reset}
                className="px-6 py-2.5 bg-white text-text-sec rounded-[10px] text-[13px] font-semibold cursor-pointer"
                style={{ border: `1px solid ${T.border}` }}
              >
                再新增一筆
              </button>
              <button
                onClick={f.finish}
                className="px-6 py-2.5 bg-primary text-white border-0 rounded-[10px] text-[13px] font-semibold cursor-pointer"
              >
                查看回報列表
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const submitEnabled = !!(f.title.trim() && f.description.trim()) && !f.submitting;

  return (
    <div className="w-full h-full flex flex-col bg-bg">
      <TopBar />
      <NavHeader
        active="issues"
        onNav={onNav}
        onLogout={onLogout}
        isAdmin={isAdmin}
        onAdminClick={onAdminClick}
      />
      <main className="flex-1 overflow-y-auto py-5">
        <div className="max-w-[760px] mx-auto px-8">
          <div className="flex items-center gap-2 mb-5 text-[13px] text-text-muted">
            <span className="text-accent cursor-pointer font-medium" onClick={onCancel}>
              異常回報
            </span>
            <ChevronRight width={12} height={12} />
            <span className="font-bold text-text text-base">新增回報</span>
          </div>

          <div
            className="bg-white overflow-hidden mb-4"
            style={{
              border: `1px solid ${T.border}`,
              borderRadius: 12,
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}
          >
            <CardHeader icon={<PencilIcon width={14} height={14} />} title="基本資訊" />
            <div className="px-6 py-5">
              <div className="mb-5">
                <label className="flex items-center gap-1.5 text-[13px] font-semibold text-text-sec mb-2">
                  標題 <span className="text-[11px] font-bold text-red">*</span>
                </label>
                <input
                  value={f.title}
                  onChange={(e) => f.setTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-[10px] text-sm outline-none text-text"
                  style={{
                    border: `1.5px solid ${f.title ? T.border : '#fca5a5'}`,
                    background: '#fafafa',
                  }}
                  placeholder="請簡短描述異常情況，例如：DICOM 影像載入失敗"
                />
                <div className="text-[11px] text-text-muted mt-1.5">
                  清楚的標題有助於快速識別問題 ({f.title.length}/200)
                </div>
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-[13px] font-semibold text-text-sec mb-2">
                  嚴重程度 <span className="text-[11px] font-bold text-red">*</span>
                </label>
                <div className="flex gap-2.5">
                  {(['critical', 'high', 'medium', 'low'] as Severity[]).map((v) => (
                    <SeverityOption key={v} value={v} selected={f.severity} onClick={f.setSeverity} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div
            className="bg-white overflow-hidden mb-4"
            style={{
              border: `1px solid ${T.border}`,
              borderRadius: 12,
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}
          >
            <CardHeader
              icon={<FileTextIcon width={14} height={14} />}
              title="問題描述"
              required
              hint="支援 Markdown 格式"
            />
            <div className="px-5 py-4">
              <MdEditor value={f.description} onChange={f.setDescription} minHeight={180} />
            </div>
          </div>

          <div
            className="bg-white overflow-hidden mb-4"
            style={{
              border: `1px solid ${T.border}`,
              borderRadius: 12,
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}
          >
            <CardHeader
              icon={<TriangleIcon width={14} height={14} />}
              title="相關設定參數"
              hint="選填 — 點選與此異常相關的參數"
            />
            <div className="px-5 py-4">
              <ParamSelector
                selected={f.relatedConfigKey}
                onChange={f.setRelatedConfigKey}
                config={config.data}
              />
              {f.relatedConfigKey && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <span className="text-[11px] text-text-muted self-center">已選：</span>
                  <span
                    className="font-mono text-[11px] flex items-center gap-1"
                    style={{
                      color: T.accentStrong,
                      background: T.accentBg,
                      border: `1px solid ${T.accentBorder}`,
                      padding: '3px 8px',
                      borderRadius: 5,
                    }}
                  >
                    {f.relatedConfigKey}
                    <span
                      onClick={() => f.setRelatedConfigKey('')}
                      className="cursor-pointer text-text-muted text-[13px] leading-none"
                    >
                      ×
                    </span>
                  </span>
                </div>
              )}
            </div>
          </div>

          <div
            className="bg-white overflow-hidden mb-6"
            style={{
              border: `1px solid ${T.border}`,
              borderRadius: 12,
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}
          >
            <CardHeader
              icon={<PaperclipIcon width={14} height={14} />}
              title="附件"
              hint="此版本暫不支援附件上傳"
            />
            <div className="px-5 py-4">
              <div
                className="text-center transition-all duration-150 opacity-60"
                style={{
                  border: `1.5px dashed ${T.border}`,
                  borderRadius: 10,
                  padding: '28px 20px',
                  background: '#fafafa',
                }}
              >
                <UploadIcon width={28} height={28} className="mx-auto mb-2.5 block text-text-muted" />
                <div className="text-[13px] font-semibold text-text-sec mb-1">
                  附件上傳即將推出
                </div>
                <div className="text-[11px] text-text-muted">
                  目前可在送出後從故障排除文章補上相關檔案
                </div>
              </div>
            </div>
          </div>

          {f.error && (
            <div
              className="rounded-[10px] px-4 py-3 mb-4 text-[13px]"
              style={{ background: T.redBg, border: `1px solid ${T.redBorder}`, color: T.red }}
            >
              送出失敗：{f.error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pb-8">
            <button
              onClick={onCancel}
              className="px-6 py-2.5 bg-white text-text-sec rounded-[10px] text-[13px] font-semibold cursor-pointer"
              style={{ border: `1px solid ${T.border}` }}
            >
              取消
            </button>
            <button
              onClick={f.submit}
              disabled={!submitEnabled}
              className="px-8 py-3 text-white border-0 rounded-[10px] text-sm font-bold transition-all duration-200"
              style={{
                background: submitEnabled ? T.primary : '#94a3b8',
                cursor: submitEnabled ? 'pointer' : 'not-allowed',
                boxShadow: submitEnabled ? '0 4px 14px rgba(15,23,42,0.3)' : 'none',
              }}
            >
              {f.submitting ? '送出中…' : '送出回報'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function IssueCreateMobile({ onNav, onDone, onLogout, isAdmin, onAdminClick }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const f = useIssueForm(onDone);
  const config = useApi<WorkbookData>((signal) => fetchConfig(signal), []);
  const totalSteps = 3;

  const sevLabels: Record<Severity, string> = {
    critical: '緊急',
    high: '高',
    medium: '中',
    low: '低',
  };
  const sevColors: Record<Severity, string> = {
    critical: T.red,
    high: T.amber,
    medium: T.accent,
    low: T.green,
  };

  if (f.submittedId) {
    return (
      <div className="w-full h-full flex flex-col bg-bg font-sans">
        <TopBar />
        <NavHeader
          active="issues"
          onNav={onNav}
          onLogout={onLogout}
          isAdmin={isAdmin}
          onAdminClick={onAdminClick}
          mobile
        />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <div
              className="w-16 h-16 rounded-full bg-green-bg mx-auto mb-4 flex items-center justify-center text-[28px]"
              style={{ border: `2px solid ${T.greenBorder}` }}
            >
              ✓
            </div>
            <div className="text-lg font-extrabold text-text mb-2">回報已送出</div>
            <div className="text-[13px] text-text-muted leading-[1.7] mb-5">
              異常回報{' '}
              <span className="font-mono" style={{ color: T.accentStrong }}>
                {f.submittedId.slice(0, 8)}
              </span>{' '}
              已建立。
            </div>
            <button
              onClick={f.finish}
              className="w-full py-3 bg-primary text-white border-0 rounded-[10px] text-sm font-bold cursor-pointer"
            >
              返回列表
            </button>
          </div>
        </div>
        <MobileNav active="issues" onNav={onNav} />
      </div>
    );
  }

  const canSubmit = !!(f.title.trim() && f.description.trim()) && !f.submitting;
  const proceed = () => {
    if (step < totalSteps) setStep((s) => (s + 1) as 1 | 2 | 3);
    else if (canSubmit) f.submit();
  };

  return (
    <div className="w-full h-full flex flex-col bg-bg font-sans">
      <TopBar />
      <NavHeader
        active="issues"
        onNav={onNav}
        onLogout={onLogout}
        isAdmin={isAdmin}
        onAdminClick={onAdminClick}
        mobile
      />

      <div
        className="bg-white px-4 py-3 flex-shrink-0"
        style={{ borderBottom: `1px solid ${T.border}` }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] font-bold text-text">新增異常回報</span>
          <span className="text-[11px] text-text-muted">
            {step}/{totalSteps}
          </span>
        </div>
        <div className="bg-bg rounded h-1 overflow-hidden">
          <div
            className="h-full bg-primary rounded transition-[width] duration-300 ease"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          {['基本資訊', '問題描述', '相關參數'].map((s, i) => (
            <span
              key={s}
              className="text-[10px]"
              style={{
                color: i + 1 <= step ? T.primary : T.textMuted,
                fontWeight: i + 1 <= step ? 600 : 400,
              }}
            >
              {s}
            </span>
          ))}
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-4 pb-0">
        {step === 1 && (
          <>
            <div className="mb-4">
              <label className="block text-[13px] font-semibold text-text-sec mb-1.5">
                標題 <span className="text-red text-[11px]">*</span>
              </label>
              <input
                value={f.title}
                onChange={(e) => f.setTitle(e.target.value)}
                className="w-full px-3.5 py-3 rounded-[10px] text-[15px] outline-none text-text"
                style={{ border: `1.5px solid ${T.border}`, background: '#fafafa' }}
                placeholder="請簡短描述異常情況"
              />
              <div className="text-[11px] text-text-muted mt-1">{f.title.length}/200 字元</div>
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-text-sec mb-2.5">
                嚴重程度 <span className="text-red text-[11px]">*</span>
              </label>
              <div className="flex flex-col gap-2">
                {(['critical', 'high', 'medium', 'low'] as Severity[]).map((v) => {
                  const opt = sevStyle[v];
                  const isOn = f.severity === v;
                  return (
                    <button
                      key={v}
                      onClick={() => f.setSeverity(v)}
                      className="flex items-center gap-3 cursor-pointer text-left transition-all duration-150"
                      style={{
                        padding: '12px 14px',
                        border: `1.5px solid ${isOn ? opt.color : T.border}`,
                        borderRadius: 10,
                        background: isOn ? opt.bg : T.surface,
                      }}
                    >
                      <div
                        className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center"
                        style={{
                          border: `2px solid ${opt.color}`,
                          background: isOn ? opt.color : 'transparent',
                        }}
                      >
                        {isOn && <span className="text-white text-[10px] font-black">✓</span>}
                      </div>
                      <div>
                        <div className="text-[13px] font-semibold mb-0.5" style={{ color: opt.color }}>
                          {opt.label}
                        </div>
                        <div className="text-[11px] text-text-muted">{opt.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <div>
            <label className="block text-[13px] font-semibold text-text-sec mb-2">
              問題描述 <span className="text-red text-[11px]">*</span>
            </label>
            <textarea
              value={f.description}
              onChange={(e) => f.setDescription(e.target.value)}
              className="w-full px-3.5 py-3 rounded-[10px] text-sm font-mono outline-none text-text resize-none leading-[1.7]"
              style={{ border: `1.5px solid ${T.border}`, background: '#fafafa', minHeight: 200 }}
              placeholder={`請描述異常情況...\n\n重現步驟：\n1. \n2. \n\n預期行為：\n\n實際行為：`}
            />
            <div
              className="mt-2 px-3 py-2.5 bg-bg rounded-lg"
              style={{ border: `1px solid ${T.border}` }}
            >
              <div className="text-[11px] font-semibold text-text-muted mb-1">💡 填寫技巧</div>
              <div className="text-[11px] text-text-muted leading-[1.6]">
                請描述問題的重現步驟、預期行為和實際行為，這有助於快速定位問題。
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <label className="block text-[13px] font-semibold text-text-sec mb-2">
              相關設定參數{' '}
              <span className="text-[11px] font-normal text-text-muted">(選填)</span>
            </label>
            <ParamSelector
              selected={f.relatedConfigKey}
              onChange={f.setRelatedConfigKey}
              config={config.data}
            />
            {f.relatedConfigKey && (
              <div className="mt-3">
                <div className="text-[11px] font-semibold text-text-muted mb-1.5">已選擇：</div>
                <span
                  className="font-mono text-[11px] inline-flex items-center gap-1"
                  style={{
                    color: T.accentStrong,
                    background: T.accentBg,
                    border: `1px solid ${T.accentBorder}`,
                    padding: '3px 8px',
                    borderRadius: 5,
                  }}
                >
                  {f.relatedConfigKey}
                  <span
                    onClick={() => f.setRelatedConfigKey('')}
                    className="cursor-pointer text-text-muted text-[13px] leading-none"
                  >
                    ×
                  </span>
                </span>
              </div>
            )}
            <div
              className="mt-5 bg-bg p-3.5 rounded-[10px]"
              style={{ border: `1px solid ${T.border}` }}
            >
              <div className="text-xs font-bold text-text-sec mb-2.5">📋 送出前確認</div>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2.5 text-xs">
                  <span className="text-text-muted w-[60px] flex-shrink-0">標題</span>
                  <span className="text-text font-medium flex-1">
                    {f.title || '（未填寫）'}
                  </span>
                </div>
                <div className="flex gap-2.5 text-xs">
                  <span className="text-text-muted w-[60px] flex-shrink-0">嚴重度</span>
                  <span className="font-bold" style={{ color: sevColors[f.severity] }}>
                    {sevLabels[f.severity]}
                  </span>
                </div>
                <div className="flex gap-2.5 text-xs">
                  <span className="text-text-muted w-[60px] flex-shrink-0">描述</span>
                  <span style={{ color: f.description ? T.text : T.textMuted }}>
                    {f.description ? `${f.description.slice(0, 40)}…` : '（未填寫）'}
                  </span>
                </div>
                {f.relatedConfigKey && (
                  <div className="flex gap-2.5 text-xs">
                    <span className="text-text-muted w-[60px] flex-shrink-0">參數</span>
                    <span className="font-mono text-text">{f.relatedConfigKey}</span>
                  </div>
                )}
              </div>
            </div>
            {f.error && (
              <div
                className="mt-3 rounded-[8px] px-3 py-2 text-xs"
                style={{ background: T.redBg, border: `1px solid ${T.redBorder}`, color: T.red }}
              >
                送出失敗：{f.error}
              </div>
            )}
          </div>
        )}
      </main>

      <div
        className="bg-white px-4 py-3 flex gap-2.5 flex-shrink-0"
        style={{ borderTop: `1px solid ${T.border}` }}
      >
        {step > 1 && (
          <button
            onClick={() => setStep((s) => Math.max(1, s - 1) as 1 | 2 | 3)}
            className="px-5 py-3 bg-white text-text-sec rounded-[10px] text-sm font-semibold cursor-pointer"
            style={{ border: `1px solid ${T.border}` }}
          >
            ← 上一步
          </button>
        )}
        <button
          onClick={proceed}
          className="flex-1 py-3 text-white border-0 rounded-[10px] text-sm font-bold transition-all duration-200"
          style={{
            background: step < totalSteps || canSubmit ? T.primary : '#94a3b8',
            cursor: step < totalSteps || canSubmit ? 'pointer' : 'not-allowed',
          }}
        >
          {step < totalSteps ? '下一步 →' : f.submitting ? '送出中…' : '送出回報'}
        </button>
      </div>
    </div>
  );
}

export default function IssueCreate(props: Props) {
  const isMobile = useIsMobile();
  return isMobile ? <IssueCreateMobile {...props} /> : <IssueCreateDesktop {...props} />;
}
