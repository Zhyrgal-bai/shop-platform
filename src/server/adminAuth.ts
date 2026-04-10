import type { Request, Response } from "express";

function adminIdsFromEnv(): string[] {
  return (process.env.ADMIN_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Для POST /check-admin — та же логика, что и requireAdmin. */
export function adminIdsIncludes(userId: unknown): boolean {
  const ADMIN_IDS = adminIdsFromEnv();
  return ADMIN_IDS.includes(String(userId));
}

/**
 * Админ-эндпоинты: `const { userId } = req.body`, проверка через ADMIN_IDS.includes(String(userId)).
 */
export function requireAdmin(req: Request, res: Response): boolean {
  const { userId } = req.body as { userId?: unknown };
  const ADMIN_IDS = adminIdsFromEnv();
  const isAdminOk = ADMIN_IDS.includes(String(userId));
  if (!isAdminOk) {
    res.status(403).json({ message: "Нет доступа" });
    return false;
  }
  return true;
}
