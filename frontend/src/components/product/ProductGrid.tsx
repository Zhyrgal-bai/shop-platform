import type { Product } from "../../types";
import ProductCard from "./ProductCard";
import "../ui/ProductGrid.css";

type ProductGridProps = {
  products: Product[];
  showToast: (msg: string) => void;
};

export default function ProductGrid({ products, showToast }: ProductGridProps) {
  return (
    <div className="product-grid">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} showToast={showToast} />
      ))}
    </div>
  );
}