import { isAdmin } from "../utils/isAdmin";
import ProductList from "../components/admin/ProductList";
import ProductForm from "../components/admin/ProductForm";
import "../components/ui/Admin.css";

const AdminPage = () => {
  return (
    <div className="admin-page">
      {!isAdmin() && <div className="no-access">Нет доступа</div>}

      {isAdmin() && (
        <>
          <h2 className="admin-section-title">Добавить товар</h2>
          <ProductForm />

          <h2 className="admin-section-title">Товары</h2>
          <ProductList />
        </>
      )}
    </div>
  );
};

export default AdminPage;