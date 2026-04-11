import { api } from "./api";
import type { Product } from "../types";
import { getTelegramWebAppUserId } from "../utils/telegram";

function requireAdminUserId(): number {
  const userId = getTelegramWebAppUserId();
  if (!Number.isFinite(userId)) {
    throw new Error("Откройте приложение в Telegram");
  }
  return userId;
}

function viteApiBase(): string {
  const raw =
    typeof import.meta.env.VITE_API_URL === "string"
      ? import.meta.env.VITE_API_URL.trim()
      : "";
  const base = raw.replace(/\/$/, "");
  return base !== "" ? base : "https://bars-shop.onrender.com";
}

async function readFetchError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const j = JSON.parse(text) as { message?: string; error?: string };
    return (j.message ?? j.error ?? text) || res.statusText;
  } catch {
    return text || res.statusText;
  }
}

async function adminPost<T>(
  path: string,
  body: Record<string, unknown> = {}
): Promise<T> {
  const userId = requireAdminUserId();
  const url = `${viteApiBase()}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, userId }),
  });
  if (!res.ok) throw new Error(await readFetchError(res));
  return res.json() as Promise<T>;
}

async function adminDelete(path: string): Promise<void> {
  const userId = requireAdminUserId();
  const url = `${viteApiBase()}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) throw new Error(await readFetchError(res));
}

export type AdminPaymentDetail = {
  id: number;
  type: string;
  value: string;
};

export type AdminPromoRecord = {
  code: string;
  discount: number;
  maxUses: number;
  used: number;
};

export type AdminOrderListItem = {
  id: number;
  name: string;
  phone: string;
  status: string;
  statusText: string;
  total: number;
};

export type AdminAnalytics = {
  totalOrders: number;
  totalRevenue: number;
  accepted: number;
  done: number;
};

export const adminService = {
  async getProducts(): Promise<Product[]> {
    const res = await api.get<Product[]>("/products");
    return res.data;
  },

  async createProduct(data: Product): Promise<Product> {
    const userId = requireAdminUserId();
    try {
      const res = await api.post<Product>("/products", { ...data, userId });
      console.log("CREATED:", res.data);
      return res.data;
    } catch (e: unknown) {
      if (e instanceof Error) {
        console.error("CREATE ERROR:", e.message);
      }
      throw e;
    }
  },

  async deleteProduct(id: number): Promise<void> {
    const userId = requireAdminUserId();
    await api.delete(`/products/${id}`, { data: { userId } });
  },

  async updateProduct(
    id: number,
    patch: Partial<Pick<Product, "name" | "price" | "image" | "description">>
  ): Promise<Product> {
    const userId = requireAdminUserId();
    const res = await api.put<Product>(`/products/${id}`, {
      ...patch,
      userId,
    });
    return res.data;
  },

  async listPaymentDetails(): Promise<AdminPaymentDetail[]> {
    const data = await adminPost<AdminPaymentDetail[]>("/payment/list", {});
    return data ?? [];
  },

  async addPaymentDetail(
    type: string,
    value: string
  ): Promise<AdminPaymentDetail> {
    return adminPost<AdminPaymentDetail>("/payment", { type, value });
  },

  async deletePaymentDetail(id: number): Promise<void> {
    await adminDelete(`/payment/${id}`);
  },

  async listPromos(): Promise<AdminPromoRecord[]> {
    const data = await adminPost<AdminPromoRecord[]>("/promo/list", {});
    return data ?? [];
  },

  async addPromo(
    code: string,
    discount: number,
    maxUses: number
  ): Promise<AdminPromoRecord> {
    return adminPost<AdminPromoRecord>("/promo", {
      code,
      discount,
      maxUses,
    });
  },

  async deletePromo(code: string): Promise<void> {
    await adminDelete(`/promo/${encodeURIComponent(code)}`);
  },

  async listOrders(): Promise<AdminOrderListItem[]> {
    const data = await adminPost<AdminOrderListItem[]>("/orders/list", {});
    return data ?? [];
  },

  async getAnalytics(): Promise<AdminAnalytics> {
    const d = await adminPost<AdminAnalytics>("/analytics", {});
    if (
      !d ||
      typeof d.totalOrders !== "number" ||
      typeof d.totalRevenue !== "number" ||
      typeof d.accepted !== "number" ||
      typeof d.done !== "number"
    ) {
      throw new Error("Некорректный ответ аналитики");
    }
    return d;
  },
};
