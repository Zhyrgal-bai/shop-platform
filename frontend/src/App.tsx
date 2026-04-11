import HomePage from "./pages/HomePage";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import AdminPage from "./pages/AdminPage";
import FAQPage from "./pages/FAQPage";
import { useState, useMemo } from "react";
import { useCartStore } from "./store/useCartStore";
import "./App.css";
import "./components/ui/Admin.css";
import Header from "./components/layout/Header";
import SideMenu from "./components/layout/SideMenu";
import FloatingCart from "./components/layout/FloatingCart";
import { isAdmin } from "./utils/adminAccess";
import { getTelegramWebAppUserId } from "./utils/telegram";

export default function App() {
  const [page, setPage] = useState<
    "home" | "cart" | "checkout" | "admin" | "faq"
  >("home");
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const hasAdminAccess = useMemo(() => {
    if (typeof window === "undefined") return false;
    const userId = getTelegramWebAppUserId();
    return isAdmin(userId);
  }, []);

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
        isAdmin={hasAdminAccess}
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
        {page === "admin" && hasAdminAccess && <AdminPage />}
        {page === "admin" && !hasAdminAccess && (
          <div className="admin-page">
            <div className="no-access">Нет прав</div>
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
