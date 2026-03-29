import { isAdmin } from "../utils/isAdmin";
import ProductList from "../components/admin/ProductList";
import ProductForm from "../components/admin/ProductForm";

const AdminPage = () => {
  if (!isAdmin()) {
    return <div>Нет доступа</div>;
  }

  return (
    <div className="p-4 space-y-6">
      <h1>ADMIN PANEL</h1>

      <ProductForm />
      <ProductList />
    </div>
  );
};

export default AdminPage;