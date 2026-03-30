export interface Size {
  size: string;
  stock: number;
}

export interface Variant {
  color: string;
  sizes: Size[];
}

export interface Product {
  id?: number;
  name: string;
  price: number;
  image: string;
  description?: string;
  category?: string;

  variants: Variant[];
}