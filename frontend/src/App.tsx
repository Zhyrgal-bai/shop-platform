import HomePage from "./pages/HomePage";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import AdminPage from "./pages/AdminPage";
import { useState, useEffect } from "react";
import { useCartStore } from "./store/useCartStore";
import { checkIsAdmin } from "./utils/isAdmin";
import "./App.css";
import "./components/ui/Admin.css";
import Header from "./components/layout/Header";
import SideMenu from "./components/layout/SideMenu";

export default function App() {
  const [page, setPage] = useState<
    "home" | "cart" | "checkout" | "admin"
  >("home");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserAdmin, setIsUserAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    checkIsAdmin().then((ok) => {
      if (!cancelled) setIsUserAdmin(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const items = useCartStore((state) => state.items);
  const totalQuantity = items.reduce((sum, item) => sum + (item.quantity ?? 1), 0);

  const handleMenuToggle = () => setIsMenuOpen((prev) => !prev);
  const handleMenuClose = () => setIsMenuOpen(false);

  const handleNav = (target: "home" | "cart" | "checkout" | "admin") => {
    setPage(target);
    setIsMenuOpen(false);
  };

  const handleFloatingCartClick = () => {
    if (page !== "cart") {
      setPage("cart");
    }
    setIsMenuOpen(false);
  };

  return (
    <div className="app">
      <Header onMenuToggle={handleMenuToggle} />

      <SideMenu
        open={isMenuOpen}
        onClose={handleMenuClose}
        onNav={handleNav}
        showAdminLink={isUserAdmin === true}
      />

      <div className="content">
        {page === "home" && <HomePage />}
        {page === "cart" && (
          <CartPage onGoToCheckout={() => setPage("checkout")} />
        )}
        {page === "checkout" && (
          <CheckoutPage
            onBack={() => setPage("cart")}
            onOrderSuccess={() => setPage("home")}
          />
        )}
        {page === "admin" && isUserAdmin === true && <AdminPage />}
        {page === "admin" && isUserAdmin === false && (
          <div className="admin-page">
            <div className="no-access">Нет доступа</div>
          </div>
        )}
        {page === "admin" && isUserAdmin === null && (
          <div className="admin-page">
            <p className="admin-loading">Проверка доступа…</p>
          </div>
        )}
      </div>

      {page !== "checkout" && (
      <button
        className="floating-cart"
        onClick={handleFloatingCartClick}
        aria-label="Открыть корзину"
      >
        <div className="cart-icon">
          🛒
          {totalQuantity > 0 && (
            <span className="cart-badge">{totalQuantity}</span>
          )}
        </div>
      </button>
      )}
    </div>
  );
}