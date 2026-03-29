import { useEffect } from "react";
import { useAdminStore } from "../../store/admin.store";

const ProductList = () => {
  const { products, fetchProducts, deleteProduct } = useAdminStore();

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

  return (
    <div>
      <h2 className="font-semibold mb-2">Товары</h2>

      {products.map((p) => (
        <div
          key={p.id}
          className="border p-2 mb-2 flex justify-between items-center"
        >
          <div>
            <div className="font-bold">{p.name}</div>
            <div>{p.price} сом</div>
          </div>

          <button
            onClick={() => deleteProduct(p.id!)}
            className="text-red-500"
          >
            Удалить
          </button>
        </div>
      ))}
    </div>
  );
};

export default ProductList;