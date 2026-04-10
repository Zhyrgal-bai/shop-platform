import { useEffect, useMemo, useRef, useState } from "react";
import type { Product, ProductColor, Size } from "../../types";
import { useCartStore } from "../../store/useCartStore";
import { getNormalizedVariants, getPrimaryImage } from "../../utils/product";
import "../ui/ProductCard.css";

type Props = {
  product: Product;
  showToast: (msg: string) => void;
};

export default function ProductCard({ product, showToast }: Props) {
  const hasCustomColors = Boolean(product.colors && product.colors.length > 0);

  const colors: ProductColor[] = useMemo(
    () =>
      product.colors && product.colors.length > 0
        ? product.colors
        : [{ name: "default", hex: "#ffffff" }],
    [product]
  );

  const sizes = useMemo<Size[]>(() => {
    if (product.sizes && product.sizes.length > 0) {
      return product.sizes;
    }
    const v0 = getNormalizedVariants(product)[0];
    if (v0?.sizes?.length) {
      return v0.sizes;
    }
    return [{ size: "M", stock: 10 }];
  }, [product]);

  const allOutOfStock = useMemo(
    () => sizes.length > 0 && sizes.every((s) => s.stock === 0),
    [sizes]
  );

  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const images = useMemo(
    () =>
      product.images && product.images.length > 0
        ? product.images
        : [product.image],
    [product]
  );

  const lineColor = useMemo(() => {
    if (hasCustomColors) return selectedColor;
    return getNormalizedVariants(product)[0]?.color ?? "default";
  }, [hasCustomColors, selectedColor, product]);

  const addItem = useCartStore((state) => state.addItem);
  const removeItem = useCartStore((state) => state.removeItem);
  const items = useCartStore((state) => state.items);

  useEffect(() => {
    setSelectedSize(null);
    setSelectedColor(null);
    setCurrentIndex(0);
  }, [product]);

  useEffect(() => {
    setCurrentIndex((i) =>
      images.length === 0 ? 0 : Math.min(i, images.length - 1)
    );
  }, [images.length]);

  const selectedStock = useMemo(() => {
    if (!selectedSize) return 0;
    return sizes.find((s) => s.size === selectedSize)?.stock ?? 0;
  }, [selectedSize, sizes]);

  const cartItem = useMemo(() => {
    if (!selectedSize || lineColor === null) return null;
    return (
      items.find(
        (i) =>
          i.productId === product.id &&
          i.color === lineColor &&
          i.size === selectedSize
      ) ?? null
    );
  }, [items, product.id, selectedSize, lineColor]);

  const quantity = cartItem?.quantity ?? 0;

  const upsertQuantity = (nextQuantity: number) => {
    if (!selectedSize || allOutOfStock || lineColor === null) return;
    if (selectedStock <= 0) return;

    if (cartItem) removeItem(cartItem);
    if (nextQuantity <= 0) return;

    const capped = Math.min(nextQuantity, selectedStock);
    addItem({
      productId: product.id!,
      name: product.name,
      price: product.price,
      image: getPrimaryImage(product),
      size: selectedSize,
      color: lineColor,
      quantity: capped,
    });
  };

  const canAddToCart =
    !allOutOfStock &&
    selectedSize !== null &&
    selectedStock > 0 &&
    (!hasCustomColors || selectedColor !== null);

  const handleAddToCart = () => {
    if (!canAddToCart || lineColor === null) return;
    const line = sizes.find((s) => s.size === selectedSize);
    if (!line || line.stock === 0) return;
    upsertQuantity(1);
    showToast("Добавлено в корзину");
  };

  const handleIncrement = () => {
    if (quantity >= selectedStock) return;
    upsertQuantity(quantity + 1);
  };

  const handleDecrement = () => {
    upsertQuantity(quantity - 1);
  };

  const atMaxQty = quantity >= selectedStock && selectedStock > 0;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || images.length <= 1) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const threshold = 40;
    if (dx < -threshold) {
      setCurrentIndex((i) => Math.min(i + 1, images.length - 1));
    } else if (dx > threshold) {
      setCurrentIndex((i) => Math.max(i - 1, 0));
    }
    touchStartX.current = null;
  };

  return (
    <div
      className={`product-card${allOutOfStock ? " product-card--muted" : ""}`}
    >
      <div
        className="product-image-wrapper"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="image-slider"
          style={{
            transform: `translateX(-${(currentIndex * 100) / images.length}%)`,
            width: `${images.length * 100}%`,
          }}
        >
          {images.map((img, index) => (
            <img
              key={index}
              src={img}
              alt={index === 0 ? product.name : ""}
              style={{ width: `${100 / images.length}%` }}
            />
          ))}
        </div>

        {images.length > 1 && (
          <div className="dots">
            {images.map((_, i) => (
              <span
                key={i}
                role="button"
                tabIndex={0}
                className={i === currentIndex ? "active" : ""}
                onClick={() => setCurrentIndex(i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setCurrentIndex(i);
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="product-info">
        <h3 className="product-title">{product.name}</h3>

        {allOutOfStock ? (
          <div className="out-of-stock">НЕТ В НАЛИЧИИ</div>
        ) : (
          <>
            {hasCustomColors && (
              <div className="colors">
                {colors.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    aria-label={c.name}
                    style={{ background: c.hex }}
                    className={selectedColor === c.name ? "active" : ""}
                    onClick={() => setSelectedColor(c.name)}
                  />
                ))}
              </div>
            )}
            <div className="sizes">
              {sizes.map((s) => (
                <button
                  key={s.size}
                  type="button"
                  disabled={s.stock === 0}
                  className={selectedSize === s.size ? "active" : ""}
                  onClick={() => setSelectedSize(s.size)}
                >
                  {s.size} ({s.stock})
                </button>
              ))}
            </div>
          </>
        )}

        <div className="product-bottom">
          <span className="product-price">
            {product.price}{" "}
            <span className="product-price-currency">сом</span>
          </span>

          <div className="product-actions">
            {quantity <= 0 ? (
              <button
                className="product-add-btn"
                onClick={handleAddToCart}
                disabled={!canAddToCart}
                type="button"
              >
                Добавить
              </button>
            ) : (
              <>
                <button
                  className="product-action-btn"
                  onClick={handleDecrement}
                  disabled={
                    !selectedSize || allOutOfStock || lineColor === null
                  }
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
                  disabled={
                    !selectedSize ||
                    allOutOfStock ||
                    lineColor === null ||
                    atMaxQty
                  }
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
