import { useState } from 'react';
import { TopBar } from '../components/TopBar';
import { LoadingState, EmptyState, ErrorState } from '../components/States';
import { T, roleStyle, type Role } from '../tokens';
import {
  auth,
  fetchUsers,
  createUser,
  deleteUser,
  resetUserPassword,
  setUserRole,
  fetchAccountRequests,
  approveAccountRequest,
  rejectAccountRequest,
  ApiError,
  type UserInfo,
  type AccountRequest,
} from '../api';
import { useApi } from '../hooks/useApi';
import { useIsMobile } from '../hooks/useMediaQuery';
import ConfigUploadPanel from '../components/ConfigUploadPanel';
import RequirementImportPanel from '../components/RequirementImportPanel';

const ROLE_OPTIONS: Role[] = ['user', 'manager', 'admin'];

interface Props {
  onLogout: () => void;
  onBack: () => void;
  /** 需求匯入完成後跳到需求管理頁 */
  onOpenRequirements: () => void;
}

type SubPage = 'users' | 'requests' | 'config' | 'req-import';

const SUB_PAGES: { id: SubPage; label: string; short: string }[] = [
  { id: 'users', label: '使用者管理', short: '使用者' },
  { id: 'requests', label: '帳號申請審核', short: '申請審核' },
  { id: 'config', label: '設定檔上傳', short: '設定檔' },
  { id: 'req-import', label: '需求匯入', short: '需求匯入' },
];

function CreateUserForm({ onCreated }: { onCreated: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('user');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await createUser(username.trim(), password, role);
      setUsername('');
      setPassword('');
      setRole('user');
      onCreated();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="bg-white rounded-[8px] p-4 mb-5"
      style={{ border: `1px solid ${T.border}` }}
    >
      <div className="text-[13px] font-bold text-text mb-3">新增使用者</div>
      <div className="grid grid-cols-3 gap-3 mb-2.5">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="px-3 py-2 rounded-[8px] text-[13px] outline-none font-mono"
          style={{ border: `1px solid ${T.border}`, background: '#fafafa' }}
          placeholder="使用者名稱（3–32 字元）"
        />
        <input
          value={password}
          type="password"
          onChange={(e) => setPassword(e.target.value)}
          className="px-3 py-2 rounded-[8px] text-[13px] outline-none"
          style={{ border: `1px solid ${T.border}`, background: '#fafafa' }}
          placeholder="密碼（至少 8 字元）"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="px-3 py-2 rounded-[8px] text-[13px] outline-none bg-white"
          style={{ border: `1px solid ${T.border}` }}
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {roleStyle[r].label}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <div
          className="rounded-[6px] px-2.5 py-1.5 mb-2 text-xs"
          style={{ background: T.redBg, border: `1px solid ${T.redBorder}`, color: T.red }}
        >
          {error}
        </div>
      )}
      <button
        onClick={submit}
        disabled={busy || !username || !password}
        className="px-4 py-2 bg-primary text-white border-0 rounded-[8px] text-xs font-bold"
        style={{
          cursor: busy || !username || !password ? 'not-allowed' : 'pointer',
          opacity: busy || !username || !password ? 0.6 : 1,
        }}
      >
        {busy ? '新增中…' : '+ 新增'}
      </button>
    </div>
  );
}

function RoleBadge({ role }: { role: Role }) {
  const s = roleStyle[role];
  return (
    <span
      className="text-[11px] font-bold px-2 py-[2px] rounded-[20px] whitespace-nowrap"
      style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}
    >
      {s.label}
    </span>
  );
}

function UsersTable({ desktop }: { desktop: boolean }) {
  const { data, loading, error, reload } = useApi<UserInfo[]>(
    (signal) => fetchUsers(signal),
    []
  );
  const me = auth.getUsername();

  const handleDelete = async (username: string) => {
    if (!confirm(`確認刪除使用者「${username}」？`)) return;
    try {
      await deleteUser(username);
      reload();
    } catch (e) {
      alert(`刪除失敗：${e instanceof ApiError ? e.message : (e as Error).message}`);
    }
  };

  const handleReset = async (username: string) => {
    const newPw = prompt(`重設使用者「${username}」的密碼（至少 8 字元）：`);
    if (!newPw) return;
    if (newPw.length < 8) {
      alert('密碼必須至少 8 字元');
      return;
    }
    try {
      await resetUserPassword(username, newPw);
      alert(`已重設「${username}」的密碼`);
    } catch (e) {
      alert(`重設失敗：${e instanceof ApiError ? e.message : (e as Error).message}`);
    }
  };

  const handleRole = async (username: string, role: Role) => {
    try {
      await setUserRole(username, role);
      reload();
    } catch (e) {
      alert(`變更角色失敗：${e instanceof ApiError ? e.message : (e as Error).message}`);
    }
  };

  const users = data ?? [];

  return (
    <>
      <CreateUserForm onCreated={reload} />
      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && users.length === 0 && (
        <EmptyState title="尚無使用者" />
      )}
      {!loading && !error && users.length > 0 && desktop && (
        <div
          className="bg-white rounded-xl overflow-hidden"
          style={{ border: `1px solid ${T.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
        >
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-bg" style={{ borderBottom: `1px solid ${T.border}` }}>
                {['使用者', '角色', '操作'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-[11px] font-bold text-text-muted text-left uppercase tracking-[0.5px] whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isAdminUser = u.role === 'admin';
                const isMe = u.username === me;
                return (
                  <tr key={u.username} style={{ borderBottom: `1px solid ${T.borderLight}` }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-[30px] h-[30px] rounded-full text-[11px] font-bold flex items-center justify-center flex-shrink-0"
                          style={{
                            background: isAdminUser
                              ? 'linear-gradient(135deg,#1e3a5f,#3b82f6)'
                              : T.bg,
                            border: `1px solid ${T.border}`,
                            color: isAdminUser ? 'white' : T.textSec,
                          }}
                        >
                          {u.username[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div>
                          <div className="text-[13px] font-semibold text-text font-mono">
                            {u.username}
                            {isMe && (
                              <span className="ml-1.5 text-[10px] font-normal text-text-muted">
                                （您）
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {isMe ? (
                        <RoleBadge role={u.role} />
                      ) : (
                        <select
                          value={u.role}
                          onChange={(e) => handleRole(u.username, e.target.value as Role)}
                          className="px-2.5 py-1 rounded-[6px] text-[12px] font-semibold outline-none bg-white cursor-pointer"
                          style={{ border: `1px solid ${T.border}`, color: roleStyle[u.role].color }}
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r} value={r}>
                              {roleStyle[r].label}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleReset(u.username)}
                          className="px-2.5 py-1 bg-white rounded-[6px] text-[11px] font-semibold text-text-sec cursor-pointer"
                          style={{ border: `1px solid ${T.border}` }}
                        >
                          重設密碼
                        </button>
                        {!isMe && (
                          <button
                            onClick={() => handleDelete(u.username)}
                            className="px-2.5 py-1 bg-white rounded-[6px] text-[11px] font-semibold text-red cursor-pointer"
                            style={{ border: `1px solid ${T.redBorder}` }}
                          >
                            刪除
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {!loading && !error && users.length > 0 && !desktop && (
        <>
          {users.map((u) => {
            const isAdminUser = u.role === 'admin';
            const isMe = u.username === me;
            return (
              <div
                key={u.username}
                className="bg-white px-3.5 py-3 mb-2.5"
                style={{
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                }}
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold flex-shrink-0"
                    style={{
                      background: isAdminUser
                        ? 'linear-gradient(135deg,#1e3a5f,#3b82f6)'
                        : T.bg,
                      border: `1px solid ${T.border}`,
                      color: isAdminUser ? 'white' : T.textSec,
                    }}
                  >
                    {u.username[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-text font-mono">
                      {u.username}
                      {isMe && (
                        <span className="ml-1.5 text-[10px] font-normal text-text-muted">
                          （您）
                        </span>
                      )}
                    </div>
                  </div>
                  <RoleBadge role={u.role} />
                </div>
                {!isMe && (
                  <div className="mb-2">
                    <select
                      value={u.role}
                      onChange={(e) => handleRole(u.username, e.target.value as Role)}
                      className="w-full px-2.5 py-1.5 rounded-[6px] text-[12px] font-semibold outline-none bg-white"
                      style={{ border: `1px solid ${T.border}`, color: roleStyle[u.role].color }}
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          角色：{roleStyle[r].label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleReset(u.username)}
                    className="flex-1 py-1.5 bg-white rounded-[6px] text-[11px] font-semibold text-text-sec cursor-pointer"
                    style={{ border: `1px solid ${T.border}` }}
                  >
                    重設密碼
                  </button>
                  {!isMe && (
                    <button
                      onClick={() => handleDelete(u.username)}
                      className="flex-1 py-1.5 bg-white rounded-[6px] text-[11px] font-semibold text-red cursor-pointer"
                      style={{ border: `1px solid ${T.redBorder}` }}
                    >
                      刪除
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </>
      )}
    </>
  );
}

const REQ_STATUS_STYLE: Record<AccountRequest['status'], { color: string; bg: string; border: string; label: string }> = {
  pending: { color: T.amber, bg: T.amberBg, border: T.amberBorder, label: '待審核' },
  approved: { color: T.green, bg: T.greenBg, border: T.greenBorder, label: '已核准' },
  rejected: { color: T.red, bg: T.redBg, border: T.redBorder, label: '已拒絕' },
};

/** 帳號申請審核：核准時需指定初始密碼與角色，並一併建立帳號。 */
function RequestsPanel({ desktop }: { desktop: boolean }) {
  const { data, loading, error, reload } = useApi<AccountRequest[]>(
    (signal) => fetchAccountRequests('', signal),
    []
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const requests = data ?? [];
  const selected = requests.find((r) => r.id === selectedId) ?? null;

  const approve = async (req: AccountRequest) => {
    const pw = prompt(`為「${req.username}」設定初始密碼（至少 8 字元）：`);
    if (!pw) return;
    if (pw.length < 8) {
      alert('密碼必須至少 8 字元');
      return;
    }
    const asManager = window.confirm('要給予「一般管理者」權限嗎？\n確定＝一般管理者，取消＝一般使用者');
    setBusy(true);
    try {
      await approveAccountRequest(req.id, pw, asManager ? 'manager' : 'user');
      alert(`已核准並建立帳號「${req.username}」`);
      setSelectedId(null);
      reload();
    } catch (e) {
      alert(`核准失敗：${e instanceof ApiError ? e.message : (e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const reject = async (req: AccountRequest) => {
    if (!window.confirm(`確定拒絕「${req.username}」的申請？`)) return;
    setBusy(true);
    try {
      await rejectAccountRequest(req.id);
      setSelectedId(null);
      reload();
    } catch (e) {
      alert(`拒絕失敗：${e instanceof ApiError ? e.message : (e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (requests.length === 0) {
    return (
      <EmptyState
        title="目前沒有帳號申請"
        hint="使用者可在登入頁的「申請帳號」送出申請，送出後會出現在這裡。"
      />
    );
  }

  const row = (r: AccountRequest) => {
    const st = REQ_STATUS_STYLE[r.status];
    const active = selectedId === r.id;
    return (
      <button
        key={r.id}
        onClick={() => setSelectedId(active ? null : r.id)}
        className="w-full text-left cursor-pointer"
        style={{
          background: active ? T.accentBg : T.surface,
          border: `1px solid ${active ? T.accentBorder : T.border}`,
          borderRadius: 8,
          padding: '10px 12px',
          marginBottom: 8,
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-semibold text-text font-mono">{r.username}</span>
          <span
            className="text-[10px] font-bold"
            style={{
              color: st.color,
              background: st.bg,
              border: `1px solid ${st.border}`,
              padding: '1px 8px',
              borderRadius: 20,
            }}
          >
            {st.label}
          </span>
        </div>
        <div className="text-[11px] mt-1" style={{ color: T.textMuted }}>
          {[r.name, r.dept, r.title].filter(Boolean).join(' · ') || '—'}
        </div>
      </button>
    );
  };

  const detail = (r: AccountRequest) => (
    <div
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: T.radius,
        padding: 16,
        boxShadow: T.shadow,
      }}
    >
      <div className="text-[15px] font-bold text-text mb-3">{r.name || r.username}</div>
      {(
        [
          ['使用者名稱', r.username],
          ['電子信箱', r.email],
          ['所屬單位', r.dept],
          ['職稱', r.title],
          ['申請時間', r.created_at ? r.created_at.slice(0, 10) : ''],
          ['審核者', r.reviewed_by],
        ] as [string, string][]
      ).map(([k, v]) => (
        <div key={k} className="flex gap-3 text-[13px] mb-1.5">
          <span style={{ color: T.textMuted, width: 72, flexShrink: 0 }}>{k}</span>
          <span className="text-text break-all">{v || '—'}</span>
        </div>
      ))}
      {r.reason && (
        <div
          className="text-[13px] mt-3 whitespace-pre-wrap"
          style={{
            background: T.bg,
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            padding: 12,
            color: T.textSec,
          }}
        >
          {r.reason}
        </div>
      )}
      {r.status === 'pending' && (
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => approve(r)}
            disabled={busy}
            className="px-4 py-2 text-[13px] font-bold text-white border-0 rounded-[8px] cursor-pointer disabled:opacity-60"
            style={{ background: T.green }}
          >
            核准
          </button>
          <button
            onClick={() => reject(r)}
            disabled={busy}
            className="px-4 py-2 text-[13px] font-bold rounded-[8px] cursor-pointer bg-white disabled:opacity-60"
            style={{ color: T.red, border: `1px solid ${T.redBorder}` }}
          >
            拒絕
          </button>
        </div>
      )}
    </div>
  );

  if (!desktop) {
    return (
      <>
        {requests.map(row)}
        {selected && <div className="mt-3">{detail(selected)}</div>}
      </>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px minmax(0,1fr)', gap: 16 }}>
      <div>{requests.map(row)}</div>
      <div>
        {selected ? (
          detail(selected)
        ) : (
          <EmptyState title="選擇一筆申請" hint="點左側清單查看申請內容並進行審核。" />
        )}
      </div>
    </div>
  );
}

function AdminDesktop({ onLogout, onBack, onOpenRequirements }: Props) {
  const [subPage, setSubPage] = useState<SubPage>('users');

  return (
    <div className="w-full h-full flex flex-col bg-bg font-sans">
      <TopBar />
      <header className="bg-primary text-white px-6 h-[52px] flex items-center flex-shrink-0">
        <div
          className="flex items-center gap-2.5 pr-5 mr-5"
          style={{ borderRight: '1px solid rgba(255,255,255,0.12)' }}
        >
          <div
            className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-base"
            style={{ background: 'rgba(255,255,255,0.12)' }}
          >
            🏔️
          </div>
          <span className="font-extrabold text-base tracking-[-0.3px]">HouseHill</span>
        </div>
        <span
          className="hidden xl:inline text-xs font-semibold mr-5 whitespace-nowrap"
          style={{ color: 'rgba(255,255,255,0.5)' }}
        >
          管理員後台
        </span>
        <nav className="flex min-w-0 overflow-x-auto" aria-label="後台功能">
          {SUB_PAGES.map((p) => {
            const isActive = subPage === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setSubPage(p.id)}
                aria-current={isActive ? 'page' : undefined}
                className="flex items-center gap-1.5 px-3.5 h-[52px] border-0 bg-transparent text-[13px] font-semibold cursor-pointer transition-all duration-150 whitespace-nowrap flex-shrink-0"
                style={{
                  color: isActive ? 'white' : 'rgba(255,255,255,0.5)',
                  borderBottom: isActive ? '2px solid #3b82f6' : '2px solid transparent',
                }}
              >
                {p.label}
              </button>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2 flex-shrink-0 pl-3">
          <div
            className="w-7 h-7 rounded-full text-[11px] font-bold flex items-center justify-center"
            style={{
              background: 'rgba(59,130,246,0.3)',
              border: '1px solid rgba(59,130,246,0.4)',
              color: '#93c5fd',
            }}
          >
            {(auth.getUsername()?.[0] ?? 'A').toUpperCase()}
          </div>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
            {auth.getUsername() ?? 'admin'}
          </span>
          <button
            onClick={onBack}
            className="ml-2 px-2.5 py-1 text-[11px] font-semibold cursor-pointer rounded-[6px]"
            style={{
              color: 'rgba(255,255,255,0.85)',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            ← 返回首頁
          </button>
          <button
            onClick={onLogout}
            className="text-xs font-semibold cursor-pointer bg-transparent border-0"
            style={{ color: 'rgba(255,255,255,0.6)' }}
          >
            登出
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto px-8 py-6">
        {subPage === 'users' && (
          <>
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="text-lg font-bold text-text">使用者管理</div>
                <div className="text-[13px] text-text-muted mt-0.5">
                  管理 HouseHill 後端帳號
                </div>
              </div>
            </div>
            <UsersTable desktop />
          </>
        )}
        {subPage === 'requests' && <RequestsPanel desktop />}
        {subPage === 'config' && <ConfigUploadPanel />}
        {subPage === 'req-import' && (
          <RequirementImportPanel onOpenRequirements={onOpenRequirements} />
        )}
      </main>
    </div>
  );
}

function AdminMobile({ onLogout, onBack, onOpenRequirements }: Props) {
  const [subPage, setSubPage] = useState<SubPage>('users');

  return (
    <div className="w-full h-full flex flex-col bg-bg font-sans">
      <TopBar />
      <header className="bg-primary text-white px-4 h-[50px] flex items-center gap-2.5 flex-shrink-0">
        <button
          onClick={onBack}
          className="text-white/85 text-[16px] cursor-pointer bg-transparent border-0 leading-none"
          aria-label="返回首頁"
        >
          ←
        </button>
        <div
          className="w-7 h-7 rounded-[7px] flex items-center justify-center text-[14px]"
          style={{ background: 'rgba(255,255,255,0.12)' }}
        >
          🏔️
        </div>
        <span className="font-extrabold text-[15px] flex-1">管理員後台</span>
        <div
          className="w-7 h-7 rounded-full text-[11px] font-bold flex items-center justify-center"
          style={{ background: 'rgba(59,130,246,0.3)', color: '#93c5fd' }}
        >
          {(auth.getUsername()?.[0] ?? 'A').toUpperCase()}
        </div>
        <button
          onClick={onLogout}
          className="text-[11px] font-semibold cursor-pointer bg-transparent border-0"
          style={{ color: 'rgba(255,255,255,0.6)' }}
        >
          登出
        </button>
      </header>
      <div
        className="bg-white flex flex-shrink-0"
        style={{ borderBottom: `1px solid ${T.border}` }}
      >
        {SUB_PAGES.map((p) => {
          const isActive = subPage === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setSubPage(p.id)}
              aria-current={isActive ? 'page' : undefined}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 border-0 bg-transparent text-[13px] font-semibold cursor-pointer transition-all duration-150 whitespace-nowrap"
              style={{
                color: isActive ? T.text : T.textMuted,
                borderBottom: isActive ? `2px solid ${T.primary}` : '2px solid transparent',
              }}
            >
              {p.short}
            </button>
          );
        })}
      </div>
      <main className="flex-1 overflow-y-auto px-3.5 pt-3 pb-6">
        {subPage === 'users' && (
          <>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[15px] font-bold text-text">使用者管理</span>
            </div>
            <UsersTable desktop={false} />
          </>
        )}
        {subPage === 'requests' && <RequestsPanel desktop={false} />}
        {subPage === 'config' && <ConfigUploadPanel />}
        {subPage === 'req-import' && (
          <RequirementImportPanel onOpenRequirements={onOpenRequirements} />
        )}
      </main>
    </div>
  );
}

export default function Admin(props: Props) {
  const isMobile = useIsMobile();
  return isMobile ? <AdminMobile {...props} /> : <AdminDesktop {...props} />;
}
