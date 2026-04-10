import { api } from "../services/api";
import { getTelegramUser } from "./telegram";

/** Проверка по списку ADMIN_IDS на сервере (POST /check-admin). */
export async function checkIsAdmin(): Promise<boolean> {
  const u = getTelegramUser();
  if (!u?.id) return false;
  try {
    const res = await api.post<{ isAdmin: boolean }>("/check-admin", {
      userId: u.id,
    });
    return Boolean(res.data?.isAdmin);
  } catch {
    return false;
  }
}
