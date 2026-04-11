import { getWebAppUserId } from "./adminAccess";

/** Telegram Mini App: тот же `userId`, что и в `getWebAppUserId()`. */
export function getTelegramWebAppUserId(): number {
  return getWebAppUserId();
}

export const getTelegramUser = () => {
  // @ts-expect-error Telegram WebApp
  const tg = window.Telegram?.WebApp;

  if (!tg) {
    console.log("NO TELEGRAM");
    return null;
  }

  console.log("INIT DATA:", tg.initData);
  console.log("INIT DATA UNSAFE:", tg.initDataUnsafe);

  return tg.initDataUnsafe?.user || null;
};
