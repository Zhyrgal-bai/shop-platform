import { useState } from "react";
import axios from "axios";
import { useCartStore } from "../store/useCartStore";
import { api, API_BASE_URL } from "../services/api";
import { getTelegramUser } from "../utils/telegram";
import "../components/ui/CheckoutPage.css";

type Props = {
  onBack?: () => void;
  /** После успешного заказа (корзина уже очищена). */
  onOrderSuccess?: () => void;
};

function orderErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string } | undefined;
    if (data?.error) return data.error;
  }
  return "Не удалось оформить заказ. Попробуйте позже.";
}

export default function CheckoutPage({ onBack, onOrderSuccess }: Props) {
  const items = useCartStore((state) => state.items);
  const clearCart = useCartStore((state) => state.clearCart);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [deliveryType, setDeliveryType] = useState("delivery");
  const [promo, setPromo] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const totalPrice = items.reduce(
    (sum, item) => sum + item.price * (item.quantity ?? 1),
    0
  );

  const handleSubmit = async () => {
    if (items.length === 0) return;
    if (!name.trim() || !phone.trim()) {
      alert("Укажите имя и телефон");
      return;
    }

    const tg = getTelegramUser();

    const orderData = {
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim(),
      items: items.map((i) => ({
        name: i.name,
        size: i.size,
        quantity: i.quantity,
      })),
      total: totalPrice,
    };

    setSubmitting(true);
    try {
      await api.post("/orders", {
        user: {
          telegramId: tg?.id ?? 0,
          name: orderData.name || tg?.first_name || "Гость",
        },
        items: items.map((i) => ({
          productId: i.productId,
          name: i.name,
          size: i.size,
          color: i.color,
          quantity: i.quantity,
          price: i.price,
        })),
        total: totalPrice,
        deliveryType,
        address: orderData.address,
        promo: promo.trim(),
        comment: comment.trim(),
      });

      const sendUrl = `${API_BASE_URL.replace(/\/$/, "")}/send-order`;
      const res = await fetch(sendUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orderData),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!res.ok) {
        alert(
          payload.error ??
            "Заказ сохранён, но уведомление в Telegram не отправилось."
        );
      } else {
        alert("Заказ отправлен");
      }

      clearCart();
      setName("");
      setPhone("");
      setAddress("");
      setPromo("");
      setComment("");
      onOrderSuccess?.();
    } catch (err) {
      console.error(err);
      alert(orderErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="checkout checkout--empty">
        <button type="button" className="checkout-back" onClick={onBack}>
          ← Корзина
        </button>
        <h2>Оформление заказа</h2>
        <p className="checkout-empty-text">Корзина пуста</p>
        {onBack && (
          <button type="button" className="order-btn" onClick={onBack}>
            Вернуться в корзину
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="checkout">
      {onBack && (
        <button type="button" className="checkout-back" onClick={onBack}>
          ← Корзина
        </button>
      )}

      <h2>Оформление заказа</h2>

      <div className="form">
        <input
          placeholder="Ваше имя"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          placeholder="+996 XXX XXX XXX"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
        />
        <input
          placeholder="Адрес доставки"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />

        <select
          value={deliveryType}
          onChange={(e) => setDeliveryType(e.target.value)}
        >
          <option value="delivery">Доставка</option>
          <option value="pickup">Самовывоз</option>
        </select>

        <input
          placeholder="Промокод"
          value={promo}
          onChange={(e) => setPromo(e.target.value)}
        />
        <textarea
          placeholder="Комментарий"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
        />
      </div>

      <div className="checkout-footer">
        <div className="total">
          <span>Итого</span>
          <strong>{totalPrice} сом</strong>
        </div>

        <button
          type="button"
          className="order-btn"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? "Отправка…" : "ОФОРМИТЬ ЗАКАЗ"}
        </button>
      </div>
    </div>
  );
}
