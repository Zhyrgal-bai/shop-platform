export type OrderStatus =
  | "NEW"
  | "ACCEPTED"
  | "PAID_PENDING"
  | "CONFIRMED"
  | "SHIPPED"
  | "CANCELLED";

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
