import { api } from "./api";
import type { Product } from "../types";
import { getTelegramWebAppUserId } from "../utils/telegram";

/** userId из window.Telegram.WebApp.initDataUnsafe.user.id — для всех admin-запросов. */
function requireAdminUserId(): number {
  const userId = getTelegramWebAppUserId();
  if (userId == null) {
    throw new Error("Откройте приложение в Telegram");
  }
  return userId;
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
    const userId = requireAdminUserId();
    const res = await api.post<AdminPaymentDetail[]>("/payment/list", {
      userId,
    });
    return res.data ?? [];
  },

  async addPaymentDetail(
    type: string,
    value: string
  ): Promise<AdminPaymentDetail> {
    const userId = requireAdminUserId();
    const res = await api.post<AdminPaymentDetail>("/payment", {
      type,
      value,
      userId,
    });
    return res.data;
  },

  async deletePaymentDetail(id: number): Promise<void> {
    const userId = requireAdminUserId();
    await api.delete(`/payment/${id}`, { data: { userId } });
  },

  async listPromos(): Promise<AdminPromoRecord[]> {
    const userId = requireAdminUserId();
    const res = await api.post<AdminPromoRecord[]>("/promo/list", {
      userId,
    });
    return res.data ?? [];
  },

  async addPromo(
    code: string,
    discount: number,
    maxUses: number
  ): Promise<AdminPromoRecord> {
    const userId = requireAdminUserId();
    const res = await api.post<AdminPromoRecord>("/promo", {
      userId,
      code,
      discount,
      maxUses,
    });
    return res.data;
  },

  async deletePromo(code: string): Promise<void> {
    const userId = requireAdminUserId();
    await api.delete(`/promo/${encodeURIComponent(code)}`, {
      data: { userId },
    });
  },

  async listOrders(): Promise<AdminOrderListItem[]> {
    const userId = requireAdminUserId();
    const res = await api.post<AdminOrderListItem[]>("/orders/list", {
      userId,
    });
    return res.data ?? [];
  },

  async getAnalytics(): Promise<AdminAnalytics> {
    const userId = requireAdminUserId();
    const res = await api.post<AdminAnalytics>("/analytics", {
      userId,
    });
    const d = res.data;
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
