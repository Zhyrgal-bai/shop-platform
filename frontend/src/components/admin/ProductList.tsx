import { useEffect } from "react";
import { useAdminStore } from "../../store/admin.store";

const ProductList = () => {
  const { products, fetchProducts, deleteProduct } = useAdminStore();

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

  return (
    <div className="admin-products">
      {products.length === 0 && (
        <div className="admin-empty-products">Пока нет товаров</div>
      )}

      {products.map((p) => (
        <div key={p.id} className="admin-product-card">
          <img
            src={p.image}
            alt={p.name}
            className="admin-product-image"
          />

          <div className="admin-product-main">
            <h3 className="admin-product-name">{p.name}</h3>
            <p className="admin-product-meta">{p.price} сом</p>
          </div>

          <button onClick={() => deleteProduct(p.id!)} className="delete">
            Удалить
          </button>
        </div>
      ))}
    </div>
  );
};

export default ProductList;