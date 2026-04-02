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
    <div className="bg-white rounded-2xl shadow-md overflow-hidden p-3">
      {/* IMAGE */}
      <img
        src={product.image}
        className="w-full h-40 object-cover rounded-xl"
      />

      {/* TITLE */}
      <h3 className="font-semibold mt-2">{product.name}</h3>
      <p className="text-gray-500 text-sm">{product.price} сом</p>

      {/* COLORS */}
      <div className="flex gap-2 mt-3 flex-wrap">
        {product.variants.map((v, i) => (
          <button
            key={i}
            onClick={() => {
              setSelectedVariant(v);
              setSelectedSize(null);
            }}
            className={`px-3 py-1 rounded-full text-xs border ${
              selectedVariant.color === v.color
                ? "bg-black text-white"
                : "bg-white"
            }`}
          >
            {v.color}
          </button>
        ))}
      </div>

      {/* SIZES */}
      <div className="flex gap-2 mt-3 flex-wrap">
        {selectedVariant.sizes.map((s, i) => (
          <button
            key={i}
            disabled={s.stock === 0}
            onClick={() => setSelectedSize(s)}
            className={`px-3 py-1 rounded-lg text-xs border ${
              selectedSize?.size === s.size
                ? "bg-black text-white"
                : "bg-white"
            } ${s.stock === 0 ? "opacity-30 cursor-not-allowed" : ""}`}
          >
            {s.size}
          </button>
        ))}
      </div>

      {/* BUTTON */}
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
        className={`w-full mt-4 py-2 rounded-xl font-semibold transition ${
          selectedSize
            ? "bg-black text-white active:scale-95"
            : "bg-gray-300 text-gray-500 cursor-not-allowed"
        }`}
      >
        Купить
      </button>
    </div>
  );
}

//test