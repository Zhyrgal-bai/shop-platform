import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const [busyTrackingId, setBusyTrackingId] = useState<number | null>(null);
  const [trackingDraft, setTrackingDraft] = useState<Record<number, string>>(
    {}
  );
  const trackingDirtyRef = useRef<Set<number>>(new Set());

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoading(true);
    }
    try {
      const data = await adminService.fetchOrders();
      setOrders(data);
      setError(null);
    } catch (e) {
      console.error(e);
      if (!opts?.silent) {
        setError("Не удалось загрузить заказы");
        setOrders([]);
      }
    } finally {
      if (!opts?.silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const interval = setInterval(() => {
      void load({ silent: true });
    }, 3000);
    return () => clearInterval(interval);
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === "ALL") return orders;
    return orders.filter((o) => canonicalStatus(o.status) === filter);
  }, [orders, filter]);

  useEffect(() => {
    setTrackingDraft((prev) => {
      const next = { ...prev };
      for (const o of orders) {
        if (!trackingDirtyRef.current.has(o.id)) {
          next[o.id] = o.tracking ?? "";
        }
      }
      return next;
    });
  }, [orders]);

  async function applyStatus(
    id: number,
    status: "ACCEPTED" | "CONFIRMED" | "SHIPPED" | "CANCELLED"
  ) {
    setBusyId(id);
    try {
      await adminService.updateOrderStatus(id, status);
      await load();
      window.dispatchEvent(new CustomEvent("bars-shop:admin-orders-changed"));
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

  async function saveTracking(id: number) {
    const text = (trackingDraft[id] ?? "").trim();
    setBusyTrackingId(id);
    try {
      await adminService.updateOrderTracking(id, text);
      trackingDirtyRef.current.delete(id);
      await load();
      window.dispatchEvent(new CustomEvent("bars-shop:admin-orders-changed"));
    } catch (e) {
      console.error(e);
      alert(
        e instanceof Error ? e.message : "Не удалось сохранить комментарий"
      );
    } finally {
      setBusyTrackingId(null);
    }
  }

  return (
    <div className="admin-dash-page">
      <header className="admin-dash-page__head">
        <h1 className="admin-dash-page__title">Заказы</h1>
        <p className="admin-dash-page__subtitle">
          Заказы из базы; список обновляется каждые 3 с. Кнопки в Telegram
          меняют тот же заказ по номеру.
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
            const busyTr = busyTrackingId === order.id;
            const receiptUrl = order.receiptUrl?.trim() ?? "";
            const hasReceipt = receiptUrl.length > 0;
            const payMethod = (order.paymentMethod ?? "receipt").toLowerCase();
            const isFinik = payMethod === "finik";
            return (
              <article key={order.id} className="admin-order-card">
                <div className="admin-order-card__top">
                  <h2 className="admin-order-card__id">#{order.id}</h2>
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
                  <div>
                    <dt>Оплата</dt>
                    <dd>
                      {isFinik ? "Finik" : "Чек / перевод"}
                    </dd>
                  </div>
                </dl>
                {hasReceipt && (
                  <div className="admin-order-card__receipt">
                    <p className="admin-order-card__receipt-title">Чек</p>
                    {(order.receiptType ?? "").toLowerCase() === "pdf" ? (
                      <a
                        className="admin-order-card__receipt-link"
                        href={receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        📄 Открыть PDF чек
                      </a>
                    ) : (
                      <button
                        type="button"
                        className="admin-order-card__receipt-thumb-btn"
                        onClick={() =>
                          window.open(
                            receiptUrl,
                            "_blank",
                            "noopener,noreferrer"
                          )
                        }
                      >
                        <img
                          src={receiptUrl}
                          alt="Чек оплаты"
                          className="admin-order-card__receipt-thumb"
                        />
                      </button>
                    )}
                  </div>
                )}
                <div className="admin-order-card__tracking">
                  <label
                    className="admin-order-card__tracking-label"
                    htmlFor={`order-tracking-${order.id}`}
                  >
                    Статус доставки / комментарий
                  </label>
                  <textarea
                    id={`order-tracking-${order.id}`}
                    className="admin-order-card__tracking-input"
                    rows={2}
                    value={trackingDraft[order.id] ?? ""}
                    disabled={busy || busyTr}
                    placeholder="Например: Курьер выехал"
                    onChange={(e) => {
                      trackingDirtyRef.current.add(order.id);
                      setTrackingDraft((prev) => ({
                        ...prev,
                        [order.id]: e.target.value,
                      }));
                    }}
                  />
                  <button
                    type="button"
                    className="admin-order-card__btn admin-order-card__btn--tracking-save"
                    disabled={busy || busyTr}
                    onClick={() => void saveTracking(order.id)}
                  >
                    {busyTr ? "Сохранение…" : "Сохранить"}
                  </button>
                </div>
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
                    disabled={
                      busy ||
                      (!isFinik && canon !== "PAID_PENDING") ||
                      (isFinik && canon !== "ACCEPTED")
                    }
                    title={
                      isFinik
                        ? canon !== "ACCEPTED"
                          ? "Только для Finik после принятия заказа"
                          : undefined
                        : canon !== "PAID_PENDING"
                          ? "После «Я оплатил» у клиента"
                          : undefined
                    }
                    onClick={() => void applyStatus(order.id, "CONFIRMED")}
                  >
                    {isFinik
                      ? "💳 Подтвердить оплату (Finik)"
                      : "✅ Подтвердить оплату"}
                  </button>
                  <button
                    type="button"
                    className="admin-order-card__btn admin-order-card__btn--reject"
                    disabled={busy || canon !== "PAID_PENDING"}
                    title={
                      canon !== "PAID_PENDING"
                        ? "Только для ожидания проверки оплаты"
                        : undefined
                    }
                    onClick={() => {
                      if (
                        !window.confirm(
                          "Отклонить оплату и отменить заказ?"
                        )
                      ) {
                        return;
                      }
                      void applyStatus(order.id, "CANCELLED");
                    }}
                  >
                    ❌ Отклонить оплату
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
