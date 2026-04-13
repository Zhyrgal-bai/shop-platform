import { useCallback, useEffect, useMemo, useState } from "react";
import {
  adminService,
  type AdminOrderListItem,
} from "../../services/admin.service";

const FILTER_TABS = [
  "ALL",
  "NEW",
  "ACCEPTED",
  "PAID_PENDING",
  "CONFIRMED",
  "SHIPPED",
] as const;

type FilterTab = (typeof FILTER_TABS)[number];

function canonicalStatus(raw: string): string {
  const t = raw.trim();
  const u = t.toUpperCase();
  if (u === "NEW" || t.toLowerCase() === "new") return "NEW";
  return u;
}

function statusClass(status: string): string {
  return canonicalStatus(status).toLowerCase().replace(/\s+/g, "-");
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrderListItem[]>([]);
  const [filter, setFilter] = useState<FilterTab>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminService.listAllOrders();
      setOrders(data);
      setError(null);
    } catch (e) {
      console.error(e);
      setError("Не удалось загрузить заказы");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === "ALL") return orders;
    return orders.filter((o) => canonicalStatus(o.status) === filter);
  }, [orders, filter]);

  async function applyStatus(
    id: number,
    status: "ACCEPTED" | "CONFIRMED" | "SHIPPED"
  ) {
    setBusyId(id);
    try {
      await adminService.updateOrderStatus(id, status);
      await load();
    } catch (e) {
      console.error(e);
      alert(
        e instanceof Error
          ? e.message
          : "Не удалось обновить статус"
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="admin-dash-page">
      <header className="admin-dash-page__head">
        <h1 className="admin-dash-page__title">Заказы</h1>
        <p className="admin-dash-page__subtitle">
          Статусы сохраняются в базе; дубли по одному id скрыты. Кнопки Telegram
          работают для того же номера заказа.
        </p>
      </header>

      {error && (
        <div className="admin-form-error admin-dash-page__alert" role="alert">
          {error}
        </div>
      )}

      <div className="admin-filter-tabs" role="tablist" aria-label="Фильтр по статусу">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={filter === tab}
            className={`admin-filter-tabs__btn${filter === tab ? " admin-filter-tabs__btn--active" : ""}`}
            onClick={() => setFilter(tab)}
          >
            {tab === "ALL" ? "Все" : tab.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {loading && <p className="admin-dash-page__muted">Загрузка…</p>}

      {!loading && !error && filtered.length === 0 && (
        <p className="admin-dash-page__muted">Нет заказов для выбранного фильтра</p>
      )}

      {!loading && filtered.length > 0 && (
        <div className="admin-order-grid">
          {filtered.map((order) => {
            const canon = canonicalStatus(order.status);
            const busy = busyId === order.id;
            return (
              <article key={`${order.source ?? "?"}-${order.id}`} className="admin-order-card">
                <div className="admin-order-card__top">
                  <h2 className="admin-order-card__id">#{order.id}</h2>
                  <span
                    className={`admin-order-card__badge admin-order-card__badge--${order.source === "memory" ? "mem" : "db"}`}
                  >
                    {order.source === "memory" ? "Mini-app" : "БД"}
                  </span>
                </div>
                <dl className="admin-order-card__dl">
                  <div>
                    <dt>Имя</dt>
                    <dd>{order.name}</dd>
                  </div>
                  <div>
                    <dt>Телефон</dt>
                    <dd>{order.phone}</dd>
                  </div>
                  <div>
                    <dt>Сумма</dt>
                    <dd>{order.total} сом</dd>
                  </div>
                  <div>
                    <dt>Статус</dt>
                    <dd>
                      <span className={`status ${statusClass(order.status)}`}>
                        {order.statusText}
                      </span>
                      <span className="admin-order-card__code">{canon}</span>
                    </dd>
                  </div>
                </dl>
                <div className="admin-order-card__actions">
                  <button
                    type="button"
                    className="admin-order-card__btn admin-order-card__btn--accept"
                    disabled={busy || canon !== "NEW"}
                    title={canon !== "NEW" ? "Только для статуса NEW" : undefined}
                    onClick={() => void applyStatus(order.id, "ACCEPTED")}
                  >
                    Принять
                  </button>
                  <button
                    type="button"
                    className="admin-order-card__btn admin-order-card__btn--confirm"
                    disabled={busy || canon !== "PAID_PENDING"}
                    title={
                      canon !== "PAID_PENDING"
                        ? "После «Я оплатил» у клиента"
                        : undefined
                    }
                    onClick={() => void applyStatus(order.id, "CONFIRMED")}
                  >
                    Подтвердить оплату
                  </button>
                  <button
                    type="button"
                    className="admin-order-card__btn admin-order-card__btn--ship"
                    disabled={busy || canon !== "CONFIRMED"}
                    title={canon !== "CONFIRMED" ? "После подтверждения оплаты" : undefined}
                    onClick={() => void applyStatus(order.id, "SHIPPED")}
                  >
                    Отправлено
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
