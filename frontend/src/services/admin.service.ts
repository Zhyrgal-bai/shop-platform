import { api } from "./api";
import type { Product } from "../types";
import { getTelegramUser } from "../utils/telegram";

function requireTelegramUserId(): number {
  const id = getTelegramUser()?.id;
  if (id == null) {
    throw new Error("Откройте приложение в Telegram");
  }
  return id;
}

export const adminService = {
  async getProducts(): Promise<Product[]> {
    const res = await api.get<Product[]>("/products");
    return res.data;
  },

  async createProduct(data: Product): Promise<Product> {
    const userId = requireTelegramUserId();
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
    const userId = requireTelegramUserId();
    await api.delete(`/products/${id}`, { data: { userId } });
  },

  async updateProduct(
    id: number,
    patch: Partial<Pick<Product, "name" | "price" | "image" | "description">>
  ): Promise<Product> {
    const userId = requireTelegramUserId();
    const res = await api.put<Product>(`/products/${id}`, {
      ...patch,
      userId,
    });
    return res.data;
  },
};
