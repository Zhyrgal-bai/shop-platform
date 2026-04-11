import PaymentDetailsPanel from "../../components/admin/PaymentDetailsPanel";
import PromoCodesPanel from "../../components/admin/PromoCodesPanel";

export default function AdminSettingsPage() {
  return (
    <div className="admin-dash-page">
      <header className="admin-dash-page__head">
        <h1 className="admin-dash-page__title">Настройки</h1>
        <p className="admin-dash-page__subtitle">
          Реквизиты для оплаты и промокоды.
        </p>
      </header>

      <section className="admin-dash-section">
        <div className="admin-dash-card">
          <PaymentDetailsPanel />
        </div>
      </section>

      <section className="admin-dash-section">
        <div className="admin-dash-card">
          <PromoCodesPanel />
        </div>
      </section>
    </div>
  );
}
