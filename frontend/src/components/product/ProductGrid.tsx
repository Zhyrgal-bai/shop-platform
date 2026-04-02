import type { Product } from "../../types";
import ProductCard from "./ProductCard";
import "../ui/ProductGrid.css";

export default function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div style={styles.wrapper}>
      <div style={styles.grid}>
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    padding: "10px",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
    gap: "15px",
  },
};