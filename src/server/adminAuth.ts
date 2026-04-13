import type { Request, Response } from "express";

const ADMIN_IDS = process.env.ADMIN_IDS
  ? process.env.ADMIN_IDS.split(",").map((id) => id.trim())
  : [];

export function isAdmin(userId: unknown): boolean {
  if (userId === undefined || userId === null || userId === "") return false;
  const num = Number(userId);
  if (Number.isFinite(num) && num <= 0) return false;
  return ADMIN_IDS.includes(String(userId));
}

/** Все admin endpoint: проверка `req.body.userId`. */
export function denyIfNotAdmin(req: Request, res: Response): boolean {
  if (!isAdmin(req.body?.userId)) {
    res.status(403).json({ message: "Нет прав" });
    return false;
  }
  return true;
}

/** GET и др.: `?userId=` */
export function denyIfNotAdminQuery(req: Request, res: Response): boolean {
  const raw = req.query.userId;
  const userId = Array.isArray(raw) ? raw[0] : raw;
  if (!isAdmin(userId)) {
    res.status(403).json({ message: "Нет прав" });
    return false;
  }
  return true;
}
