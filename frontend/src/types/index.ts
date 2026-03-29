export interface ProductVariant {
  id?: number
  color: string
  size: string
  stock: number
}

export interface Product {
  id?: number
  name: string
  price: number
  category: string
  description?: string
  image: string
  variants: ProductVariant[]
}

export interface Order {
  id: number
  status: 'new' | 'done'
  items: unknown[]
  createdAt: string
}