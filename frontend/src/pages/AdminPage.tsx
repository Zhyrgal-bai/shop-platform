import { isAdmin } from "../utils/isAdmin";
import { getTelegramUser } from "../utils/telegram";
import ProductList from "../components/admin/ProductList";
import ProductForm from "../components/admin/ProductForm";

const AdminPage = () => {
  const user = getTelegramUser();
  const ADMIN_ID = import.meta.env.VITE_ADMIN_ID;

  return (
    <div className="p-4 space-y-4">
      {/* 👇 ДИАГНОСТИКА */}
      <div style={{ background: "red", padding: 10 }}>
        USER ID: {user?.id || "null"}
        <br />
        ADMIN_ID: {ADMIN_ID}
      </div>

      {!isAdmin() && <div>Нет доступа</div>}

      {isAdmin() && (
        <>
          <h1>ADMIN PANEL</h1>
          <ProductForm />
          <ProductList />
        </>
      )}
    </div>
  );
};

export default AdminPage;