import HomePage from "./pages/HomePage";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import AdminApp from "./pages/admin/AdminApp";
import FAQPage from "./pages/FAQPage";
import MyOrders from "./pages/MyOrders";
import { useState } from "react";
import { useCartStore } from "./store/useCartStore";
import { isAdminPanelVisible } from "@/utils/admin";
import "./App.css";
import "./components/ui/Admin.css";
import Header from "./components/layout/Header";
import SideMenu from "./components/layout/SideMenu";
import FloatingCart from "./components/layout/FloatingCart";
export default function App() {
  const [page, setPage] = useState<
    "home" | "cart" | "checkout" | "admin" | "faq" | "my-orders"
  >("home");
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const items = useCartStore((state) => state.items);
  const totalQuantity = items.reduce((sum, item) => sum + (item.quantity ?? 1), 0);

  const handleMenuToggle = () => setIsMenuOpen((prev) => !prev);
  const handleMenuClose = () => setIsMenuOpen(false);

  const handleNav = (
    target: "home" | "cart" | "checkout" | "admin" | "faq" | "my-orders"
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

  const goAdminSection = (
    section: "orders" | "products" | "analytics" | "settings"
  ) => {
    const paths: Record<typeof section, string> = {
      orders: "#/admin/orders",
      products: "#/admin/products",
      analytics: "#/admin/analytics",
      settings: "#/admin/settings",
    };
    window.location.hash = paths[section];
    setPage("admin");
    setIsMenuOpen(false);
  };

  return (
    <div className="app">
      <Header menuOpen={isMenuOpen} onMenuToggle={handleMenuToggle} />

      <SideMenu
        open={isMenuOpen}
        onClose={handleMenuClose}
        currentPage={page}
        onNavToHome={() => handleNav("home")}
        onNavToMyOrders={() => handleNav("my-orders")}
        onNavToAdmin={goAdminSection}
      />

      <div className="content app__content">
        {page === "home" && <HomePage />}
        {page === "faq" && <FAQPage />}
        {page === "my-orders" && <MyOrders />}
        {page === "cart" && (
          <CartPage onGoToCheckout={() => setPage("checkout")} />
        )}
        {page === "checkout" && (
          <CheckoutPage
            onBack={() => setPage("cart")}
            onOrderSuccess={() => setPage("home")}
          />
        )}
        {page === "admin" &&
          (isAdminPanelVisible() ? (
            <AdminApp onExit={() => setPage("home")} />
          ) : (
            <div className="admin-page">
              <div className="no-access">Нет прав</div>
            </div>
          ))}
      </div>

      <FloatingCart
        visible={page !== "checkout"}
        totalQuantity={totalQuantity}
        onOpen={handleFloatingCartClick}
      />
    </div>
  );
}
