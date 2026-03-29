import { getTelegramUser } from "./telegram"

export const isAdmin = () => {
  const user = getTelegramUser()
  const ADMIN_ID = Number(import.meta.env.VITE_ADMIN_ID)

  return user?.id === ADMIN_ID
}