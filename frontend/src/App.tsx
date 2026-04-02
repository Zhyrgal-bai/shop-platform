import { useState } from "react";
import HomePage from "./pages/HomePage";
import CartPage from "./pages/CartPage";
import AdminPage from "./pages/AdminPage";

export default function App() {
  const [page, setPage] = useState<"home" | "cart" | "admin">("home");

  return (
    <div>
      <div className="header">
        <h1>Bars 👕</h1>

        <div className="nav">
          <button onClick={() => setPage("home")}>Главная</button>
          <button onClick={() => setPage("cart")}>Корзина</button>
          <button onClick={() => setPage("admin")}>Админ</button>
        </div>
      </div>

      {page === "home" && <HomePage />}
      {page === "cart" && <CartPage />}
      {page === "admin" && <AdminPage />}
    </div>
  );
}