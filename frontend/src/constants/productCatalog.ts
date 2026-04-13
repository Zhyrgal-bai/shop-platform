/** Категории и размеры — единый справочник для админки и форм. */
export const PRODUCT_CATEGORIES = ["Худи", "Футболки", "Штаны"] as const;
export type ProductCategoryLabel = (typeof PRODUCT_CATEGORIES)[number];

export const PRODUCT_SIZES = ["S", "M", "L", "XL"] as const;
export type ProductSizeLabel = (typeof PRODUCT_SIZES)[number];
