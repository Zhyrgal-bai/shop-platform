import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import type { Product } from "../types";
import ProductGrid from "../components/product/ProductGrid";
import Toast from "../components/ui/Toast";
import "../components/ui/HomePage.css";

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [toast, setToast] = useState("");
  const [isToastVisible, setIsToastVisible] = useState(false);
  const [activeCategory, setActiveCategory] = useState("ВСЕ");
  const [searchQuery, setSearchQuery] = useState("");

  const showToast = (message: string) => {
    setToast(message);
    setIsToastVisible(true);
    setTimeout(() => {
      setIsToastVisible(false);
      setToast("");
    }, 2000);
  };

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

  const categories = useMemo(() => {
    const uniqueCategories = Array.from(
      new Set(
        products
          .map((p) => p.category)
          .filter((category): category is string => Boolean(category))
      )
    );
    return ["ВСЕ", ...uniqueCategories];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return products.filter((p) => {
      const categoryMatch =
        activeCategory === "ВСЕ" || p.category === activeCategory;
      const searchMatch = p.name.toLowerCase().includes(normalizedQuery);
      return categoryMatch && searchMatch;
    });
  }, [activeCategory, products, searchQuery]);

  return (
    <div className="home-page">
      {/* Premium minimal hero section */}
      <section className="hero">
        <h1 className="hero-title">BARŚ</h1>
        <p className="hero-subtitle">одежда</p>
      </section>
      <div className="hero-bottom-spacer" />
      <input
        type="text"
        placeholder="Поиск одежды..."
        className="search-input"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      <div className="categories">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            className={activeCategory === cat ? "active" : ""}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>
      <ProductGrid products={filteredProducts} showToast={showToast} />
      <Toast message={toast} visible={isToastVisible} />
    </div>
  );
}