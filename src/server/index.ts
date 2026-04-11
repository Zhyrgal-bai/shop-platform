import express from "express";
import type { Request, Response } from "express";
import { Prisma, PrismaClient } from "@prisma/client";
import cors from "cors";
import dotenv from "dotenv";
import { isAdmin } from "./adminAuth.js";
import {
  createMemoryOrder,
  getMemoryOrder,
  isValidOrderStatus,
  listMemoryOrders,
  setMemoryOrderStatus,
  type MemoryOrderItem,
} from "./memoryOrders.js";
import { bot } from "../bot/bot.js";
import {
  addPaymentDetail,
  deletePaymentDetail,
  listPaymentDetails,
} from "./memoryPayments.js";
import {
  addPromoRecord,
  consumePromo,
  deletePromoByCode,
  listPromoRecords,
  tryApplyPromo,
} from "./memoryPromos.js";

dotenv.config(); // ✅ ОБЯЗАТЕЛЬНО

console.log("CHAT_ID:", process.env.CHAT_ID);

type OrderTotalBody = {
  total?: unknown;
  subtotal?: unknown;
  promo?: unknown;
  promoCode?: unknown;
};

function promoApplyErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : "";
  if (msg === "NOT_FOUND") return "Промокод не найден";
  if (msg === "EXHAUSTED") return "Промокод исчерпан";
  if (msg === "BAD_TOTAL") return "Неверная сумма";
  if (msg === "EMPTY") return "Укажите промокод";
  return "Промокод недействителен";
}

/** Сверка total/subtotal с промокодом (без списания использования). */
function computeOrderTotalFromBody(
  body: OrderTotalBody
): { ok: true; orderTotal: number; promoRaw: string } | { ok: false; error: string } {
  const promoRaw = String(body.promo ?? body.promoCode ?? "").trim();
  const subtotalVal = Number(body.subtotal ?? body.total);
  const bodyTotal = Number(body.total);

  if (!Number.isFinite(bodyTotal)) {
    return { ok: false, error: "Неверная сумма заказа" };
  }

  if (promoRaw) {
    if (!Number.isFinite(subtotalVal) || subtotalVal < 0) {
      return { ok: false, error: "Нужны subtotal и total для промокода" };
    }
    try {
      const applied = tryApplyPromo(promoRaw, subtotalVal);
      if (Math.abs(bodyTotal - applied.newTotal) > 0.01) {
        return { ok: false, error: "Сумма не совпадает с промокодом" };
      }
      return { ok: true, orderTotal: applied.newTotal, promoRaw };
    } catch (e) {
      return { ok: false, error: promoApplyErrorMessage(e) };
    }
  }

  const orderTotal = Math.round(bodyTotal);
  if (Number.isFinite(subtotalVal)) {
    if (Math.abs(orderTotal - Math.round(subtotalVal)) > 0.01) {
      return { ok: false, error: "Неверная сумма" };
    }
  }
  return { ok: true, orderTotal, promoRaw: "" };
}

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// ================== ROOT ==================
app.get("/", (req: Request, res: Response) => {
  res.send("Server is working 🚀");
});

// ================== CHECK ADMIN ==================
app.post("/check-admin", (req: Request, res: Response) => {
  const { userId } = req.body as { userId?: unknown };
  res.json({ isAdmin: isAdmin(userId) });
});

// ================== PAYMENT DETAILS (in-memory) ==================
app.post("/payment/list", (req: Request, res: Response) => {
  try {
    res.json(listPaymentDetails());
  } catch (e) {
    console.error("PAYMENT LIST ERROR:", e);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/payment", (req: Request, res: Response) => {
  try {
    const { type, value } = req.body as {
      type?: string;
      value?: string;
    };

    const t = String(type ?? "").trim();
    const v = String(value ?? "").trim();
    if (!t || !v) {
      return res.status(400).json({ error: "Нужны type и value" });
    }

    const created = addPaymentDetail(t, v);
    res.status(201).json(created);
  } catch (e) {
    console.error("PAYMENT POST ERROR:", e);
    res.status(500).json({ error: "Server error" });
  }
});

app.delete("/payment/:id", (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Неверный id" });
    }

    if (!deletePaymentDetail(id)) {
      return res.status(404).json({ error: "Не найдено" });
    }

    res.status(204).send();
  } catch (e) {
    console.error("PAYMENT DELETE ERROR:", e);
    res.status(500).json({ error: "Server error" });
  }
});

// ================== PROMO CODES (in-memory) ==================
app.post("/promo/apply", (req: Request, res: Response) => {
  try {
    const { code, total } = req.body as { code?: unknown; total?: unknown };
    const t = Number(total);
    if (code == null || String(code).trim() === "" || !Number.isFinite(t)) {
      return res.status(400).json({ error: "Нужны code и total" });
    }
    try {
      const result = tryApplyPromo(String(code), t);
      return res.json({
        success: true,
        newTotal: result.newTotal,
        discount: result.discount,
      });
    } catch (e) {
      const msg = promoApplyErrorMessage(e);
      const status = msg === "Промокод не найден" ? 404 : 400;
      return res.status(status).json({ error: msg });
    }
  } catch (e) {
    console.error("PROMO APPLY ERROR:", e);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/promo/list", (req: Request, res: Response) => {
  try {
    res.json(listPromoRecords());
  } catch (e) {
    console.error("PROMO LIST ERROR:", e);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/promo", (req: Request, res: Response) => {
  try {
  const { code, discount, maxUses } = req.body as {
    code?: unknown;
    discount?: unknown;
    maxUses?: unknown;
  };

  try {
    const row = addPromoRecord(
      String(code ?? ""),
      Number(discount),
      Number(maxUses)
    );
    return res.status(201).json(row);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "DUPLICATE") {
      return res.status(409).json({ error: "Такой код уже есть" });
    }
    if (msg === "EMPTY_CODE") {
      return res.status(400).json({ error: "Укажите code" });
    }
    if (msg === "BAD_DISCOUNT") {
      return res.status(400).json({ error: "discount от 0 до 100" });
    }
    if (msg === "BAD_MAX_USES") {
      return res.status(400).json({ error: "maxUses — целое число ≥ 1" });
    }
    return res.status(400).json({ error: "Неверные данные промокода" });
  }
  } catch (e) {
    console.error("PROMO POST ERROR:", e);
    res.status(500).json({ error: "Server error" });
  }
});

app.delete("/promo/:code", (req: Request, res: Response) => {
  try {
  const codeParam = req.params.code;
  const encoded =
    typeof codeParam === "string"
      ? codeParam
      : Array.isArray(codeParam)
        ? (codeParam[0] ?? "")
        : "";
  const raw = decodeURIComponent(encoded);
  if (!deletePromoByCode(raw)) {
    return res.status(404).json({ error: "Промокод не найден" });
  }

  res.status(204).send();
  } catch (e) {
    console.error("PROMO DELETE ERROR:", e);
    res.status(500).json({ error: "Server error" });
  }
});

// ================== CREATE PRODUCT ==================
app.post("/products", async (req: Request, res: Response) => {
  try {
    const { name, price, image, description, variants } = req.body;

    if (!name || !price || !image || !variants || variants.length === 0) {
      return res.status(400).json({ error: "Неверные данные" });
    }

    const cleanVariants = variants.map((v: any) => ({
      color: v.color,
      sizes: (v.sizes || []).filter(
        (s: any) => s.size && Number(s.stock) > 0
      ),
    }));

    const product = await prisma.product.create({
      data: {
        name,
        price: Number(price),
        image,
        description: description || "",
        variants: {
          create: cleanVariants.map((v: any) => ({
            color: v.color,
            sizes: {
              create: v.sizes.map((s: any) => ({
                size: s.size,
                stock: Number(s.stock),
              })),
            },
          })),
        },
      },
      include: {
        variants: {
          include: {
            sizes: true,
          },
        },
      },
    });

    res.json(product);
  } catch (e) {
    console.error("PRISMA ERROR:", e);
    res.status(500).json({ error: "Ошибка создания товара" });
  }
});

// ================== IN-MEMORY ORDER SYSTEM ==================
app.post("/create-order", async (req: Request, res: Response) => {
  console.log("CHAT_ID:", process.env.CHAT_ID);
  console.log("ORDER DATA:", req.body);

  try {
    const body = req.body as {
      name?: string;
      phone?: string;
      address?: string;
      items?: MemoryOrderItem[];
      total?: number;
      subtotal?: number;
      promo?: string;
      promoCode?: string;
      customerTelegramId?: number;
    };

    const name = String(body.name ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const address = String(body.address ?? "").trim();
    const items = Array.isArray(body.items) ? body.items : [];

    const totalComputed = computeOrderTotalFromBody(body);
    if (!totalComputed.ok) {
      return res.status(400).json({ error: totalComputed.error });
    }
    const { orderTotal, promoRaw } = totalComputed;

    if (!name || !phone || items.length === 0) {
      return res.status(400).json({
        error: "Нужны name, phone, items (массив) и total",
      });
    }

    for (const i of items) {
      if (!i?.name || !i?.size || !Number.isFinite(Number(i.quantity))) {
        return res.status(400).json({
          error: "Каждый товар: name, size, quantity",
        });
      }
    }

    const tgRaw = body.customerTelegramId;
    const customerTelegramId =
      tgRaw != null && Number.isFinite(Number(tgRaw)) ? Number(tgRaw) : null;

    const order = createMemoryOrder({
      name,
      phone,
      address: address || "—",
      items,
      total: orderTotal,
      ...(customerTelegramId != null
        ? { customerTelegramId }
        : {}),
    });

    if (promoRaw) {
      try {
        consumePromo(promoRaw);
      } catch (e) {
        console.error("consumePromo after create-order:", e);
      }
    }

    try {
      console.log("SENDING ORDER TO TELEGRAM...");
      console.log("CHAT_ID:", process.env.CHAT_ID);
      if (bot && process.env.CHAT_ID) {
        const message = `🟡 Новый заказ #${order.id}`;
        await bot.telegram.sendMessage(
          process.env.CHAT_ID,
          message,
          { parse_mode: "HTML" }
        );
        console.log("ORDER SENT SUCCESS");
      } else {
        console.error("TELEGRAM: skip (no bot or CHAT_ID)");
      }
    } catch (error) {
      console.error("TELEGRAM ERROR:", error);
    }

    return res.status(201).json({ success: true, orderId: order.id });
  } catch (err) {
    console.error("CREATE ORDER ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/order/:id", (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: "Неверный id" });
  }
  const order = getMemoryOrder(id);
  if (!order) {
    return res.status(404).json({ error: "Заказ не найден" });
  }
  res.json(order);
});

app.post("/order/status", (req: Request, res: Response) => {
  try {
  const { id, status } = req.body as {
    id?: number;
    status?: string;
  };

  const orderId = Number(id);
  if (!Number.isFinite(orderId) || !status || !isValidOrderStatus(status)) {
    return res.status(400).json({ error: "Нужны id и допустимый status" });
  }

  const updated = setMemoryOrderStatus(orderId, status);
  if (!updated) {
    return res.status(404).json({ error: "Заказ не найден" });
  }
  res.json(updated);
  } catch (e) {
    console.error("ORDER STATUS ERROR:", e);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/analytics", (req: Request, res: Response) => {
  try {
  const orders = listMemoryOrders();
  const totalOrders = orders.length;
  const totalRevenue = orders
    .filter((o) => o.status === "CONFIRMED" || o.status === "DONE")
    .reduce((sum, o) => sum + Number(o.total), 0);
  const accepted = orders.filter((o) => o.status === "ACCEPTED").length;
  const done = orders.filter((o) => o.status === "DONE").length;
  res.json({ totalOrders, totalRevenue, accepted, done });
  } catch (e) {
    console.error("ANALYTICS ERROR:", e);
    res.status(500).json({ error: "Server error" });
  }
});

function orderStatusRu(status: string): string {
  const map: Record<string, string> = {
    new: "Новый",
    processing: "В обработке",
    shipped: "Отправлен",
    delivered: "Доставлен",
    cancelled: "Отменён",
  };
  const key = status.toLowerCase();
  return map[key] ?? status;
}

// ================== GET PRODUCTS ==================
app.get("/products", async (req: Request, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        variants: {
          include: {
            sizes: true,
          },
        },
      },
    });

    res.json(products);
  } catch (error) {
    console.error("GET PRODUCTS ERROR:", error);
    res.status(500).json({ error: "Ошибка получения товаров" });
  }
});

// ================== LIST ORDERS (admin, Prisma) ==================
app.post("/orders/list", async (req: Request, res: Response) => {
  try {
    const rows = await prisma.order.findMany({
      include: { user: true },
      orderBy: { id: "desc" },
    });
    const orders = rows.map((o) => {
      const phone =
        (o as { customerPhone?: string | null }).customerPhone?.trim() || "—";
      return {
        id: o.id,
        name: o.user.name?.trim() || "Гость",
        phone,
        status: o.status,
        statusText: orderStatusRu(o.status),
        total: o.total,
      };
    });
    res.json(orders);
  } catch (e) {
    console.error("LIST ORDERS ERROR:", e);
    res.status(500).json({ error: "Ошибка загрузки заказов" });
  }
});

// ================== CREATE ORDER ==================
app.post("/orders", async (req: Request, res: Response) => {
  try {
  const body = req.body;

  console.log("ORDER BODY:", body);

  if (!body.user || !body.items || body.total == null) {
    return res.status(400).json({ error: "Неверные данные заказа" });
  }

  const totalComputed = computeOrderTotalFromBody(body);
  if (!totalComputed.ok) {
    return res.status(400).json({ error: totalComputed.error });
  }
  const orderTotal = totalComputed.orderTotal;

  const items = body.items as Array<{
    productId: number;
    name: string;
    size: string;
    color: string;
    quantity: number;
    price: number;
  }>;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Корзина пуста" });
  }

  try {
    const { order, user } = await prisma.$transaction(async (tx) => {
      let user = await tx.user.findUnique({
        where: { telegramId: BigInt(body.user.telegramId) },
      });

      if (!user) {
        user = await tx.user.create({
          data: {
            telegramId: BigInt(body.user.telegramId),
            name: body.user.name,
          },
        });
      }

      for (const item of items) {
        const productId = Number(item.productId);
        const qty = Number(item.quantity);
        if (!productId || Number.isNaN(qty) || qty < 1) {
          throw new Error("INVALID_ITEM");
        }

        const sizeRow = await tx.size.findFirst({
          where: {
            size: String(item.size),
            variant: {
              productId,
              color: String(item.color),
            },
          },
        });

        if (!sizeRow) {
          throw new Error("NOT_FOUND");
        }

        const updated = await tx.size.updateMany({
          where: {
            id: sizeRow.id,
            stock: { gte: qty },
          },
          data: { stock: { decrement: qty } },
        });

        if (updated.count !== 1) {
          throw new Error("OUT_OF_STOCK");
        }

        await tx.$executeRaw(
          Prisma.sql`UPDATE "Product" SET "sold" = "sold" + ${qty} WHERE "id" = ${productId}`
        );
      }

      const phoneRaw = (body as { phone?: unknown }).phone;
      const customerPhone =
        phoneRaw != null && String(phoneRaw).trim() !== ""
          ? String(phoneRaw).trim()
          : null;

      const order = await tx.order.create({
        data: {
          userId: user.id,
          total: orderTotal,
          status: "new",
          ...(customerPhone != null ? { customerPhone } : {}),
          items: {
            create: items.map((item) => ({
              productId: Number(item.productId),
              name: item.name,
              size: String(item.size),
              color: String(item.color),
              quantity: Number(item.quantity),
              price: Number(item.price),
            })),
          },
        },
        include: {
          items: true,
        },
      });

      return { order, user };
    });

    console.log("ORDER CREATED:", order);

    res.json(order);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "INVALID_ITEM") {
      return res.status(400).json({ error: "Неверные данные позиции в заказе" });
    }
    if (code === "NOT_FOUND") {
      return res
        .status(400)
        .json({ error: "Товар недоступен (цвет или размер не найден)" });
    }
    if (code === "OUT_OF_STOCK") {
      return res.status(400).json({ error: "Недостаточно товара на складе" });
    }
    console.error("ORDER ERROR FULL:", error);
    res.status(500).json({ error: "Ошибка при создании заказа" });
  }
  } catch (e) {
    console.error("ORDERS POST ROUTE ERROR:", e);
    if (!res.headersSent) {
      res.status(500).json({ error: "Server error" });
    }
  }
});

// ================== UPDATE PRODUCT ==================
app.put("/products/:id", async (req: Request, res: Response) => {
  try {
    const { name, price, image, description } = req.body;

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Неверный id" });
    }

    if (name === undefined && price === undefined && image === undefined && description === undefined) {
      return res.status(400).json({ error: "Нет полей для обновления" });
    }

    const data: {
      name?: string;
      price?: number;
      image?: string;
      description?: string | null;
    } = {};
    if (name !== undefined) data.name = String(name);
    if (price !== undefined) data.price = Number(price);
    if (image !== undefined) data.image = String(image);
    if (description !== undefined) data.description = description === null ? null : String(description);

    const product = await prisma.product.update({
      where: { id },
      data,
      include: {
        variants: { include: { sizes: true } },
      },
    });

    res.json(product);
  } catch (e) {
    console.error("UPDATE PRODUCT ERROR:", e);
    res.status(500).json({ error: "Ошибка обновления товара" });
  }
});

// ================== DELETE PRODUCT ==================
app.delete("/products/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Неверный id" });
    }

    await prisma.$transaction(async (tx) => {
      const variants = await tx.variant.findMany({
        where: { productId: id },
        select: { id: true },
      });
      const variantIds = variants.map((v) => v.id);
      if (variantIds.length > 0) {
        await tx.size.deleteMany({ where: { variantId: { in: variantIds } } });
      }
      await tx.variant.deleteMany({ where: { productId: id } });
      await tx.product.delete({ where: { id } });
    });

    res.status(204).send();
  } catch (e) {
    console.error("DELETE PRODUCT ERROR:", e);
    res.status(500).json({ error: "Ошибка удаления товара" });
  }
});

// ================== GLOBAL PROCESS ERRORS ==================
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT ERROR:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED PROMISE:", reason);
});

// ================== START SERVER ==================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});

if (bot) {
  const tgBot = bot;
  tgBot
    .launch()
    .then(() => console.log("Telegram bot started 🤖"))
    .catch((e) => console.error("Bot launch error:", e));
  process.once("SIGINT", () => tgBot.stop("SIGINT"));
  process.once("SIGTERM", () => tgBot.stop("SIGTERM"));
}