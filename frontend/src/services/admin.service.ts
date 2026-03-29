import { api } from "./api";
import type { Product } from "../types/admin.types";

export const adminService = {
  getProducts: async (): Promise<Product[]> => {
    const res = await api.get("/products");
    return res.data;
  },

  createProduct: async (data: Product) => {
    const res = await api.post("/products", data);
    return res.data;
  },

  deleteProduct: async (id: number) => {
    await api.delete(`/products/${id}`);
  },
};