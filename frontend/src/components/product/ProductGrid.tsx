import type { Product } from "../../types";
import ProductCard from "./ProductCard";
import "../ui/ProductGrid.css";

type ProductGridProps = {
  products: Product[];
  showToast: (msg: string) => void;
  onProductSelect?: (product: Product) => void;
};

export default function ProductGrid({
  products,
  showToast,
  onProductSelect,
}: ProductGridProps) {
  return (
    <div className="product-grid">
      {products.map((p) => (
        <ProductCard
          key={p.id}
          product={p}
          showToast={showToast}
          onOpenDetail={onProductSelect}
        />
      ))}
    </div>
  );
}