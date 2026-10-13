/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  /** 客服小幫手的回答端點；未設定時前端使用知識庫比對的示範回覆。 */
  readonly VITE_ASSISTANT_API?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
