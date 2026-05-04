import { useState } from 'react';
import { TopBar } from '../components/TopBar';
import { LoadingState, EmptyState, ErrorState } from '../components/States';
import { T } from '../tokens';
import { auth, fetchUsers, createUser, deleteUser, resetUserPassword, ApiError } from '../api';
import { useApi } from '../hooks/useApi';
import { useIsMobile } from '../hooks/useMediaQuery';

interface Props {
  onLogout: () => void;
  onBack: () => void;
}

type SubPage = 'requests' | 'users';

function CreateUserForm({ onCreated }: { onCreated: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await createUser(username.trim(), password);
      setUsername('');
      setPassword('');
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
      <div className="grid grid-cols-2 gap-3 mb-2.5">
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

function UsersTable({ desktop }: { desktop: boolean }) {
  const { data, loading, error, reload } = useApi<string[]>(
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
                const isAdmin = u === 'admin';
                const isMe = u === me;
                return (
                  <tr key={u} style={{ borderBottom: `1px solid ${T.borderLight}` }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-[30px] h-[30px] rounded-full text-[11px] font-bold flex items-center justify-center flex-shrink-0"
                          style={{
                            background: isAdmin
                              ? 'linear-gradient(135deg,#1e3a5f,#3b82f6)'
                              : T.bg,
                            border: `1px solid ${T.border}`,
                            color: isAdmin ? 'white' : T.textSec,
                          }}
                        >
                          {u[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div>
                          <div className="text-[13px] font-semibold text-text font-mono">
                            {u}
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
                      <span
                        className="text-[11px] font-bold px-2 py-[2px] rounded-[20px]"
                        style={{
                          color: isAdmin ? T.red : T.accentStrong,
                          background: isAdmin ? T.redBg : T.accentBg,
                          border: `1px solid ${isAdmin ? T.redBorder : T.accentBorder}`,
                        }}
                      >
                        {isAdmin ? '管理員' : '一般使用者'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleReset(u)}
                          className="px-2.5 py-1 bg-white rounded-[6px] text-[11px] font-semibold text-text-sec cursor-pointer"
                          style={{ border: `1px solid ${T.border}` }}
                        >
                          重設密碼
                        </button>
                        {!isMe && (
                          <button
                            onClick={() => handleDelete(u)}
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
            const isAdmin = u === 'admin';
            const isMe = u === me;
            return (
              <div
                key={u}
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
                      background: isAdmin
                        ? 'linear-gradient(135deg,#1e3a5f,#3b82f6)'
                        : T.bg,
                      border: `1px solid ${T.border}`,
                      color: isAdmin ? 'white' : T.textSec,
                    }}
                  >
                    {u[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-text font-mono">
                      {u}
                      {isMe && (
                        <span className="ml-1.5 text-[10px] font-normal text-text-muted">
                          （您）
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className="text-[10px] font-bold px-2 py-[2px] rounded-[20px]"
                    style={{
                      color: isAdmin ? T.red : T.accentStrong,
                      background: isAdmin ? T.redBg : T.accentBg,
                      border: `1px solid ${isAdmin ? T.redBorder : T.accentBorder}`,
                    }}
                  >
                    {isAdmin ? '管理員' : '使用者'}
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleReset(u)}
                    className="flex-1 py-1.5 bg-white rounded-[6px] text-[11px] font-semibold text-text-sec cursor-pointer"
                    style={{ border: `1px solid ${T.border}` }}
                  >
                    重設密碼
                  </button>
                  {!isMe && (
                    <button
                      onClick={() => handleDelete(u)}
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

function RequestsEmpty() {
  return (
    <EmptyState
      icon="🚧"
      title="帳號申請審核功能尚未啟用"
      hint="目前系統尚未提供「申請帳號」的後端資料。如需邀請新成員，請於「使用者管理」直接建立帳號。"
    />
  );
}

function AdminDesktop({ onLogout, onBack }: Props) {
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
        <span className="text-xs font-semibold mr-5" style={{ color: 'rgba(255,255,255,0.5)' }}>
          管理員後台
        </span>
        {(
          [
            { id: 'users' as SubPage, label: '使用者管理' },
            { id: 'requests' as SubPage, label: '帳號申請審核' },
          ] as { id: SubPage; label: string }[]
        ).map((p) => {
          const isActive = subPage === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setSubPage(p.id)}
              className="flex items-center gap-1.5 px-3.5 h-[52px] border-0 bg-transparent text-[13px] font-semibold cursor-pointer transition-all duration-150"
              style={{
                color: isActive ? 'white' : 'rgba(255,255,255,0.5)',
                borderBottom: isActive ? '2px solid #3b82f6' : '2px solid transparent',
              }}
            >
              {p.label}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
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
        {subPage === 'users' ? (
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
        ) : (
          <RequestsEmpty />
        )}
      </main>
    </div>
  );
}

function AdminMobile({ onLogout, onBack }: Props) {
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
        {(
          [
            { id: 'users' as SubPage, label: '使用者管理' },
            { id: 'requests' as SubPage, label: '申請審核' },
          ] as { id: SubPage; label: string }[]
        ).map((p) => {
          const isActive = subPage === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setSubPage(p.id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 border-0 bg-transparent text-[13px] font-semibold cursor-pointer transition-all duration-150"
              style={{
                color: isActive ? T.text : T.textMuted,
                borderBottom: isActive ? `2px solid ${T.primary}` : '2px solid transparent',
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <main className="flex-1 overflow-y-auto px-3.5 pt-3 pb-6">
        {subPage === 'users' ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[15px] font-bold text-text">使用者管理</span>
            </div>
            <UsersTable desktop={false} />
          </>
        ) : (
          <RequestsEmpty />
        )}
      </main>
    </div>
  );
}

export default function Admin(props: Props) {
  const isMobile = useIsMobile();
  return isMobile ? <AdminMobile {...props} /> : <AdminDesktop {...props} />;
}
