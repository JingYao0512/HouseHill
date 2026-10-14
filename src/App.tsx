import { useEffect, useRef, useState } from 'react';
import Login from './pages/Login';
import Config from './pages/Config';
import Issues from './pages/Issues';
import IssueCreate from './pages/IssueCreate';
import Requirements from './pages/Requirements';
import Troubleshooting from './pages/Troubleshooting';
import ReleaseNotes from './pages/ReleaseNotes';
import Assistant from './pages/Assistant';
import Admin from './pages/Admin';
import { auth, checkSessionExpiry, onSessionExpired, type Role } from './api';
import { useHashRoute } from './hooks/useHashRoute';
import type { AppRoute, PageId } from './types';

const EXPIRY_CHECK_MS = 60_000;

// 開頁時先檢查 localStorage 裡的 token 是否已過期 —— 過期就直接進登入頁，
// 不會先進設定指引再卡在「載入失敗」。放在模組層只執行一次：
// 若放在 useState 初始化函式裡，StrictMode 會執行兩次，第二次已讀不到 token 而誤判為未過期。
const EXPIRED_AT_STARTUP = checkSessionExpiry();

export default function App() {
  const [sessionExpired, setSessionExpired] = useState(EXPIRED_AT_STARTUP);
  const loggedIn = !!auth.getToken();
  const [route, setRoute] = useHashRoute(loggedIn ? 'config' : 'login');
  const [role, setRole] = useState<Role>(auth.getRole());
  const isAdmin = role === 'admin';
  const isManager = role === 'admin' || role === 'manager';

  // 登入逾時後，重新登入要回到原本所在的頁面（含直接貼網址進來的情況）
  const routeRef = useRef<AppRoute>(route);
  routeRef.current = route;
  const returnTo = useRef<AppRoute | null>(sessionExpired && route !== 'login' ? route : null);

  // 未登入時，任何路由都導回登入頁（含直接貼 #/config 這種網址）
  useEffect(() => {
    if (!auth.getToken() && route !== 'login') setRoute('login');
  }, [route, setRoute]);

  // 僅 admin 可進後台；非 admin 直接貼 #/admin 會被導回設定指引
  useEffect(() => {
    if (route === 'admin' && !isAdmin && auth.getToken()) setRoute('config');
  }, [route, isAdmin, setRoute]);

  // 登入失效（API 回 401，或 token 到期）→ 回登入頁並提示
  useEffect(
    () =>
      onSessionExpired(() => {
        if (routeRef.current !== 'login') returnTo.current = routeRef.current;
        setRole('user');
        setSessionExpired(true);
        setRoute('login');
      }),
    [setRoute]
  );

  // 分頁放著沒動、隔天再切回來時，不必等到點了東西才發現已過期
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') checkSessionExpiry();
    };
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(checkSessionExpiry, EXPIRY_CHECK_MS);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, []);

  const navTo = (id: PageId) => setRoute(id);
  const logout = () => {
    auth.clear();
    returnTo.current = null;
    setSessionExpired(false);
    setRole('user');
    setRoute('login');
  };
  const handleLogin = (r: Role) => {
    setRole(r);
    setSessionExpired(false);
    setRoute(returnTo.current ?? 'config');
    returnTo.current = null;
  };
  const goAdmin = isAdmin ? () => setRoute('admin') : undefined;
  const sharedProps = { onNav: navTo, onLogout: logout, isAdmin, isManager, onAdminClick: goAdmin };
  const loginNotice = sessionExpired ? '登入已逾時，請重新登入。' : undefined;

  if (!auth.getToken() || route === 'login') {
    return <Login onLogin={handleLogin} notice={loginNotice} />;
  }

  switch (route) {
    case 'admin':
      return (
        <Admin
          onLogout={logout}
          onBack={() => setRoute('config')}
          onOpenRequirements={() => setRoute('requirements')}
        />
      );

    case 'config':
      return <Config {...sharedProps} />;

    case 'issues':
      return <Issues {...sharedProps} onCreate={() => setRoute('issue-create')} />;

    case 'issue-create':
      return (
        <IssueCreate
          {...sharedProps}
          onDone={() => setRoute('issues')}
          onCancel={() => setRoute('issues')}
        />
      );

    case 'requirements':
      return <Requirements {...sharedProps} />;

    case 'troubleshooting':
      return <Troubleshooting {...sharedProps} />;

    case 'release-notes':
      return <ReleaseNotes {...sharedProps} />;

    case 'assistant':
      return <Assistant {...sharedProps} />;

    default:
      return <Config {...sharedProps} />;
  }
}
