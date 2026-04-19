import HomePage from "./pages/HomePage";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import AdminApp from "./pages/admin/AdminApp";
import FAQ from "./pages/FAQ";
import MyOrders from "./pages/MyOrders";
import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useCartStore } from "./store/useCartStore";
import { useAdminPanelVisible, useAdminAccessBootstrap } from "@/utils/admin";
import "./App.css";
import "./components/ui/Admin.css";
import Header from "./components/layout/Header";
import SideMenu from "./components/layout/SideMenu";
import FloatingCart from "./components/layout/FloatingCart";

type AppNavPage = "home" | "cart" | "checkout" | "admin" | "faq" | "my-orders";

function initialPageFromPath(): AppNavPage {
  if (typeof window === "undefined") return "home";
  return window.location.pathname === "/faq" ? "faq" : "home";
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [page, setPage] = useState<AppNavPage>(initialPageFromPath);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const adminAllowed = useAdminPanelVisible();
  useAdminAccessBootstrap();

  const items = useCartStore((state) => state.items);
  const totalQuantity = items.reduce((sum, item) => sum + (item.quantity ?? 1), 0);

  const commitPage = useCallback(
    (next: AppNavPage) => {
      if (next === "faq") {
        navigate("/faq");
        setPage("faq");
        return;
      }
      setPage(next);
      if (location.pathname === "/faq") {
        navigate("/", { replace: true });
      }
    },
    [navigate, location.pathname]
  );

  useEffect(() => {
    if (location.pathname === "/faq") {
      setPage("faq");
    }
  }, [location.pathname]);

  useEffect(() => {
    const onPop = () => {
      queueMicrotask(() => {
        if (window.location.pathname !== "/faq") {
          setPage((p) => (p === "faq" ? "home" : p));
        }
      });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const handleMenuToggle = () => setIsMenuOpen((prev) => !prev);
  const handleMenuClose = () => setIsMenuOpen(false);

  const handleNav = (target: AppNavPage) => {
    commitPage(target);
    setIsMenuOpen(false);
  };

  const handleFloatingCartClick = () => {
    if (page !== "cart") {
      commitPage("cart");
    }
    setIsMenuOpen(false);
  };

  const goAdminSection = (
    section: "orders" | "products" | "categories" | "analytics" | "settings"
  ) => {
    setPage("admin");
    if (location.pathname === "/faq") {
      navigate("/", { replace: true });
    }
    const paths: Record<typeof section, string> = {
      orders: "#/admin/orders",
      products: "#/admin/products",
      categories: "#/admin/categories",
      analytics: "#/admin/analytics",
      settings: "#/admin/settings",
    };
    window.location.hash = paths[section];
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
        onNavToCart={() => handleNav("cart")}
        cartCount={totalQuantity}
        onNavToMyOrders={() => handleNav("my-orders")}
        onNavToFaq={() => handleNav("faq")}
        onNavToAdmin={goAdminSection}
      />

      <div className="content app__content">
        {page === "home" && <HomePage />}
        {page === "faq" && <FAQ />}
        {page === "my-orders" && <MyOrders />}
        {page === "cart" && (
          <CartPage onGoToCheckout={() => commitPage("checkout")} />
        )}
        {page === "checkout" && (
          <CheckoutPage
            onBack={() => commitPage("cart")}
            onOrderSuccess={() => commitPage("home")}
          />
        )}
        {page === "admin" &&
          (adminAllowed ? (
            <AdminApp
              onExit={() => {
                window.location.hash = "";
                commitPage("home");
              }}
            />
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
