import { useState, useRef, useCallback } from 'react';
import { T } from '../tokens';
import {
  attachmentUrl,
  uploadArticleAttachment,
  deleteArticleAttachment,
  ApiError,
  type ArticleAttachment,
} from '../api';

const MAX_MB = 10;

interface Props {
  slug: string;
  attachments: ArticleAttachment[];
  /** 可上傳/刪除者（後端為 manager 以上）。 */
  canEdit?: boolean;
  /** 上傳或刪除成功後請呼叫端重新載入文章。 */
  onChanged: () => void;
  dense?: boolean;
}

export function ArticleImages({ slug, attachments, canEdit, onChanged, dense }: Props) {
  const images = attachments.filter((a) => a.is_image);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<ArticleAttachment | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
      if (list.length === 0) return;
      const tooBig = list.find((f) => f.size > MAX_MB * 1024 * 1024);
      if (tooBig) {
        setError(`「${tooBig.name}」超過 ${MAX_MB}MB 上限`);
        return;
      }
      setBusy(true);
      setError(null);
      try {
        // 後端一次收一個檔，逐一上傳
        for (const f of list) await uploadArticleAttachment(slug, f);
        onChanged();
      } catch (e) {
        setError(e instanceof ApiError ? e.message : (e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [slug, onChanged]
  );

  const remove = async (name: string) => {
    if (!window.confirm(`確定移除圖片「${name}」？`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteArticleAttachment(slug, name);
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const dropProps = canEdit
    ? {
        onDragOver: (e: React.DragEvent) => {
          e.preventDefault();
          setDragging(true);
        },
        onDragLeave: () => setDragging(false),
        onDrop: (e: React.DragEvent) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files?.length) upload(e.dataTransfer.files);
        },
      }
    : {};

  // 沒有圖片且不能編輯 → 整區不顯示
  if (images.length === 0 && !canEdit) return null;

  return (
    <div
      className="mt-5"
      {...dropProps}
      style={{
        border: dragging ? `2px dashed ${T.accent}` : undefined,
        background: dragging ? T.accentBg : undefined,
        borderRadius: dragging ? T.radius : undefined,
        padding: dragging ? 8 : undefined,
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <span className="text-[13px] font-bold text-text">
          圖片說明
          {images.length > 0 && (
            <span className="ml-1.5 text-[11px] font-medium" style={{ color: T.textMuted }}>
              {images.length} 張
            </span>
          )}
        </span>
        {canEdit && images.length > 0 && (
          <button
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="text-[11px] font-semibold cursor-pointer font-sans disabled:opacity-60"
            style={{
              color: T.accentStrong,
              background: T.accentBg,
              border: `1px solid ${T.accentBorder}`,
              borderRadius: 6,
              padding: '4px 10px',
            }}
          >
            {busy ? '上傳中…' : '+ 上傳圖片'}
          </button>
        )}
      </div>

      {canEdit && (
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) upload(e.target.files);
            e.target.value = '';
          }}
        />
      )}

      {error && (
        <div
          className="text-xs mb-2"
          style={{
            color: T.red,
            background: T.redBg,
            border: `1px solid ${T.redBorder}`,
            borderRadius: 6,
            padding: '6px 10px',
          }}
        >
          {error}
        </div>
      )}

      {images.length === 0 ? (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="w-full text-center cursor-pointer font-sans"
          style={{
            border: `1px dashed ${T.border}`,
            borderRadius: T.radius,
            background: T.surface,
            padding: '26px 16px',
          }}
        >
          <div className="text-[13px] font-semibold" style={{ color: T.textSec }}>
            {busy ? '上傳中…' : '拖放圖片或點擊上傳'}
          </div>
          <div className="text-[11px] mt-1" style={{ color: T.textMuted }}>
            支援 PNG、JPG、GIF，單檔最大 {MAX_MB}MB，可多選
          </div>
        </button>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fill, minmax(${dense ? 90 : 120}px, 1fr))`,
            gap: 10,
          }}
        >
          {images.map((img) => (
            <div key={img.name} className="relative" style={{ aspectRatio: '1 / 1' }}>
              <img
                src={attachmentUrl(slug, img.name)}
                alt={img.name}
                onClick={() => setLightbox(img)}
                className="w-full h-full cursor-pointer"
                style={{ objectFit: 'cover', borderRadius: 8, border: `1px solid ${T.border}` }}
              />
              {canEdit && (
                <button
                  onClick={() => remove(img.name)}
                  title="移除圖片"
                  className="absolute flex items-center justify-center cursor-pointer border-0 text-white"
                  style={{
                    top: 4,
                    right: 4,
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: 'rgba(15,23,42,0.65)',
                    fontSize: 13,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 cursor-zoom-out"
          style={{ background: 'rgba(15,23,42,.88)' }}
        >
          <img
            src={attachmentUrl(slug, lightbox.name)}
            alt={lightbox.name}
            style={{ maxWidth: '100%', maxHeight: '82vh', objectFit: 'contain', borderRadius: 8 }}
          />
          <div className="mt-3 text-[12px]" style={{ color: 'rgba(255,255,255,0.75)' }}>
            {lightbox.name}
            {lightbox.size_display ? ` · ${lightbox.size_display}` : ''}
          </div>
        </div>
      )}
    </div>
  );
}
