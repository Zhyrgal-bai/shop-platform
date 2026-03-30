import { useState } from "react";
import type { Product, Variant, Size } from "../../types";
import { useCartStore } from "../../store/useCartStore";

export default function ProductCard({ product }: { product: Product }) {
  const [selectedVariant, setSelectedVariant] = useState<Variant>(
    product.variants[0]
  );
  const [selectedSize, setSelectedSize] = useState<Size | null>(null);

  const addItem = useCartStore((state) => state.addItem);

  return (
    <div className="border p-2">
      <img src={product.image} />

      <h3>{product.name}</h3>
      <p>{product.price} сом</p>

      {/* Цвет */}
      <div>
        {product.variants.map((v, i) => (
          <button key={i} onClick={() => setSelectedVariant(v)}>
            {v.color}
          </button>
        ))}
      </div>

      {/* Размер */}
      <div>
        {selectedVariant.sizes.map((s, i) => (
          <button
            key={i}
            disabled={s.stock === 0}
            onClick={() => setSelectedSize(s)}
          >
            {s.size}
          </button>
        ))}
      </div>

      <button
        disabled={!selectedSize}
        onClick={() =>
          addItem({
            productId: product.id!,
            name: product.name,
            price: product.price,
            size: selectedSize!.size,
            color: selectedVariant.color,
            quantity: 1,
          })
        }
      >
        Купить
      </button>
    </div>
  );
}