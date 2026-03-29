export const getTelegramUser = () => {
  // @ts-ignore
  return window.Telegram?.WebApp?.initDataUnsafe?.user || null
}