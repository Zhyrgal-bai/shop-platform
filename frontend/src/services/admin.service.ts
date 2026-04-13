import { api } from "./api";
import type { Product } from "../types";
import { getWebAppUserId } from "../utils/adminAccess";

function requireAdminUserId(): number {
  const userId = getWebAppUserId();
  if (!Number.isFinite(userId) || userId <= 0) {
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

async function adminGet<T>(path: string): Promise<T> {
  const userId = requireAdminUserId();
  const base = viteApiBase().replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${base}${p}`);
  url.searchParams.set("userId", String(userId));
  const res = await fetch(url.toString(), { method: "GET" });
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
  pending?: number;
  shipped?: number;
  byStatus?: Record<string, number>;
};

async function fetchAdminOrders(): Promise<AdminOrderListItem[]> {
  const data = await adminGet<AdminOrderListItem[]>("/orders");
  return Array.isArray(data) ? data : [];
}

export const adminService = {
  async getProducts(): Promise<Product[]> {
    const res = await api.get<Product[]>("/products");
    return res.data;
  },

  async getProduct(id: number): Promise<Product> {
    const res = await api.get<Product>(`/products/${id}`);
    return res.data;
  },

  async createProduct(data: Product): Promise<Product> {
    const userId = requireAdminUserId();
    try {
      const images =
        data.images && data.images.length > 0
          ? data.images
          : data.image
            ? [data.image]
            : [];
      const res = await api.post<Product>("/products", {
        ...data,
        userId,
        images,
        image: images[0] ?? data.image,
      });
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
    patch: Partial<
      Pick<
        Product,
        | "name"
        | "price"
        | "image"
        | "images"
        | "description"
        | "category"
        | "discountPercent"
        | "variants"
      >
    >
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

  async savePaymentSettings(data: {
    mbank?: string;
    optima?: string;
    obank?: string;
    card?: string;
    qr?: string;
  }): Promise<unknown> {
    return adminPost("/payment", data as Record<string, unknown>);
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
      limit: maxUses,
    });
  },

  async deletePromo(code: string): Promise<void> {
    await adminDelete(`/promo/${encodeURIComponent(code)}`);
  },

  /** Список заказов из PostgreSQL (polling и после действий). */
  fetchOrders: fetchAdminOrders,

  listOrders: fetchAdminOrders,

  listAllOrders: fetchAdminOrders,

  async uploadImage(file: File): Promise<string> {
    const userId = requireAdminUserId();
    const form = new FormData();
    form.append("userId", String(userId));
    form.append("file", file);
    const url = `${viteApiBase()}/upload`;
    const res = await fetch(url, { method: "POST", body: form });
    if (!res.ok) throw new Error(await readFetchError(res));
    const j = (await res.json()) as { url?: string };
    if (!j.url) throw new Error("Нет url в ответе");
    return j.url;
  },

  async uploadImages(files: File[]): Promise<string[]> {
    if (files.length === 0) return [];
    const userId = requireAdminUserId();
    const form = new FormData();
    form.append("userId", String(userId));
    for (const f of files) {
      form.append("files", f);
    }
    const url = `${viteApiBase()}/products/upload-images`;
    const res = await fetch(url, { method: "POST", body: form });
    if (!res.ok) throw new Error(await readFetchError(res));
    const j = (await res.json()) as { urls?: string[] };
    return Array.isArray(j.urls) ? j.urls : [];
  },

  async updateOrderStatus(
    id: number,
    status: "ACCEPTED" | "CONFIRMED" | "SHIPPED"
  ): Promise<void> {
    const userId = requireAdminUserId();
    const url = `${viteApiBase()}/orders/${id}`;
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, userId }),
    });
    if (!res.ok) throw new Error(await readFetchError(res));
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
    const byStatus =
      d.byStatus != null &&
      typeof d.byStatus === "object" &&
      !Array.isArray(d.byStatus)
        ? d.byStatus
        : {};
    return {
      ...d,
      pending: typeof d.pending === "number" ? d.pending : 0,
      shipped: typeof d.shipped === "number" ? d.shipped : d.done,
      byStatus,
    };
  },
};
