/// <reference types="vite/client" />

/** Telegram Mini App (telegram-web-app.js) */
interface TelegramWebAppUser {
  id: number;
  is_bot?: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: TelegramWebAppUser;
    query_id?: string;
    auth_date?: string;
    hash?: string;
  };
  ready: () => void;
}

interface ImportMetaEnv {
  readonly VITE_ADMIN_IDS?: string;
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  Telegram?: {
    WebApp?: TelegramWebApp;
  };
}
