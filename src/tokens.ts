// Design tokens — single source of truth shared with Tailwind config.
// Use these constants where Tailwind classes can't easily express the value
// (gradients, dynamic per-severity colors, inline svg fills, etc.).

export const T = {
  bg: '#f8fafc',
  surface: '#ffffff',
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
  text: '#0f172a',
  textSec: '#475569',
  textMuted: '#94a3b8',
  primary: '#0f172a',
  accent: '#3b82f6',
  accentBg: '#eff6ff',
  accentBorder: '#bfdbfe',
  accentStrong: '#1e40af',
  green: '#16a34a',
  greenBg: '#f0fdf4',
  greenBorder: '#bbf7d0',
  red: '#ef4444',
  redBg: '#fef2f2',
  redBorder: '#fecaca',
  amber: '#d97706',
  amberBg: '#fffbeb',
  amberBorder: '#fde68a',
  purple: '#7c3aed',
  purpleBg: '#f5f3ff',
  purpleBorder: '#ddd6fe',
  // 陰影與圓角（對齊 design handoff 的 T）
  shadow: '0 1px 3px rgba(0,0,0,0.08)',
  shadowMd: '0 4px 12px rgba(0,0,0,0.08)',
  shadowBtn: '0 4px 14px rgba(15,23,42,0.35)',
  radius: 12,
  radiusSm: 8,
} as const;

export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type IssueStatus = 'open' | 'in-progress' | 'resolved';
export type RequestStatus = 'pending' | 'approved' | 'rejected';
export type ReleaseType = 'patch' | 'minor' | 'major';

// 帳號權限角色分級
export type Role = 'user' | 'manager' | 'admin';

// 需求管理 (Requirements) —— 與帳號申請的 RequestStatus 語意不同，另立一組。
// 進度 5 種；內部代碼沿用舊值（舊的 evaluating 已由遷移腳本轉為 pending）。
export type ReqStatus = 'pending' | 'in-progress' | 'done' | 'on-hold' | 'rejected';
// 軟體（單選；匯入時由 Excel 分頁名稱決定，舊資料可能為空字串＝未指定）
export type Software = 'human' | 'vet' | 'hcr' | 'viewer';
export type Priority = 'high' | 'medium' | 'low';

export interface ColorTriad {
  color: string;
  bg: string;
  border: string;
  label: string;
}

export const sevStyle: Record<Severity, ColorTriad & { desc: string }> = {
  critical: { color: T.red, bg: T.redBg, border: T.redBorder, label: '緊急', desc: '系統無法運作，影響所有使用者' },
  high: { color: T.amber, bg: T.amberBg, border: T.amberBorder, label: '高', desc: '核心功能異常，部分使用者受影響' },
  medium: { color: T.accent, bg: T.accentBg, border: T.accentBorder, label: '中', desc: '功能受損但有替代方案' },
  low: { color: T.green, bg: T.greenBg, border: T.greenBorder, label: '低', desc: '輕微問題，不影響主要功能' },
};

export const statStyle: Record<IssueStatus, ColorTriad> = {
  open: { color: T.amber, bg: T.amberBg, border: T.amberBorder, label: '待處理' },
  'in-progress': { color: T.purple, bg: T.purpleBg, border: T.purpleBorder, label: '處理中' },
  resolved: { color: T.green, bg: T.greenBg, border: T.greenBorder, label: '已解決' },
};

export const reqStatusStyle: Record<RequestStatus, ColorTriad> = {
  pending: { color: T.amber, bg: T.amberBg, border: T.amberBorder, label: '待審核' },
  approved: { color: T.green, bg: T.greenBg, border: T.greenBorder, label: '已核准' },
  rejected: { color: T.red, bg: T.redBg, border: T.redBorder, label: '已拒絕' },
};

export const rnTypeStyle: Record<ReleaseType, ColorTriad> = {
  patch: { color: T.green, bg: T.greenBg, border: T.greenBorder, label: 'patch' },
  minor: { color: T.accent, bg: T.accentBg, border: T.accentBorder, label: 'minor' },
  major: { color: T.amber, bg: T.amberBg, border: T.amberBorder, label: 'major' },
};

// 需求進度（5 種）
export const reqmtStatusStyle: Record<ReqStatus, ColorTriad> = {
  pending: { color: T.amber, bg: T.amberBg, border: T.amberBorder, label: '未評估' },
  'in-progress': { color: T.purple, bg: T.purpleBg, border: T.purpleBorder, label: '進行中' },
  done: { color: T.green, bg: T.greenBg, border: T.greenBorder, label: '已完成' },
  'on-hold': { color: T.textSec, bg: T.bg, border: T.border, label: '停止' },
  rejected: { color: T.red, bg: T.redBg, border: T.redBorder, label: '無法執行' },
};

// 資料庫裡若殘留未知進度（例如尚未遷移的 evaluating），以灰色原值顯示而不是讓畫面壞掉。
export const reqmtStatusOf = (s: string): ColorTriad =>
  reqmtStatusStyle[s as ReqStatus] ?? {
    color: T.textSec,
    bg: T.bg,
    border: T.border,
    label: s === 'evaluating' ? '評估中（舊）' : s || '—',
  };

// 軟體
export const softwareStyle: Record<Software, ColorTriad> = {
  human: { color: T.accentStrong, bg: T.accentBg, border: T.accentBorder, label: 'Human' },
  vet: { color: T.green, bg: T.greenBg, border: T.greenBorder, label: 'Vet' },
  hcr: { color: T.purple, bg: T.purpleBg, border: T.purpleBorder, label: 'HCR' },
  viewer: { color: T.amber, bg: T.amberBg, border: T.amberBorder, label: 'Viewer' },
};

export const softwareOf = (s: string): ColorTriad | null =>
  softwareStyle[s as Software] ?? null;

// 優先順序（高中低，交通號誌配色）
export const priStyle: Record<Priority, ColorTriad> = {
  high: { color: T.red, bg: T.redBg, border: T.redBorder, label: '高' },
  medium: { color: T.amber, bg: T.amberBg, border: T.amberBorder, label: '中' },
  low: { color: T.green, bg: T.greenBg, border: T.greenBorder, label: '低' },
};

// 帳號角色（三層）
export const roleStyle: Record<Role, ColorTriad> = {
  admin: { color: T.red, bg: T.redBg, border: T.redBorder, label: '最高管理者' },
  manager: { color: T.accentStrong, bg: T.accentBg, border: T.accentBorder, label: '一般管理者' },
  user: { color: T.textSec, bg: T.bg, border: T.border, label: '使用者' },
};
