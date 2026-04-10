import HomePage from "./pages/HomePage";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import AdminPage from "./pages/AdminPage";
import FAQPage from "./pages/FAQPage";
import { useState, useEffect } from "react";
import { useCartStore } from "./store/useCartStore";
import "./App.css";
import "./components/ui/Admin.css";
import Header from "./components/layout/Header";
import SideMenu from "./components/layout/SideMenu";
import FloatingCart from "./components/layout/FloatingCart";
import { getTelegramWebAppUserId } from "./utils/telegram";

export default function App() {
  const [page, setPage] = useState<
    "home" | "cart" | "checkout" | "admin" | "faq"
  >("home");
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const userId = getTelegramWebAppUserId();
  const ADMIN_ID = Number(import.meta.env.VITE_ADMIN_ID);
  const isAdmin = userId === ADMIN_ID;

  useEffect(() => {
    console.log(userId, ADMIN_ID);
  }, [userId, ADMIN_ID]);

  const items = useCartStore((state) => state.items);
  const totalQuantity = items.reduce((sum, item) => sum + (item.quantity ?? 1), 0);

  const handleMenuToggle = () => setIsMenuOpen((prev) => !prev);
  const handleMenuClose = () => setIsMenuOpen(false);

  const handleNav = (
    target: "home" | "cart" | "checkout" | "admin" | "faq"
  ) => {
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
        isAdmin={isAdmin}
      />

      <div className="content">
        {page === "home" && <HomePage />}
        {page === "faq" && <FAQPage />}
        {page === "cart" && (
          <CartPage onGoToCheckout={() => setPage("checkout")} />
        )}
        {page === "checkout" && (
          <CheckoutPage
            onBack={() => setPage("cart")}
            onOrderSuccess={() => setPage("home")}
          />
        )}
        {page === "admin" && isAdmin && <AdminPage />}
        {page === "admin" && !isAdmin && (
          <div className="admin-page">
            <div className="no-access">Нет доступа</div>
          </div>
        )}
      </div>

      <FloatingCart
        visible={page !== "checkout"}
        totalQuantity={totalQuantity}
        onOpen={handleFloatingCartClick}
      />
    </div>
  );
}
