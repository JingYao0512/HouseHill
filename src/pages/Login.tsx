import { useState } from 'react';
import { T } from '../tokens';
import { useIsMobile } from '../hooks/useMediaQuery';
import { auth, login as apiLogin, ApiError } from '../api';

interface Props {
  onLogin: (asAdmin: boolean) => void;
}

const ContourBg = ({
  count = 7,
  baseRx = 80,
  gapRx = 60,
  baseRy = 40,
  gapRy = 32,
  color = '#0f172a',
  opacity = 0.035,
  w = 600,
  h = 400,
  cx = 300,
  cy = 340,
}: {
  count?: number;
  baseRx?: number;
  gapRx?: number;
  baseRy?: number;
  gapRy?: number;
  color?: string;
  opacity?: number;
  w?: number;
  h?: number;
  cx?: number;
  cy?: number;
}) => (
  <svg
    className="absolute inset-0 w-full h-full pointer-events-none"
    style={{ opacity }}
    viewBox={`0 0 ${w} ${h}`}
    preserveAspectRatio="xMidYMid slice"
  >
    {Array.from({ length: count }, (_, i) => (
      <ellipse
        key={i}
        cx={cx}
        cy={cy}
        rx={baseRx + i * gapRx}
        ry={baseRy + i * gapRy}
        fill="none"
        stroke={color}
        strokeWidth="1"
      />
    ))}
  </svg>
);

const MountainSilhouette = () => (
  <svg
    className="absolute bottom-0 left-0 right-0 w-full pointer-events-none"
    style={{ height: 160, opacity: 0.06 }}
    viewBox="0 0 800 160"
    preserveAspectRatio="none"
  >
    <path
      d="M0,160 L0,90 L100,40 L200,70 L300,10 L400,55 L500,25 L600,70 L700,40 L800,60 L800,160Z"
      fill="#0f172a"
    />
  </svg>
);

function useLoginForm(onLogin: (asAdmin: boolean) => void) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!username.trim() || !password) {
      setError('請輸入帳號與密碼');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiLogin(username.trim(), password);
      auth.set(res.token, res.username);
      onLogin(res.username === 'admin');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '登入失敗，請確認伺服器是否啟動');
    } finally {
      setSubmitting(false);
    }
  };

  return { username, setUsername, password, setPassword, submitting, error, submit };
}

const registerFields = [
  { label: '姓名', ph: '王大明', span: 1, mono: false, name: 'name' },
  { label: '使用者名稱', ph: 'wang.daming', span: 1, mono: true, name: 'username' },
  { label: '電子信箱', ph: 'user@hospital.com', span: 2, mono: false, name: 'email' },
  { label: '所屬單位', ph: '放射科', span: 1, mono: false, name: 'dept' },
  { label: '職稱', ph: '放射科醫師', span: 1, mono: false, name: 'title' },
  { label: '申請原因', ph: '需要查閱 Ridge 軟體設定指引', span: 2, mono: false, area: true, name: 'reason' },
] as const;

function LoginDesktop({ onLogin }: Props) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [step, setStep] = useState<1 | 2>(1);
  const f = useLoginForm(onLogin);

  return (
    <div
      className="w-full h-full flex items-center justify-center relative overflow-hidden font-sans"
      style={{ background: '#f1f5f9' }}
    >
      <ContourBg />
      <MountainSilhouette />
      <div
        className="absolute top-0 left-0 right-0 h-[3px]"
        style={{ background: 'linear-gradient(90deg,#0f172a,#3b82f6,#0f172a)' }}
      />

      <div
        className="relative z-10 flex w-full max-w-[900px] rounded-[20px] overflow-hidden border border-border"
        style={{ boxShadow: '0 24px 64px -12px rgba(0,0,0,0.18)' }}
      >
        <div
          className="w-[340px] px-9 py-12 flex flex-col relative overflow-hidden flex-shrink-0"
          style={{ background: 'linear-gradient(160deg,#0f172a 0%,#1e3a5f 60%,#1e40af 100%)' }}
        >
          <ContourBg
            color="white"
            opacity={0.06}
            count={5}
            baseRx={60}
            gapRx={50}
            baseRy={30}
            gapRy={28}
            w={340}
            h={480}
            cx={170}
            cy={420}
          />
          <svg
            className="absolute bottom-0 left-0 right-0 w-full"
            style={{ height: 200, opacity: 0.12 }}
            viewBox="0 0 340 200"
            preserveAspectRatio="none"
          >
            <path
              d="M0,200 L0,100 L60,50 L120,80 L180,20 L240,60 L300,35 L340,55 L340,200Z"
              fill="white"
            />
          </svg>
          <div className="relative z-10">
            <div className="text-4xl mb-4">🏔️</div>
            <div className="text-white text-[26px] font-extrabold tracking-[-0.5px] leading-tight mb-2">
              山中小屋
            </div>
            <div className="text-white/55 text-[13px] leading-[1.7] mb-8">
              HouseHill — 醫療X光軟體
              <br />
              使用指引與管理平台
            </div>
            <div className="flex flex-col gap-3.5">
              {[
                { icon: '⚙️', text: '完整設定指引，快速上手' },
                { icon: '🔧', text: '故障排除知識庫' },
                { icon: '📋', text: '異常回報與進度追蹤' },
                { icon: '📦', text: '版本更新紀錄' },
              ].map((feat) => (
                <div key={feat.text} className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-[15px]"
                    style={{
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.15)',
                    }}
                  >
                    {feat.icon}
                  </div>
                  <span className="text-[13px] text-white/75 leading-snug">{feat.text}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="relative z-10 mt-auto pt-8">
            <div className="text-[11px] text-white/30 font-mono">HouseHill v0.0.1 (Beta)</div>
          </div>
        </div>

        <div className="flex-1 bg-white p-12">
          <div
            className="flex rounded-[10px] p-[3px] mb-8 w-fit"
            style={{ background: '#f1f5f9' }}
          >
            {(['login', 'register'] as const).map((id) => {
              const isActive = tab === id;
              return (
                <button
                  key={id}
                  onClick={() => {
                    setTab(id);
                    setStep(1);
                  }}
                  className="px-7 py-2.5 border-0 cursor-pointer text-[13px] font-semibold rounded-lg transition-all duration-200"
                  style={{
                    background: isActive ? 'white' : 'transparent',
                    color: isActive ? T.text : T.textMuted,
                    boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  {id === 'login' ? '登入' : '申請帳號'}
                </button>
              );
            })}
          </div>

          {tab === 'login' ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                f.submit();
              }}
            >
              <div className="mb-7">
                <div className="text-[22px] font-extrabold text-text tracking-[-0.4px] mb-1.5">
                  歡迎回來
                </div>
                <div className="text-sm text-text-muted">請輸入您的帳號資訊以登入系統</div>
              </div>
              <div className="mb-4">
                <label className="block text-xs font-semibold text-text-sec mb-1.5">
                  使用者名稱
                </label>
                <input
                  value={f.username}
                  onChange={(e) => f.setUsername(e.target.value)}
                  autoComplete="username"
                  className="w-full px-4 py-3 rounded-[10px] text-sm font-mono outline-none text-text"
                  style={{ border: `1.5px solid ${T.border}`, background: '#fafafa' }}
                  placeholder="your.username"
                />
              </div>
              <div className="mb-4">
                <label className="block text-xs font-semibold text-text-sec mb-1.5">密碼</label>
                <input
                  type="password"
                  value={f.password}
                  onChange={(e) => f.setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="w-full px-4 py-3 rounded-[10px] text-sm outline-none text-text"
                  style={{ border: `1.5px solid ${T.border}`, background: '#fafafa' }}
                  placeholder="••••••••"
                />
              </div>
              {f.error && (
                <div
                  className="rounded-[8px] px-3 py-2 mb-3 text-xs"
                  style={{ background: T.redBg, border: `1px solid ${T.redBorder}`, color: T.red }}
                >
                  {f.error}
                </div>
              )}
              <button
                type="submit"
                disabled={f.submitting}
                className="w-full py-3.5 mt-2 bg-primary text-white border-0 rounded-[10px] text-sm font-bold tracking-[0.3px]"
                style={{
                  cursor: f.submitting ? 'progress' : 'pointer',
                  opacity: f.submitting ? 0.7 : 1,
                  boxShadow: '0 4px 14px rgba(15,23,42,0.35)',
                }}
              >
                {f.submitting ? '登入中…' : '登入'}
              </button>
              <p className="text-center mt-4 text-xs text-text-muted">
                尚未有帳號？{' '}
                <span
                  onClick={() => setTab('register')}
                  className="text-accent cursor-pointer font-semibold"
                >
                  申請帳號
                </span>
              </p>
            </form>
          ) : step === 1 ? (
            <>
              <div className="mb-6">
                <div className="text-[22px] font-extrabold text-text tracking-[-0.4px] mb-1.5">
                  申請帳號
                </div>
                <div className="text-[13px] text-text-muted">
                  填寫資料後送出申請，待管理員審核通過後，系統將以 Email 通知
                </div>
              </div>
              <div
                className="rounded-[8px] px-3.5 py-2.5 mb-5 text-xs flex gap-2 items-start"
                style={{ background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0369a1' }}
              >
                <span className="flex-shrink-0">ℹ️</span>
                <span>
                  申請後由管理員審核，通常於 1–2 個工作天內完成。帳號僅限醫療院所內部人員使用。
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4">
                {registerFields.map((field) => (
                  <div
                    key={field.name}
                    className="mb-3.5"
                    style={{ gridColumn: field.span === 2 ? '1 / -1' : 'auto' }}
                  >
                    <label className="block text-xs font-semibold text-text-sec mb-1">
                      {field.label}
                    </label>
                    {'area' in field && field.area ? (
                      <textarea
                        className="w-full px-3.5 py-2.5 rounded-[8px] text-[13px] outline-none resize-none h-[72px]"
                        style={{ border: `1.5px solid ${T.border}`, background: '#fafafa' }}
                        placeholder={field.ph}
                      />
                    ) : (
                      <input
                        className={`w-full px-3.5 py-2.5 rounded-[8px] text-[13px] outline-none ${
                          field.mono ? 'font-mono' : ''
                        }`}
                        style={{ border: `1.5px solid ${T.border}`, background: '#fafafa' }}
                        placeholder={field.ph}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-2.5 mt-1">
                <button
                  onClick={() => setTab('login')}
                  className="px-6 py-2.5 bg-white text-text-sec rounded-[10px] text-[13px] font-semibold cursor-pointer"
                  style={{ border: `1px solid ${T.border}` }}
                >
                  取消
                </button>
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 py-3 bg-primary text-white border-0 rounded-[10px] text-sm font-bold cursor-pointer"
                >
                  送出申請
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-10">
              <div
                className="w-16 h-16 rounded-full bg-green-bg mx-auto mb-5 flex items-center justify-center text-[28px]"
                style={{ border: `2px solid ${T.greenBorder}` }}
              >
                ✓
              </div>
              <div className="text-xl font-extrabold text-text mb-2">申請已送出</div>
              <div className="text-sm text-text-muted leading-[1.7] max-w-[320px] mx-auto mb-7">
                您的帳號申請已成功送出，管理員將於 1–2 個工作天內審核。
                <br />
                審核結果將寄送至您填寫的電子信箱。
              </div>
              <button
                onClick={() => {
                  setTab('login');
                  setStep(1);
                }}
                className="px-8 py-2.5 bg-primary text-white border-0 rounded-[10px] text-sm font-bold cursor-pointer"
              >
                返回登入
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LoginMobile({ onLogin }: Props) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [step, setStep] = useState<1 | 2>(1);
  const f = useLoginForm(onLogin);

  return (
    <div
      className="w-full h-full flex flex-col font-sans relative overflow-hidden"
      style={{ background: '#f1f5f9' }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-[3px]"
        style={{ background: 'linear-gradient(90deg,#0f172a,#3b82f6,#0f172a)' }}
      />
      <svg
        className="absolute bottom-0 left-0 right-0 w-full pointer-events-none"
        style={{ height: 120, opacity: 0.05 }}
        viewBox="0 0 375 120"
        preserveAspectRatio="none"
      >
        <path
          d="M0,120 L0,60 L50,25 L110,50 L180,10 L240,40 L300,20 L375,35 L375,120Z"
          fill="#0f172a"
        />
      </svg>
      <div className="flex-1 overflow-y-auto px-5 pt-7 pb-8 relative z-10">
        <div className="text-center mb-7">
          <div
            className="w-[52px] h-[52px] rounded-[14px] mx-auto mb-3 flex items-center justify-center text-[26px]"
            style={{
              background: 'linear-gradient(135deg,#0f172a,#1e3a5f)',
              boxShadow: '0 8px 20px rgba(15,23,42,0.3)',
            }}
          >
            🏔️
          </div>
          <div className="text-xl font-extrabold text-text tracking-[-0.4px]">HouseHill</div>
          <div className="text-[11px] text-text-muted mt-0.5">
            山中小屋 · 醫療X光軟體指引
          </div>
        </div>
        <div
          className="bg-white rounded-2xl border border-border overflow-hidden"
          style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
        >
          <div className="flex border-b border-border bg-bg">
            {(['login', 'register'] as const).map((id) => {
              const isActive = tab === id;
              return (
                <button
                  key={id}
                  onClick={() => {
                    setTab(id);
                    setStep(1);
                  }}
                  className="flex-1 py-3 border-0 bg-transparent text-[13px] font-semibold cursor-pointer transition-all duration-150"
                  style={{
                    color: isActive ? T.text : T.textMuted,
                    borderBottom: isActive ? `2px solid ${T.primary}` : '2px solid transparent',
                  }}
                >
                  {id === 'login' ? '登入' : '申請帳號'}
                </button>
              );
            })}
          </div>
          <div className="px-5 pt-5 pb-6">
            {tab === 'login' ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  f.submit();
                }}
              >
                <div className="mb-3.5">
                  <label className="block text-xs font-semibold text-text-sec mb-1">
                    使用者名稱
                  </label>
                  <input
                    value={f.username}
                    onChange={(e) => f.setUsername(e.target.value)}
                    autoComplete="username"
                    className="w-full px-3.5 py-3 rounded-[10px] text-[15px] font-mono outline-none text-text"
                    style={{ border: `1.5px solid ${T.border}`, background: '#fafafa' }}
                    placeholder="your.username"
                  />
                </div>
                <div className="mb-3.5">
                  <label className="block text-xs font-semibold text-text-sec mb-1">密碼</label>
                  <input
                    type="password"
                    value={f.password}
                    onChange={(e) => f.setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="w-full px-3.5 py-3 rounded-[10px] text-[15px] outline-none text-text"
                    style={{ border: `1.5px solid ${T.border}`, background: '#fafafa' }}
                    placeholder="••••••••"
                  />
                </div>
                {f.error && (
                  <div
                    className="rounded-[8px] px-3 py-2 mb-2 text-xs"
                    style={{ background: T.redBg, border: `1px solid ${T.redBorder}`, color: T.red }}
                  >
                    {f.error}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={f.submitting}
                  className="w-full py-3.5 mt-1.5 bg-primary text-white border-0 rounded-[10px] text-[15px] font-bold"
                  style={{
                    cursor: f.submitting ? 'progress' : 'pointer',
                    opacity: f.submitting ? 0.7 : 1,
                    boxShadow: '0 4px 14px rgba(15,23,42,0.3)',
                  }}
                >
                  {f.submitting ? '登入中…' : '登入'}
                </button>
              </form>
            ) : step === 1 ? (
              <>
                <div
                  className="rounded-lg px-3 py-2 mb-3.5 text-xs leading-relaxed"
                  style={{ background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0369a1' }}
                >
                  📋 申請後由管理員審核，審核通過後將寄送通知信件
                </div>
                {[
                  { label: '姓名', ph: '王大明' },
                  { label: '使用者名稱', ph: 'wang.daming', mono: true },
                  { label: '電子信箱', ph: 'user@hospital.com' },
                  { label: '所屬單位', ph: '放射科' },
                  { label: '職稱', ph: '放射科醫師' },
                ].map((field) => (
                  <div key={field.label} className="mb-3">
                    <label className="block text-xs font-semibold text-text-sec mb-1">
                      {field.label}
                    </label>
                    <input
                      className={`w-full px-3.5 py-2.5 rounded-lg text-[15px] outline-none ${
                        field.mono ? 'font-mono' : ''
                      }`}
                      style={{ border: `1.5px solid ${T.border}`, background: '#fafafa' }}
                      placeholder={field.ph}
                    />
                  </div>
                ))}
                <div className="mb-3.5">
                  <label className="block text-xs font-semibold text-text-sec mb-1">
                    申請原因
                  </label>
                  <textarea
                    className="w-full px-3.5 py-2.5 rounded-lg text-[15px] outline-none resize-none h-[72px]"
                    style={{ border: `1.5px solid ${T.border}`, background: '#fafafa' }}
                    placeholder="請簡述申請原因"
                  />
                </div>
                <button
                  onClick={() => setStep(2)}
                  className="w-full py-3.5 bg-primary text-white border-0 rounded-[10px] text-[15px] font-bold cursor-pointer"
                >
                  送出申請
                </button>
              </>
            ) : (
              <div className="text-center pt-5 pb-2">
                <div
                  className="w-14 h-14 rounded-full bg-green-bg mx-auto mb-4 flex items-center justify-center text-2xl"
                  style={{ border: `2px solid ${T.greenBorder}` }}
                >
                  ✓
                </div>
                <div className="text-[17px] font-extrabold text-text mb-2">申請已送出</div>
                <div className="text-[13px] text-text-muted leading-[1.7] mb-5">
                  管理員將於 1–2 個工作天內審核，
                  <br />
                  結果將寄送至您的信箱。
                </div>
                <button
                  onClick={() => {
                    setTab('login');
                    setStep(1);
                  }}
                  className="w-full py-3 bg-primary text-white border-0 rounded-[10px] text-sm font-bold cursor-pointer"
                >
                  返回登入
                </button>
              </div>
            )}
          </div>
        </div>
        <p className="text-center mt-4 text-[11px] text-text-muted">HouseHill v0.0.1 (Beta)</p>
      </div>
    </div>
  );
}

export default function Login(props: Props) {
  const isMobile = useIsMobile();
  return isMobile ? <LoginMobile {...props} /> : <LoginDesktop {...props} />;
}
