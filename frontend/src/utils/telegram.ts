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