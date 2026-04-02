import { useState } from "react";
import HomePage from "./pages/HomePage";
import CartPage from "./pages/CartPage";
import AdminPage from "./pages/AdminPage";

export default function App() {
  const [page, setPage] = useState<"home" | "cart" | "admin">("home");

  return (
    <div className="min-h-screen bg-gray-100">
      
      <div className="flex gap-3 p-4 bg-white shadow">
        <button
          onClick={() => setPage("home")}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Главная
        </button>

        <button
          onClick={() => setPage("cart")}
          className="px-4 py-2 bg-green-500 text-white rounded"
        >
          Корзина
        </button>

        <button
          onClick={() => setPage("admin")}
          className="px-4 py-2 bg-red-500 text-white rounded"
        >
          Админ
        </button>
      </div>

      <div className="p-4">
        {page === "home" && <HomePage />}
        {page === "cart" && <CartPage />}
        {page === "admin" && <AdminPage />}
      </div>
    </div>
  );
}