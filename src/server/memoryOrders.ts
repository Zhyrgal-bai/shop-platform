export type OrderStatus =
  | "NEW"
  | "ACCEPTED"
  | "PAID_PENDING"
  | "CONFIRMED"
  | "SHIPPED"
  | "CANCELLED";

export type MemoryOrderItem = {
  name: string;
  size: string;
  quantity: number;
  color?: string;
  price?: number;
  productId?: number;
};

export type MemoryOrder = {
  id: number;
  name: string;
  phone: string;
  address: string;
  items: MemoryOrderItem[];
  total: number;
  status: OrderStatus;
  createdAt: Date;
  /** Для уведомлений в Telegram при смене статуса */
  customerTelegramId?: number;
};

const orders: MemoryOrder[] = [];
let currentId = 1000;

const VALID_STATUSES: OrderStatus[] = [
  "NEW",
  "ACCEPTED",
  "PAID_PENDING",
  "CONFIRMED",
  "SHIPPED",
  "CANCELLED",
];

export function isValidOrderStatus(s: string): s is OrderStatus {
  return VALID_STATUSES.includes(s as OrderStatus);
}

export function createMemoryOrder(input: {
  name: string;
  phone: string;
  address: string;
  items: MemoryOrderItem[];
  total: number;
  customerTelegramId?: number;
  /** Совпадает с id заказа в Prisma после `POST /orders` (Telegram-цепочка). */
  id?: number;
}): MemoryOrder {
  let orderId: number;
  if (input.id != null && Number.isFinite(Number(input.id))) {
    orderId = Math.trunc(Number(input.id));
    const existing = orders.find((o) => o.id === orderId);
    if (existing) {
      console.log("MEMORY ORDER: duplicate id", orderId, "returning existing");
      return existing;
    }
    if (orderId >= currentId) {
      currentId = orderId + 1;
    }
  } else {
    orderId = currentId++;
  }
  const base = {
    id: orderId,
    name: input.name,
    phone: input.phone,
    address: input.address,
    items: [...input.items],
    total: input.total,
    status: "NEW" as const,
    createdAt: new Date(),
  };
  const tg = input.customerTelegramId;
  const order: MemoryOrder =
    tg != null && Number.isFinite(tg)
      ? { ...base, customerTelegramId: tg }
      : base;
  orders.push(order);
  return order;
}

export function getMemoryOrder(id: number): MemoryOrder | undefined {
  return orders.find((o) => o.id === id);
}

export function setMemoryOrderStatus(
  id: number,
  status: OrderStatus
): MemoryOrder | undefined {
  const o = getMemoryOrder(id);
  if (!o || !VALID_STATUSES.includes(status)) return undefined;
  o.status = status;
  console.log("ORDER STATUS UPDATE:", id, status);
  return o;
}

/** Для отладки / будущего списка */
export function listMemoryOrders(): readonly MemoryOrder[] {
  return orders;
}
