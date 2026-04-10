import type { Product, Variant } from "../types";

const DEFAULT_SIZE_STOCK = 10;
const DEFAULT_SIZE_LABEL = "M";
const DEFAULT_COLOR_NAME = "Белый";
const DEFAULT_COLOR_HEX = "#ffffff";

/** Список изображений: `images` или одно поле `image`. */
export function getProductImages(product: Product): string[] {
  if (product.images && product.images.length > 0) {
    return product.images;
  }
  return [product.image];
}

/** Первое изображение для превью. */
export function getPrimaryImage(product: Product): string {
  return getProductImages(product)[0] ?? product.image;
}

function cloneSizes(
  sizes: { size: string; stock: number }[]
): { size: string; stock: number }[] {
  return sizes.map((s) => ({ size: s.size, stock: s.stock }));
}

/**
 * Варианты для UI/корзины: старый `variants` или сборка из `colors` + `sizes` с fallback.
 */
export function getNormalizedVariants(product: Product): Variant[] {
  if (product.variants && product.variants.length > 0) {
    return product.variants;
  }

  const sizes =
    product.sizes && product.sizes.length > 0
      ? cloneSizes(product.sizes)
      : [{ size: DEFAULT_SIZE_LABEL, stock: DEFAULT_SIZE_STOCK }];

  if (product.colors && product.colors.length > 0) {
    return product.colors.map((c) => ({
      color: c.name,
      sizes: cloneSizes(sizes),
    }));
  }

  return [
    {
      color: DEFAULT_COLOR_NAME,
      sizes: cloneSizes(sizes),
    },
  ];
}

function sumStockOfSizes(sizes: { stock: number }[]): number {
  return sizes.reduce((acc, s) => acc + (Number(s.stock) || 0), 0);
}

/** Сумма остатков по всем размерам (плоская модель или сумма по вариантам). */
export function getTotalStock(product: Product): number {
  if (product.sizes && product.sizes.length > 0) {
    return sumStockOfSizes(product.sizes);
  }

  if (product.variants && product.variants.length > 0) {
    return product.variants.reduce(
      (acc, v) => acc + sumStockOfSizes(v.sizes ?? []),
      0
    );
  }

  return DEFAULT_SIZE_STOCK;
}

export function isOutOfStock(product: Product): boolean {
  return getTotalStock(product) === 0;
}

export const productDisplayDefaults = {
  DEFAULT_SIZE_STOCK,
  DEFAULT_SIZE_LABEL,
  DEFAULT_COLOR_NAME,
  DEFAULT_COLOR_HEX,
} as const;
