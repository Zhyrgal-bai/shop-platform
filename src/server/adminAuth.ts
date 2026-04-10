const ADMIN_IDS = (process.env.ADMIN_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

export function isAdmin(userId: unknown): boolean {
  if (userId === undefined || userId === null) return false;
  const s = String(userId).trim();
  if (!s) return false;
  return ADMIN_IDS.includes(s);
}
