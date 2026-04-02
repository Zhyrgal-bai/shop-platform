import { useState } from "react";
import type { Product, Variant, Size } from "../../types";
import { useCartStore } from "../../store/useCartStore";
import "../ui/ProductCard.css";

export default function ProductCard({ product }: { product: Product }) {
  const [selectedVariant, setSelectedVariant] = useState<Variant>(
    product.variants[0]
  );

  const [selectedSize, setSelectedSize] = useState<Size | null>(null);

  const addItem = useCartStore((state) => state.addItem);

  return (
    <div className="card">
      <img src={product.image} className="img" />

      <h3 className="title">{product.name}</h3>
      <p className="price">{product.price} сом</p>

      {/* COLORS */}
      <div className="colors">
        {product.variants.map((v) => (
          <button
            key={v.color}
            onClick={() => {
              setSelectedVariant(v);
              setSelectedSize(null);
            }}
            className={
              "colorBtn " +
              (selectedVariant.color === v.color ? "colorActive" : "")
            }
          >
            {v.color}
          </button>
        ))}
      </div>

      {/* SIZES */}
      <div className="sizes">
        {selectedVariant.sizes.map((s) => (
          <button
            key={s.size}
            disabled={s.stock === 0}
            onClick={() => setSelectedSize(s)}
            className={
              "sizeBtn " +
              (selectedSize?.size === s.size ? "sizeActive" : "") +
              (s.stock === 0 ? " disabled" : "")
            }
          >
            {s.size}
          </button>
        ))}
      </div>

      {/* BUTTON */}
      <button
        disabled={!selectedSize}
        onClick={() => {
          if (!selectedSize) return;

          addItem({
            productId: product.id!,
            name: product.name,
            price: product.price,
            size: selectedSize.size,
            color: selectedVariant.color,
            quantity: 1,
          });
        }}
        className={
          "btn " +
          (selectedSize ? "btnActive" : "btnDisabled")
        }
      >
        Купить
      </button>
    </div>
  );
}