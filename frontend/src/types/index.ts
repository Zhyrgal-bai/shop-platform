export interface Size {
  id?: number;
  size: string;
  stock: number;
}

export interface Variant {
  id?: number;
  color: string;
  sizes: Size[];
}

/** Цвет в новой модели (опционально, вместе с `sizes`). */
export interface ProductColor {
  name: string;
  hex: string;
}

export interface Product {
  id?: number;
  name: string;
  price: number;
  image: string;

  images?: string[];
  colors?: ProductColor[];
  sizes?: Size[];

  /** Продано единиц (аналитика). */
  sold?: number;

  description?: string;
  category?: string;

  /** Скидка в процентах 0–100 от поля `price`. */
  discountPercent?: number;

  /** Легаси с API: варианты по цвету с размерами. */
  variants?: Variant[];
}
