const rawAdminIds = import.meta.env.VITE_ADMIN_IDS;

const ADMIN_IDS = rawAdminIds
  ? rawAdminIds.split(",").map((id) => Number(id.trim()))
  : [];

console.log("ADMIN IDS:", ADMIN_IDS);

export const isAdmin = (userId: unknown): boolean => {
  console.log("USER ID:", userId);
  return ADMIN_IDS.includes(Number(userId));
};
