import { T } from '../tokens';

export function LoadingState({ label = '載入中…' }: { label?: string }) {
  return (
    <div className="text-center py-10 text-text-muted text-sm">
      <div className="text-2xl mb-2">⏳</div>
      <div>{label}</div>
    </div>
  );
}

export function EmptyState({
  icon = '📭',
  title,
  hint,
}: {
  icon?: string;
  title: string;
  hint?: string;
}) {
  return (
    <div className="text-center py-10 px-5 text-text-muted">
      <div className="text-3xl mb-2.5">{icon}</div>
      <div className="text-sm font-semibold text-text-sec mb-1">{title}</div>
      {hint && <div className="text-xs">{hint}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="text-center py-10 px-5">
      <div className="text-3xl mb-2.5">⚠️</div>
      <div className="text-sm font-semibold text-red mb-1">載入失敗</div>
      <div className="text-xs text-text-muted mb-3 max-w-[360px] mx-auto">{message}</div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-1.5 bg-white text-text-sec rounded-[8px] text-xs font-semibold cursor-pointer"
          style={{ border: `1px solid ${T.border}` }}
        >
          重試
        </button>
      )}
    </div>
  );
}
