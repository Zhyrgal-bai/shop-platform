export function getWebAppUserId(): number {
  if (typeof window === "undefined") return 0;

  const tg = window.Telegram?.WebApp;

  const rawId = tg?.initDataUnsafe?.user?.id;

  return Number(rawId);
}

export function isAdminPanelVisible(): boolean {
  if (typeof window === "undefined") return false;

  const userId = getWebAppUserId();
  if (!Number.isFinite(userId) || userId <= 0) return false;

  const rawAdminIds = import.meta.env.VITE_ADMIN_IDS;

  const ADMIN_IDS: number[] = rawAdminIds
    ? rawAdminIds.split(",").map((id) => Number(id.trim()))
    : [];

  return ADMIN_IDS.includes(userId);
}