import HomePage from "./pages/HomePage";
import CartPage from "./pages/CartPage";
import AdminPage from "./pages/AdminPage";
import { useState } from "react";
import { useCartStore } from "./store/useCartStore";
import "./App.css";
import Header from "./components/layout/Header";
import SideMenu from "./components/layout/SideMenu";

export default function App() {
  const [page, setPage] = useState<"home" | "cart" | "admin">("home");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const items = useCartStore((state) => state.items);
  const totalQuantity = items.reduce((sum, item) => sum + (item.quantity ?? 1), 0);

  const handleMenuToggle = () => setIsMenuOpen((prev) => !prev);
  const handleMenuClose = () => setIsMenuOpen(false);

  const handleNav = (target: "home" | "cart" | "admin") => {
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
      />

      <div className="content">
        {page === "home" && <HomePage />}
        {page === "cart" && <CartPage />}
        {page === "admin" && <AdminPage />}
      </div>

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
    </div>
  );
}