import { getTelegramUser } from "./telegram";

const ADMIN_ID = Number(import.meta.env.VITE_ADMIN_ID);

export const isAdmin = () => {
  const user = getTelegramUser();

  console.log("USER:", user);
  console.log("ADMIN_ID:", ADMIN_ID);

  return user?.id === ADMIN_ID;
};