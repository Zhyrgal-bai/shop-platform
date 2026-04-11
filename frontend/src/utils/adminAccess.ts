/**
 * Единый источник userId и проверки админа (Mini App + VITE_ADMIN_IDS).
 */

export function getWebAppUserId(): number {
  if (typeof window === "undefined") {
    return Number(undefined);
  }
  // @ts-expect-error Telegram WebApp
  const tg = window.Telegram?.WebApp;
  const userId = Number(tg?.initDataUnsafe?.user?.id);
  return userId;
}

/** Видимость админки в UI (меню, страница). */
export function isAdminPanelVisible(): boolean {
  if (typeof window === "undefined") return false;

  const userId = getWebAppUserId();

  const rawAdminIds = import.meta.env.VITE_ADMIN_IDS;
  const ADMIN_IDS: number[] = rawAdminIds
    ? rawAdminIds.split(",").map((id) => Number(id.trim()))
    : [];

  const isAdmin = ADMIN_IDS.includes(userId);

  console.log("USER ID:", userId);
  console.log("ADMIN IDS:", ADMIN_IDS);
  console.log("IS ADMIN:", isAdmin);

  return isAdmin;
}
