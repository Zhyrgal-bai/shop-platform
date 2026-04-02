import { isAdmin } from "../utils/isAdmin";
import { getTelegramUser } from "../utils/telegram";
import ProductList from "../components/admin/ProductList";
import ProductForm from "../components/admin/ProductForm";
import "../components/ui/Admin.css";

const AdminPage = () => {
  const user = getTelegramUser();
  const ADMIN_ID = import.meta.env.VITE_ADMIN_ID;

  return (
    <div className="admin">
      {/* DEBUG */}
      <div className="debug">
        USER ID: {user?.id || "null"}
        <br />
        ADMIN_ID: {ADMIN_ID}
      </div>

      {!isAdmin() && <div className="no-access">Нет доступа</div>}

      {isAdmin() && (
        <>
          <h1 className="admin-title">ADMIN PANEL ⚙️</h1>

          <div className="admin-block">
            <ProductForm />
          </div>

          <div className="admin-block">
            <ProductList />
          </div>
        </>
      )}
    </div>
  );
};

export default AdminPage;