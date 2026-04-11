import ProductForm from "../../components/admin/ProductForm";
import ProductList from "../../components/admin/ProductList";

export default function AdminProductsPage() {
  return (
    <div className="admin-dash-page">
      <header className="admin-dash-page__head">
        <h1 className="admin-dash-page__title">Товары</h1>
        <p className="admin-dash-page__subtitle">
          Добавление с вариантами цвета и размеров, список и удаление.
        </p>
      </header>

      <section className="admin-dash-section">
        <h2 className="admin-dash-section__title">Добавить товар</h2>
        <div className="admin-dash-card">
          <ProductForm />
        </div>
      </section>

      <section className="admin-dash-section">
        <h2 className="admin-dash-section__title">Каталог</h2>
        <div className="admin-dash-card admin-dash-card--flush">
          <ProductList />
        </div>
      </section>
    </div>
  );
}
