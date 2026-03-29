import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { Product } from "../types";
import ProductGrid from "../components/product/ProductGrid";

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const fetchProducts = async () => {
      const res = await api.get("/products");
      setProducts(res.data);
    };

    fetchProducts();
  }, []);

  return (
    <div className="p-4">
      <h1>Bars 👕</h1>

      <ProductGrid products={products} />
    </div>
  );
}