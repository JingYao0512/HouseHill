// Domain shapes live in ./api.ts (Flask-backed). This file owns the small
// frontend-only types (routes/page ids) and re-exports a few token aliases
// for convenience.

export type { Severity, IssueStatus, RequestStatus, ReleaseType } from './tokens';

export type PageId = 'config' | 'issues' | 'troubleshooting' | 'release-notes';
export type AppRoute = 'login' | PageId | 'issue-create' | 'admin';
