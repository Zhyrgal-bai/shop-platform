/** Telegram Mini App: id из initDataUnsafe (как в ТЗ). */
export function getTelegramWebAppUserId(): number | undefined {
  if (typeof window === "undefined") return undefined;
  // @ts-expect-error Telegram WebApp
  const tg = window.Telegram?.WebApp;
  const userId = tg?.initDataUnsafe?.user?.id;
  return typeof userId === "number" && Number.isFinite(userId)
    ? userId
    : undefined;
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