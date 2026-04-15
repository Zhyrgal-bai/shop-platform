import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import { fetchMyOrders } from "../services/myOrdersApi";
import type { Product } from "../types";
import ProductGrid from "../components/product/ProductGrid";
import ProductDetailModal from "../components/product/ProductDetailModal";
import Toast from "../components/ui/Toast";
import { getWebAppUserId } from "../utils/telegramUserId";
import "../components/ui/HomePage.css";

const FIRST_ORDER_PROMO = "BARS10";

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [toast, setToast] = useState("");
  const [isToastVisible, setIsToastVisible] = useState(false);
  const [activeCategory, setActiveCategory] = useState("ВСЕ");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFirstOrderBanner, setShowFirstOrderBanner] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

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

  useEffect(() => {
    const uid = getWebAppUserId();
    if (!Number.isFinite(uid) || uid <= 0) {
      setShowFirstOrderBanner(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchMyOrders(uid);
        if (!cancelled) {
          setShowFirstOrderBanner(rows.length === 0);
        }
      } catch {
        if (!cancelled) {
          setShowFirstOrderBanner(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const copyPromoCode = async () => {
    try {
      await navigator.clipboard.writeText(FIRST_ORDER_PROMO);
      showToast("Промокод скопирован");
    } catch {
      showToast(`Промокод: ${FIRST_ORDER_PROMO}`);
    }
  };

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
      {showFirstOrderBanner && (
        <div className="home-discount-banner">
          <div className="home-discount-banner__text">
            <span className="home-discount-banner__title">
              🎁 -10% на первый заказ
            </span>
            <span className="home-discount-banner__promo">
              Промокод: <strong>{FIRST_ORDER_PROMO}</strong>
            </span>
          </div>
          <button
            type="button"
            className="home-discount-banner__copy"
            onClick={() => void copyPromoCode()}
          >
            Копировать
          </button>
        </div>
      )}
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
      <ProductGrid
        products={filteredProducts}
        showToast={showToast}
        onProductSelect={setSelectedProduct}
      />
      <ProductDetailModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />
      <Toast message={toast} visible={isToastVisible} />
    </div>
  );
}