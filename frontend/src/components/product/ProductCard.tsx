import { useEffect, useMemo, useState } from "react";
import type { Product, Variant, Size } from "../../types";
import { useCartStore } from "../../store/useCartStore";
import "../ui/ProductCard.css";

type Props = {
  product: Product;
  showToast: (msg: string) => void;
};

export default function ProductCard({ product, showToast }: Props) {
  const [selectedVariant, setSelectedVariant] = useState<Variant>(product.variants[0]);
  const [selectedSize, setSelectedSize] = useState<Size | null>(null);

  const addItem = useCartStore((state) => state.addItem);
  const removeItem = useCartStore((state) => state.removeItem);
  const items = useCartStore((state) => state.items);

  const firstAvailableSize = useMemo(() => {
    const size = selectedVariant.sizes.find((s) => s.stock > 0);
    return size ?? null;
  }, [selectedVariant.sizes]);

  useEffect(() => {
    setSelectedVariant(product.variants[0]);
    setSelectedSize(null);
  }, [product]);

  useEffect(() => {
    if (!selectedSize && firstAvailableSize) {
      setSelectedSize(firstAvailableSize);
    }
  }, [firstAvailableSize, selectedSize]);

  const cartItem = useMemo(() => {
    if (!selectedSize) return null;
    return (
      items.find(
        (i) =>
          i.productId === product.id &&
          i.color === selectedVariant.color &&
          i.size === selectedSize.size
      ) ?? null
    );
  }, [items, product.id, selectedSize, selectedVariant.color]);

  const quantity = cartItem?.quantity ?? 0;

  const upsertQuantity = (nextQuantity: number) => {
    if (!selectedSize) return;

    if (cartItem) removeItem(cartItem);
    if (nextQuantity <= 0) return;

    addItem({
      productId: product.id!,
      name: product.name,
      price: product.price,
      image: product.image,
      size: selectedSize.size,
      color: selectedVariant.color,
      quantity: nextQuantity,
    });
  };

  const handleAddToCart = () => {
    upsertQuantity(1);
    showToast("Добавлено в корзину");
  };

  const handleIncrement = () => {
    upsertQuantity(Math.max(1, quantity + 1));
  };

  const handleDecrement = () => {
    upsertQuantity(quantity - 1);
  };

  return (
    <div className="product-card">
      <div className="product-image-wrapper">
        <img src={product.image} alt={product.name} />
      </div>

      <div className="product-info">
        <h3 className="product-title">{product.name}</h3>

        <div className="product-bottom">
          <span className="product-price">
            {product.price} <span className="product-price-currency">сом</span>
          </span>

          <div className="product-actions">
            {quantity <= 0 ? (
              <button
                className="product-add-btn"
                onClick={handleAddToCart}
                disabled={!selectedSize}
                type="button"
              >
                Добавить
              </button>
            ) : (
              <>
                <button
                  className="product-action-btn"
                  onClick={handleDecrement}
                  disabled={!selectedSize}
                  type="button"
                  aria-label="Уменьшить"
                >
                  -
                </button>
                <span className="product-qty" aria-label="Количество">
                  {quantity}
                </span>
                <button
                  className="product-action-btn"
                  onClick={handleIncrement}
                  disabled={!selectedSize}
                  type="button"
                  aria-label="Увеличить"
                >
                  +
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}