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
} as const;

export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type IssueStatus = 'open' | 'in-progress' | 'resolved';
export type RequestStatus = 'pending' | 'approved' | 'rejected';
export type ReleaseType = 'patch' | 'minor' | 'major';

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
