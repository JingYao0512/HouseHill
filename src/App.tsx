import { useState } from 'react';
import Login from './pages/Login';
import Config from './pages/Config';
import Issues from './pages/Issues';
import IssueCreate from './pages/IssueCreate';
import Troubleshooting from './pages/Troubleshooting';
import ReleaseNotes from './pages/ReleaseNotes';
import Admin from './pages/Admin';
import { auth } from './api';
import type { AppRoute, PageId } from './types';

export default function App() {
  const initialRoute: AppRoute = auth.getToken() ? 'config' : 'login';
  const [route, setRoute] = useState<AppRoute>(initialRoute);
  const [isAdmin, setIsAdmin] = useState<boolean>(auth.isAdmin());

  const navTo = (id: PageId) => setRoute(id);
  const logout = () => {
    auth.clear();
    setIsAdmin(false);
    setRoute('login');
  };
  const goAdmin = isAdmin ? () => setRoute('admin') : undefined;
  const sharedProps = { onNav: navTo, onLogout: logout, isAdmin, onAdminClick: goAdmin };

  switch (route) {
    case 'login':
      return (
        <Login
          onLogin={(asAdmin) => {
            setIsAdmin(asAdmin);
            setRoute(asAdmin ? 'config' : 'config');
          }}
        />
      );

    case 'admin':
      return <Admin onLogout={logout} onBack={() => setRoute('config')} />;

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

    case 'troubleshooting':
      return <Troubleshooting {...sharedProps} />;

    case 'release-notes':
      return <ReleaseNotes {...sharedProps} />;

    default:
      return null;
  }
}
