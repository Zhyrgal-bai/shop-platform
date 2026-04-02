import { useCartStore } from "../store/useCartStore";
import { api } from "../services/api";
import { getTelegramUser } from "../utils/telegram";

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
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Корзина 🛒</h1>

      {items.length === 0 && <p>Корзина пустая</p>}

      {items.map((item, i) => (
        <div key={i} className="border p-2 mb-2 rounded">
          <p className="font-semibold">{item.name}</p>

          <p className="text-sm text-gray-500">
            {item.color} / {item.size}
          </p>

          <p>{item.price} сом</p>
        </div>
      ))}

      {items.length > 0 && (
        <>
          <h2 className="mt-4 font-bold">
            Итого: {getTotal()} сом
          </h2>

          <button
            onClick={handleOrder}
            className="bg-black text-white w-full py-2 mt-4 rounded"
          >
            Оформить заказ
          </button>
        </>
      )}
    </div>
  );
}