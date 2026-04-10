import ProductList from "../components/admin/ProductList";
import ProductForm from "../components/admin/ProductForm";

const AdminPage = () => {
  return (
    <div className="admin-page">
      <h2 className="admin-section-title">Добавить товар</h2>
      <ProductForm />

      <h2 className="admin-section-title">Товары</h2>
      <ProductList />
    </div>
  );
};

export default AdminPage;