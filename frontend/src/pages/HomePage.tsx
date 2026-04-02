import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { Product } from "../types";
import ProductGrid from "../components/product/ProductGrid"; // 👈 ВАЖНО

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await api.get("/products");
        setProducts(res.data || []);
      } catch (e) {
        console.log(e);
        setProducts([]);
      }
    };

    fetchProducts();
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>Bars 👕</h1>

      <ProductGrid products={products} />
    </div>
  );
}