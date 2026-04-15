import { useCallback, useEffect, useState } from "react";
import { fetchMyOrders } from "../services/myOrdersApi";
import { getWebAppUserId } from "../utils/telegramUserId";
import { mbankOrderQrImageUrl } from "../utils/mbankQrUrl";
import type { MyOrderRow } from "../types/myOrder";
import "./MyOrders.css";

export type { MyOrderRow };

function statusWithIcon(status: string): string {
  const u = status.toUpperCase();
  const map: Record<string, string> = {
    NEW: "🆕 Новый",
    ACCEPTED: "✅ Принят",
    PAID_PENDING: "💰 Ожидает оплату",
    CONFIRMED: "📦 Готовится",
    SHIPPED: "🚚 В пути",
    CANCELLED: "❌ Отменён",
  };
  return map[u] ?? status;
}

function orderStatusProgress(status: string): number {
  const u = status.toUpperCase();
  const map: Record<string, number> = {
    NEW: 10,
    ACCEPTED: 30,
    PAID_PENDING: 50,
    CONFIRMED: 70,
    SHIPPED: 100,
  };
  return map[u] ?? 0;
}

function formatOrderDate(iso: string | undefined): string | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function awaitingPayment(status: string): boolean {
  const u = status.toUpperCase();
  return u === "ACCEPTED" || u === "PAID_PENDING";
}

export default function MyOrders() {
  const [orders, setOrders] = useState<MyOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userId = getWebAppUserId();

  const load = useCallback(async () => {
    if (!Number.isFinite(userId) || userId <= 0) {
      setOrders([]);
      setError("Откройте раздел в Telegram");
      setLoading(false);
      return;
    }
    try {
      const data = await fetchMyOrders(userId);
      setOrders(data);
      setError(null);
    } catch (e) {
      console.error(e);
      setError("Не удалось загрузить заказы");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    const interval = setInterval(() => {
      void load();
    }, 5000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <div className="my-orders">
      <header className="my-orders__head">
        <h1 className="my-orders__title">Мои заказы</h1>
        <p className="my-orders__subtitle">Автообновление каждые 5 с</p>
      </header>

      {loading && <p className="my-orders__muted">Загрузка…</p>}
      {error && (
        <p className="my-orders__error" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && orders.length === 0 && (
        <p className="my-orders__muted">Пока нет заказов</p>
      )}

      <div className="my-orders__list">
        {orders.map((order) => {
          const pct = orderStatusProgress(order.status);
          const dateLabel = formatOrderDate(order.createdAt);
          return (
            <article key={order.id} className="my-orders__card">
              <div className="my-orders__card-head">
                <h3 className="my-orders__card-title">Заказ #{order.id}</h3>
                {dateLabel ? (
                  <time className="my-orders__date" dateTime={order.createdAt}>
                    {dateLabel}
                  </time>
                ) : null}
              </div>

              <p className="my-orders__status-line">{statusWithIcon(order.status)}</p>

              <div
                className="my-orders__progress-wrap"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
                aria-label="Прогресс заказа"
              >
                <div className="my-orders__progress-track">
                  <div
                    className="my-orders__progress-fill"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              <p className="my-orders__total-line">
                <span className="my-orders__label">Сумма</span>
                <span className="my-orders__total-value">{order.total} сом</span>
              </p>

              {order.tracking != null && order.tracking.trim() !== "" && (
                <p className="my-orders__tracking">📍 {order.tracking}</p>
              )}
              {awaitingPayment(order.status) && (
                <div className="my-orders__pay-qr">
                  <p className="my-orders__pay-qr-title">Оплата MBank</p>
                  <img
                    className="my-orders__pay-qr-img"
                    src={mbankOrderQrImageUrl(order.total)}
                    alt={`QR оплаты ${order.total} сом`}
                    width={200}
                    height={200}
                  />
                  <p className="my-orders__pay-qr-hint">Сканируйте QR</p>
                </div>
              )}
              {order.items != null && order.items.length > 0 && (
                <ul className="my-orders__items">
                  {order.items.map((it) => (
                    <li key={it.id}>
                      {it.name} · {it.color} / {it.size} × {it.quantity}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
