import { useCartStore } from "../store/useCartStore";
import { api } from "../services/api";
import { getTelegramUser } from "../utils/telegram";
import "../components/ui/Cart.css";

export default function CartPage() {
  const items = useCartStore((state) => state.items);
  const clearCart = useCartStore((state) => state.clearCart);
  const getTotal = useCartStore((state) => state.getTotal);

  const handleOrder = async () => {
    try {
      const total = getTotal();
      const user = getTelegramUser();

      const res = await api.post("/orders", {
        user: {
          telegramId: user?.id || 0,
          name: user?.first_name || "Unknown",
        },
        items,
        total,
      });

      console.log("ORDER CREATED:", res.data);

      clearCart();
      alert("Заказ оформлен ✅");
    } catch (err) {
      console.error("ORDER ERROR:", err);
      alert("Ошибка при заказе ❌");
    }
  };

  return (
    <div className="cart">
      <h1 className="cart-title">Корзина 🛒</h1>

      {items.length === 0 && <p className="empty">Корзина пустая</p>}

      {items.map((item, i) => (
        <div key={i} className="cart-item">
          <div>
            <p className="name">{item.name}</p>
            <p className="meta">
              {item.color} / {item.size}
            </p>
            <p className="price">{item.price} сом</p>
          </div>
        </div>
      ))}

      {items.length > 0 && (
        <>
          <h2 className="total">
            Итого: {getTotal()} сом
          </h2>

          <button onClick={handleOrder} className="order-btn">
            Оформить заказ
          </button>
        </>
      )}
    </div>
  );
}