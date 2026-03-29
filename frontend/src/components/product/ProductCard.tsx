import { useState } from "react";
import type { Product } from "../../types";
import { useCartStore } from "../../store/useCartStore";

export default function ProductCard({ product }: { product: Product }) {
  const [selectedVariant, setSelectedVariant] = useState(product.variants[0]);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const addItem = useCartStore((state) => state.addItem);

  return (
    <div className="border p-2 rounded-xl space-y-2">
      <img src={product.image} className="w-full" />

      <h3>{product.name}</h3>
      <p>{product.price} сом</p>

      {/* 🎨 COLORS */}
      <div>
        <p>Цвет:</p>
        <div className="flex gap-2">
          {product.variants.map((v, i) => (
            <button
              key={i}
              onClick={() => {
                setSelectedVariant(v);
                setSelectedSize(null);
              }}
              className={`px-2 py-1 border ${
                selectedVariant.color === v.color ? "bg-black text-white" : ""
              }`}
            >
              {v.color}
            </button>
          ))}
        </div>
      </div>

      {/* 📏 SIZES */}
      <div>
        <p>Размер:</p>
        <div className="flex gap-2">
          {product.variants
            .filter((v) => v.color === selectedVariant.color)
            .map((v, i) => (
              <button
                key={i}
                disabled={v.stock === 0}
                onClick={() => setSelectedSize(v.size)}
                className={`px-2 py-1 border ${
                  selectedSize === v.size ? "bg-black text-white" : ""
                } ${v.stock === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {v.size}
              </button>
            ))}
        </div>
      </div>

      {/* 🛒 BUTTON */}
      <button
        disabled={!selectedSize}
        onClick={() => {
          addItem({
            productId: product.id!, // 👈 фикс
            name: product.name,
            price: product.price,
            size: selectedSize!,
            color: selectedVariant.color,
            quantity: 1,
          });
        }}
        className="bg-black text-white w-full py-2 rounded disabled:bg-gray-400"
      >
        Купить
      </button>
    </div>
  );
}