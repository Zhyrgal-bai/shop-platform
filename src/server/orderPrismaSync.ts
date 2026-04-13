import { prisma } from "./db.js";

/** Обновить статус в БД, если заказ с таким id есть. Игнорирует отсутствие строки. */
export async function tryUpdatePrismaOrderStatus(
  id: number,
  status: string
): Promise<void> {
  try {
    await prisma.order.update({
      where: { id },
      data: { status },
    });
  } catch {
    /* нет заказа в Prisma — нормально для старых только in-memory */
  }
}
