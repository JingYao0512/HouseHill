import { useEffect, useState } from 'react';
import Login from './pages/Login';
import Config from './pages/Config';
import Issues from './pages/Issues';
import IssueCreate from './pages/IssueCreate';
import Requirements from './pages/Requirements';
import Troubleshooting from './pages/Troubleshooting';
import ReleaseNotes from './pages/ReleaseNotes';
import Assistant from './pages/Assistant';
import Admin from './pages/Admin';
import { auth, type Role } from './api';
import { useHashRoute } from './hooks/useHashRoute';
import type { PageId } from './types';

export default function App() {
  const loggedIn = !!auth.getToken();
  const [route, setRoute] = useHashRoute(loggedIn ? 'config' : 'login');
  const [role, setRole] = useState<Role>(auth.getRole());
  const isAdmin = role === 'admin';
  const isManager = role === 'admin' || role === 'manager';

  // 未登入時，任何路由都導回登入頁（含直接貼 #/config 這種網址）
  useEffect(() => {
    if (!auth.getToken() && route !== 'login') setRoute('login');
  }, [route, setRoute]);

  // 僅 admin 可進後台；非 admin 直接貼 #/admin 會被導回設定指引
  useEffect(() => {
    if (route === 'admin' && !isAdmin && auth.getToken()) setRoute('config');
  }, [route, isAdmin, setRoute]);

  const navTo = (id: PageId) => setRoute(id);
  const logout = () => {
    auth.clear();
    setRole('user');
    setRoute('login');
  };
  const goAdmin = isAdmin ? () => setRoute('admin') : undefined;
  const sharedProps = { onNav: navTo, onLogout: logout, isAdmin, isManager, onAdminClick: goAdmin };

  if (!auth.getToken()) {
    return (
      <Login
        onLogin={(r) => {
          setRole(r);
          setRoute('config');
        }}
      />
    );
  }

  switch (route) {
    case 'login':
      return (
        <Login
          onLogin={(r) => {
            setRole(r);
            setRoute('config');
          }}
        />
      );

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
