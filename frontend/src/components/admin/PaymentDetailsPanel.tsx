import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import {
  adminService,
  type AdminPaymentDetail,
} from "../../services/admin.service";

const FIELDS = ["mbank", "optima", "obank", "card", "qr"] as const;
type PayField = (typeof FIELDS)[number];

const LABELS: Record<PayField, string> = {
  mbank: "Mbank",
  optima: "Optima",
  obank: "O!Bank / другой банк",
  card: "Карта",
  qr: "QR (URL картинки)",
};

function rowsToMap(rows: AdminPaymentDetail[]): Record<PayField, string> {
  const m: Record<PayField, string> = {
    mbank: "",
    optima: "",
    obank: "",
    card: "",
    qr: "",
  };
  for (const r of rows) {
    const k = r.type.toLowerCase() as PayField;
    if (k in m) m[k] = r.value;
  }
  return m;
}

export default function PaymentDetailsPanel() {
  const [values, setValues] = useState<Record<PayField, string>>({
    mbank: "",
    optima: "",
    obank: "",
    card: "",
    qr: "",
  });
  const [rows, setRows] = useState<AdminPaymentDetail[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);

  const load = useCallback(async () => {
    setListLoading(true);
    try {
      const data = await adminService.listPaymentDetails();
      setRows(data);
      setValues(rowsToMap(data));
      setError(null);
    } catch (e) {
      console.error(e);
      setError("Не удалось загрузить реквизиты");
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await adminService.savePaymentSettings({ ...values });
      await load();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        setError("Нет прав");
      } else if (err instanceof Error && err.message.includes("Telegram")) {
        setError(err.message);
      } else {
        setError("Не удалось сохранить");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await adminService.deletePaymentDetail(id);
      await load();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        alert("Нет прав");
      } else {
        alert("Не удалось удалить");
      }
    }
  };

  function truncate(s: string, max = 48): string {
    const t = s.trim();
    if (t.length <= max) return t;
    return `${t.slice(0, max)}…`;
  }

  return (
    <>
      <h2 className="admin-section-title">Платёжные реквизиты</h2>

      <form className="admin-form admin-form--payment" onSubmit={handleSave}>
        {error && (
          <div className="admin-form-error" role="alert">
            {error}
          </div>
        )}

        {FIELDS.map((field) => (
          <div key={field} className="admin-form-section">
            <label className="admin-field-label" htmlFor={`pay-${field}`}>
              {LABELS[field]}
            </label>
            <input
              id={`pay-${field}`}
              className="admin-input"
              value={values[field]}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [field]: e.target.value }))
              }
              placeholder={field === "qr" ? "https://…/qr.png" : ""}
              autoComplete="off"
            />
          </div>
        ))}

        <button
          type="submit"
          className="admin-submit-btn"
          disabled={loading}
        >
          {loading ? "Сохранение…" : "Сохранить реквизиты"}
        </button>
      </form>

      <div className="admin-payments">
        {listLoading && (
          <p className="admin-empty-products">Загрузка…</p>
        )}
        {!listLoading && rows.length === 0 && (
          <p className="admin-empty-products">Заполните поля выше и сохраните</p>
        )}
        {!listLoading &&
          rows.map((p) => (
            <div key={p.id} className="admin-payment-row">
              <span className="admin-payment-line">
                <strong>{p.type.toUpperCase()}:</strong>{" "}
                <span className="admin-payment-value" title={p.value}>
                  {truncate(p.value)}
                </span>
              </span>
              <button
                type="button"
                className="delete"
                onClick={() => void handleDelete(p.id)}
              >
                удалить
              </button>
            </div>
          ))}
      </div>
    </>
  );
}
