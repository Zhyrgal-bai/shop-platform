import { useCartStore } from "../store/useCartStore";
import { api } from "../services/api";
import { getTelegramUser } from "../utils/telegram";
import "../components/ui/Cart.css";
import "../components/ui/Toast.css";
import { useState } from "react";

export default function CartPage() {
  const items = useCartStore((state) => state.items);
  const addItem = useCartStore((state) => state.addItem);
  const removeItem = useCartStore((state) => state.removeItem);
  const clearCart = useCartStore((state) => state.clearCart);

  // Toast state: { type: "success" | "error", message: string }
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Calculate total price (with quantity)
  const totalPrice = items.reduce((sum, item) => {
    return sum + item.price * (item.quantity ?? 1);
  }, 0);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 2500);
  };

  const handleOrder = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const user = getTelegramUser();
      const res = await api.post("/orders", {
        user: {
          telegramId: user?.id || 0,
          name: user?.first_name || "Unknown",
        },
        items,
        total: totalPrice,
      });
      console.log("ORDER CREATED:", res.data);

      clearCart();
      showToast("success", "Заказ оформлен");
    } catch (err) {
      console.error("ORDER ERROR:", err);
      showToast("error", "Ошибка при заказе");
    }
    setLoading(false);
  };

  const handleGoShop = () => {
    window.location.href = "/";
  };

  const handleIncrement = (item: (typeof items)[number]) => {
    removeItem(item);
    addItem({
      ...item,
      quantity: (item.quantity ?? 1) + 1,
    });
  };

  const handleDecrement = (item: (typeof items)[number]) => {
    const nextQuantity = (item.quantity ?? 1) - 1;
    removeItem(item);
    if (nextQuantity <= 0) return;
    addItem({
      ...item,
      quantity: nextQuantity,
    });
  };

  return (
    <div className="cart">
      <h1 className="cart-title">
        Корзина <span role="img" aria-label="cart">🛒</span>
      </h1>

      {items.length === 0 && (
        <div className="cart-empty">
          <div className="cart-empty-icon">🛒</div>
          <h2>КОРЗИНА ПУСТА</h2>
          <p>Добавьте товары, чтобы оформить заказ</p>
          <button className="go-shop" type="button" onClick={handleGoShop}>
            СМОТРЕТЬ ТОВАРЫ
          </button>
        </div>
      )}

      {items.length > 0 && (
        <>
          <div className="cart-list">
            {items.map((item, i) => (
              <div key={i} className="cart-item">
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="cart-item-image"
                  />
                ) : (
                  <div className="cart-item-image cart-item-image-placeholder" aria-hidden="true">
                    🛍️
                  </div>
                )}

                <div className="cart-info">
                  <h3 className="cart-item-name">{item.name}</h3>
                  <p className="cart-item-price">
                    {item.price} <span className="cart-item-currency">сом</span>
                  </p>

                  <div className="cart-actions">
                    <button
                      type="button"
                      onClick={() => handleDecrement(item)}
                      disabled={loading}
                      aria-label="Уменьшить"
                    >
                      -
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => handleIncrement(item)}
                      disabled={loading}
                      aria-label="Увеличить"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="cart-footer">
            <div className="total">
              <span>Итого:</span>
              <strong>{totalPrice} сом</strong>
            </div>
            <button
              onClick={handleOrder}
              className="checkout"
              disabled={loading}
            >
              {loading ? "ОТПРАВКА..." : "ОФОРМИТЬ ЗАКАЗ"}
            </button>
          </div>
        </>
      )}

      {toast && (
        <div className={`toast show${toast.type === "error" ? " toast-error" : ""}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}