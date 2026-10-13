import { useState, useRef, useEffect, useCallback } from 'react';
import { TopBar } from '../components/TopBar';
import { NavHeader } from '../components/NavHeader';
import { MobileNav } from '../components/MobileNav';
import { T } from '../tokens';
import {
  fetchArticles,
  askAssistantApi,
  assistantConfigured,
  ApiError,
  type ArticleListItem,
  type AssistantRef,
} from '../api';
import { useApi } from '../hooks/useApi';
import type { PageId } from '../types';
import { useIsMobile } from '../hooks/useMediaQuery';

const MONO = "'JetBrains Mono',monospace";

const SUGGESTIONS = [
  'DICOM 影像無法載入怎麼辦？',
  '如何調整連線逾時設定？',
  '影像顯示模糊要檢查哪些參數？',
  '服務啟動失敗如何排查？',
];

interface Props {
  onNav: (id: PageId) => void;
  onLogout?: () => void;
  isAdmin?: boolean;
  isManager?: boolean;
  onAdminClick?: () => void;
}

interface Msg {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  refs?: AssistantRef[];
  keys?: string[];
  error?: boolean;
  retry?: string;
}

// ── 示範模式：用知識庫文章做 bigram 比對 ────────────────────────────

const bigrams = (s: string) => {
  const out: string[] = [];
  for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
  return out;
};

function mockAnswer(q: string, articles: ArticleListItem[]) {
  const s = q.toLowerCase();
  const scored = articles
    .map((a) => {
      const t = a.title.toLowerCase();
      const score =
        bigrams(t).filter((b) => s.includes(b)).length +
        (a.tags ?? []).filter((tag) => s.includes(tag.toLowerCase())).length * 2;
      return { a, score };
    })
    .filter((x) => x.score >= 2)
    .sort((x, y) => y.score - x.score)
    .slice(0, 2);

  if (scored.length === 0) {
    return {
      answer:
        '目前在知識庫中找不到直接相關的資料。\n\n建議您補充更多細節，例如錯誤訊息、發生時的操作步驟，或到「異常回報」建立一筆回報，由負責人員協助處理。',
      refs: [],
      keys: [],
    };
  }
  const a = scored[0].a;
  const keys = a.related_config_keys ?? [];
  const steps = [
    '1. 確認相關服務是否正常運作',
    keys.length ? `2. 檢查設定參數 ${keys.join('、')} 的值是否正確` : '2. 檢查相關設定參數的值是否正確',
    '3. 查看系統日誌中的錯誤訊息',
    '4. 重新啟動服務並確認問題是否解決',
  ].join('\n');
  return {
    answer: `關於「${a.title}」：${a.snippet ?? ''}\n\n建議依下列步驟排查：\n${steps}`,
    refs: scored.map((x) => ({ id: x.a.slug, title: x.a.title })),
    keys,
  };
}

// ── Chat state ───────────────────────────────────────────────────────

function useAssistantChat(articles: ArticleListItem[]) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const msgsRef = useRef<Msg[]>(msgs);
  msgsRef.current = msgs;
  const articlesRef = useRef(articles);
  articlesRef.current = articles;
  // 以 ref 讀取 loading，讓 send 不必把 loading 放進相依而每次重建
  const loadingRef = useRef(loading);
  loadingRef.current = loading;

  const send = useCallback(async (text: string) => {
    const q = text.trim();
    if (!q || loadingRef.current) return;
    const history = msgsRef.current
      .filter((m) => !m.error)
      .map((m) => ({ role: m.role, content: m.text }));
    setMsgs((m) => [...m, { id: `u${Date.now()}`, role: 'user', text: q }]);
    setLoading(true);
    try {
      const r = assistantConfigured
        ? await askAssistantApi(q, history)
        : await new Promise<ReturnType<typeof mockAnswer>>((resolve) =>
            setTimeout(() => resolve(mockAnswer(q, articlesRef.current)), 900)
          );
      setMsgs((m) => [
        ...m,
        {
          id: `a${Date.now()}`,
          role: 'assistant',
          text: r.answer ?? '',
          refs: r.refs ?? [],
          keys: r.keys ?? [],
        },
      ]);
    } catch (e) {
      setMsgs((m) => [
        ...m,
        {
          id: `e${Date.now()}`,
          role: 'assistant',
          error: true,
          text: e instanceof ApiError ? e.message : '回覆失敗，請稍後再試。',
          retry: q,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  const retry = useCallback(
    (msg: Msg) => {
      setMsgs((m) => {
        const i = m.findIndex((x) => x.id === msg.id);
        return m.slice(0, Math.max(0, i - 1));
      });
      if (msg.retry) setTimeout(() => send(msg.retry as string), 0);
    },
    [send]
  );

  const reset = useCallback(() => {
    if (!loadingRef.current) setMsgs([]);
  }, []);

  return { msgs, loading, send, retry, reset };
}

// ── Pieces ───────────────────────────────────────────────────────────

const Avatar = ({ size = 28 }: { size?: number }) => (
  <div
    className="flex items-center justify-center flex-shrink-0"
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.28,
      background: T.primary,
      fontSize: size * 0.5,
    }}
  >
    🏔️
  </div>
);

function Bubble({
  m,
  onRetry,
  onOpenArticle,
  mobile,
}: {
  m: Msg;
  onRetry: (m: Msg) => void;
  onOpenArticle: () => void;
  mobile?: boolean;
}) {
  if (m.role === 'user') {
    return (
      <div className="flex justify-end" style={{ marginBottom: 16 }}>
        <div
          style={{
            maxWidth: mobile ? '85%' : '75%',
            background: T.primary,
            color: 'white',
            padding: '10px 14px',
            borderRadius: '14px 14px 4px 14px',
            fontSize: 14,
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {m.text}
        </div>
      </div>
    );
  }

  const hasChips = (m.refs?.length ?? 0) > 0 || (m.keys?.length ?? 0) > 0;
  return (
    <div className="flex gap-2.5 items-start" style={{ marginBottom: 16 }}>
      <Avatar />
      <div style={{ maxWidth: mobile ? 'calc(100% - 38px)' : '85%', minWidth: 0 }}>
        <div
          style={{
            background: m.error ? T.redBg : T.surface,
            border: `1px solid ${m.error ? T.redBorder : T.border}`,
            color: m.error ? T.red : T.text,
            padding: '12px 16px',
            borderRadius: '4px 14px 14px 14px',
            fontSize: 14,
            lineHeight: 1.75,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            boxShadow: T.shadow,
          }}
        >
          {m.text}
          {m.error && (
            <button
              onClick={() => onRetry(m)}
              className="block mt-2 text-xs font-semibold cursor-pointer font-sans"
              style={{
                color: T.red,
                background: T.surface,
                border: `1px solid ${T.redBorder}`,
                borderRadius: 6,
                padding: '4px 12px',
              }}
            >
              重試
            </button>
          )}
        </div>
        {hasChips && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {(m.refs ?? []).map((r) => (
              <button
                key={r.id}
                onClick={onOpenArticle}
                className="text-xs cursor-pointer font-sans"
                style={{
                  color: T.accentStrong,
                  background: T.accentBg,
                  border: `1px solid ${T.accentBorder}`,
                  padding: '3px 10px',
                  borderRadius: 20,
                }}
              >
                故障排除：{r.title} →
              </button>
            ))}
            {(m.keys ?? []).map((k) => (
              <span
                key={k}
                className="text-[11px]"
                style={{
                  fontFamily: MONO,
                  color: T.textSec,
                  background: T.surface,
                  border: `1px solid ${T.border}`,
                  padding: '3px 8px',
                  borderRadius: 5,
                }}
              >
                {k}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const Typing = () => (
  <div className="flex gap-2.5 items-start" style={{ marginBottom: 16 }}>
    <style>
      {'@keyframes hhDot{0%,80%,100%{opacity:.25;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}'}
    </style>
    <Avatar />
    <div
      className="flex gap-[5px]"
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: '4px 14px 14px 14px',
        padding: '14px 16px',
      }}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: T.textMuted,
            animation: `hhDot 1.2s ${i * 0.15}s infinite ease-in-out`,
          }}
        />
      ))}
    </div>
  </div>
);

function Empty({ onPick, mobile }: { onPick: (s: string) => void; mobile?: boolean }) {
  return (
    <div className="text-center" style={{ padding: mobile ? '20px 0 8px' : '40px 0 8px' }}>
      <div className="flex justify-center" style={{ marginBottom: 14 }}>
        <Avatar size={mobile ? 44 : 52} />
      </div>
      <div
        className="font-extrabold text-text"
        style={{ fontSize: mobile ? 18 : 21, letterSpacing: '-0.3px' }}
      >
        有什麼可以幫您？
      </div>
      <div className="text-[13px] mt-1.5" style={{ color: T.textMuted }}>
        詢問設定參數、故障排除或系統操作問題
      </div>
      <div
        className="text-left"
        style={{
          display: 'grid',
          gridTemplateColumns: mobile ? '1fr' : 'repeat(2,minmax(0,1fr))',
          gap: 10,
          maxWidth: 580,
          margin: mobile ? '20px auto 0' : '28px auto 0',
        }}
      >
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="flex items-center justify-between gap-2 text-[13px] text-text cursor-pointer text-left font-sans"
            style={{
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: 10,
              padding: '12px 14px',
              boxShadow: T.shadow,
              minHeight: 44,
            }}
          >
            <span>{s}</span>
            <span style={{ color: T.textMuted }}>→</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Composer({
  onSend,
  disabled,
  mobile,
}: {
  onSend: (v: string) => void;
  disabled?: boolean;
  mobile?: boolean;
}) {
  const [v, setV] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [v]);

  const can = v.trim().length > 0 && !disabled;
  const submit = () => {
    if (!can) return;
    onSend(v);
    setV('');
  };

  return (
    <div
      className="flex items-end gap-2"
      style={{
        background: T.surface,
        border: `1.5px solid ${T.border}`,
        borderRadius: 14,
        padding: '6px 6px 6px 14px',
        boxShadow: T.shadowMd,
      }}
    >
      <textarea
        ref={ref}
        rows={1}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          // 中文輸入法組字中不可送出
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="輸入您的問題…"
        className="flex-1 min-w-0 border-0 outline-none resize-none bg-transparent font-sans text-text"
        style={{ fontSize: mobile ? 15 : 14, lineHeight: 1.6, padding: '8px 0', maxHeight: 120 }}
      />
      <button
        onClick={submit}
        disabled={!can}
        title="送出"
        className="flex items-center justify-center flex-shrink-0 border-0 text-white transition-colors duration-150"
        style={{
          width: mobile ? 40 : 38,
          height: mobile ? 40 : 38,
          borderRadius: 10,
          background: can ? T.primary : '#cbd5e1',
          cursor: can ? 'pointer' : 'not-allowed',
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
      </button>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────

export default function Assistant({ onNav, onLogout, isAdmin, onAdminClick }: Props) {
  const isMobile = useIsMobile();
  const articles = useApi<ArticleListItem[]>((signal) => fetchArticles({}, signal), []);
  const chat = useAssistantChat(articles.data ?? []);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.msgs, chat.loading]);

  const openArticle = () => onNav('troubleshooting');

  const header = (
    <div
      className="flex items-center flex-shrink-0"
      style={{
        background: T.surface,
        borderBottom: `1px solid ${T.border}`,
        padding: isMobile ? '10px 14px' : '12px 24px',
        gap: isMobile ? 10 : 12,
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-bold text-text">客服小幫手</div>
        {isMobile ? (
          !assistantConfigured && (
            <div className="text-[11px] mt-0.5" style={{ color: '#92400e' }}>
              示範模式 · 尚未串接 API
            </div>
          )
        ) : (
          <div className="text-xs mt-px" style={{ color: T.textMuted }}>
            回答設定、故障排除與系統操作相關問題
          </div>
        )}
      </div>
      {!isMobile && !assistantConfigured && (
        <span
          className="text-[11px] font-semibold whitespace-nowrap"
          style={{
            color: '#92400e',
            background: T.amberBg,
            border: `1px solid ${T.amberBorder}`,
            padding: '3px 9px',
            borderRadius: 20,
          }}
        >
          示範模式 · 尚未串接 API
        </span>
      )}
      <button
        onClick={chat.reset}
        disabled={chat.msgs.length === 0}
        className="font-semibold font-sans flex-shrink-0"
        style={{
          padding: isMobile ? '8px 12px' : '7px 14px',
          minHeight: isMobile ? 36 : undefined,
          background: T.surface,
          color: chat.msgs.length ? T.textSec : T.textMuted,
          border: `1px solid ${T.border}`,
          borderRadius: T.radiusSm,
          fontSize: isMobile ? 12 : 13,
          cursor: chat.msgs.length ? 'pointer' : 'default',
        }}
      >
        + 新對話
      </button>
    </div>
  );

  const thread = (
    <>
      {chat.msgs.length === 0 && !chat.loading ? (
        <Empty onPick={chat.send} mobile={isMobile} />
      ) : (
        chat.msgs.map((m) => (
          <Bubble
            key={m.id}
            m={m}
            onRetry={chat.retry}
            onOpenArticle={openArticle}
            mobile={isMobile}
          />
        ))
      )}
      {chat.loading && <Typing />}
    </>
  );

  return (
    <div className="w-full h-full flex flex-col bg-bg font-sans relative">
      <TopBar />
      <NavHeader
        active="assistant"
        onNav={onNav}
        onLogout={onLogout}
        isAdmin={isAdmin}
        onAdminClick={onAdminClick}
        mobile={isMobile}
      />
      {header}

      {isMobile ? (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto" style={{ padding: '16px 14px 8px' }}>
            {thread}
          </div>
          <div className="flex-shrink-0" style={{ padding: '8px 12px 10px' }}>
            <Composer onSend={chat.send} disabled={chat.loading} mobile />
          </div>
          <MobileNav active="assistant" onNav={onNav} />
        </>
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 32px 8px' }}>{thread}</div>
          </div>
          <div className="flex-shrink-0" style={{ padding: '10px 32px 14px' }}>
            <div style={{ maxWidth: 760, margin: '0 auto' }}>
              <Composer onSend={chat.send} disabled={chat.loading} />
              <div className="text-[11px] text-center mt-[7px]" style={{ color: T.textMuted }}>
                Enter 送出 · Shift + Enter 換行 · 回覆內容僅供參考，重要設定請再次確認
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
