import { useCallback, useEffect, useState } from 'react';
import type { AppRoute } from '../types';

/**
 * 以 hash 當路由（#/config）。
 *
 * GitHub Pages 沒有 SPA fallback，直接用 path 路由重新整理會 404，
 * 因此設計稿指定用 HashRouter。這裡用原生 hashchange 實作，
 * 不額外引入 react-router 相依。
 */

export const ROUTES: readonly AppRoute[] = [
  'login',
  'config',
  'issues',
  'issue-create',
  'requirements',
  'troubleshooting',
  'release-notes',
  'assistant',
  'admin',
] as const;

const isRoute = (v: string): v is AppRoute => (ROUTES as readonly string[]).includes(v);

/** 從 location.hash 取出路由；無法辨識時回傳 null。 */
export function routeFromHash(): AppRoute | null {
  const raw = window.location.hash.replace(/^#\/?/, '').split('?')[0].trim();
  return raw && isRoute(raw) ? raw : null;
}

export function useHashRoute(fallback: AppRoute): [AppRoute, (r: AppRoute) => void] {
  const [route, setRouteState] = useState<AppRoute>(() => routeFromHash() ?? fallback);

  // 上一頁／下一頁與直接貼網址都會走這裡
  useEffect(() => {
    const onHash = () => {
      const r = routeFromHash();
      if (r) setRouteState(r);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // 首次載入時把網址補成正規形式，之後上一頁才有東西可回
  useEffect(() => {
    if (!routeFromHash()) window.location.replace(`#/${route}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setRoute = useCallback((r: AppRoute) => {
    setRouteState(r);
    if (routeFromHash() !== r) window.location.hash = `#/${r}`;
  }, []);

  return [route, setRoute];
}
