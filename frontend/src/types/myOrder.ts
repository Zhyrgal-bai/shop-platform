export type MyOrderRow = {
  id: number;
  userId: number;
  total: number;
  status: string;
  paymentMethod?: string;
  paymentId?: string | null;
  tracking?: string | null;
  customerPhone?: string | null;
  receiptUrl?: string | null;
  receiptType?: string | null;
  /** Present only if backend adds the field */
  createdAt?: string;
  items?: {
    id: number;
    name: string;
    size: string;
    color: string;
    quantity: number;
    price: number;
  }[];
};
