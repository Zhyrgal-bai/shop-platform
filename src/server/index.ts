import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import multer from "multer";
import { Prisma } from "@prisma/client";
import cors from "cors";
import { cloudinary } from "./cloudinary.js";
import { denyIfNotAdmin, isAdmin } from "./adminAuth.js";
import {
  createMemoryOrder,
  getMemoryOrder,
  isValidOrderStatus,
  listMemoryOrders,
  setMemoryOrderStatus,
  type MemoryOrder,
  type MemoryOrderItem,
  type OrderStatus,
} from "./memoryOrders.js";
import {
  adminMemoryOrderInlineKeyboard,
  bot,
  getNotifyTargetChatId,
} from "../bot/bot.js";
import { prisma } from "./db.js";
import {
  clearPaymentFieldByRowId,
  listPaymentDetailsFromDb,
  upsertPaymentSettings,
} from "./paymentRepo.js";
import {
  consumePromoDb,
  createPromoDb,
  deletePromoByCodeDb,
  listPromosFromDb,
  tryApplyPromoDb,
} from "./promoRepo.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

console.log("BOT TOKEN:", process.env.BOT_TOKEN ? "set" : "missing");
console.log("CHAT ID env:", process.env.CHAT_ID ?? "(empty)");

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
async function computeOrderTotalFromBody(
  body: OrderTotalBody
): Promise<
  { ok: true; orderTotal: number; promoRaw: string } | { ok: false; error: string }
> {
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
      const applied = await tryApplyPromoDb(prisma, promoRaw, subtotalVal);
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

app.use(cors());
app.use(express.json());

const TELEGRAM_WEBHOOK_URL =
  "https://bars-shop.onrender.com/telegram-webhook";

app.post("/telegram-webhook", async (req: Request, res: Response) => {
  if (!bot) {
    return res.sendStatus(503);
  }
  try {
    await bot.handleUpdate(req.body);
    return res.sendStatus(200);
  } catch (e) {
    console.error("telegram-webhook:", e);
    return res.sendStatus(500);
  }
});

// ================== ROOT ==================
app.get("/", (req: Request, res: Response) => {
  res.send("Server is working 🚀");
});

app.get("/test-telegram", async (req: Request, res: Response) => {
  try {
    if (!bot) {
      return res.status(500).json({ error: "BOT_UNDEFINED" });
    }

    const target = getNotifyTargetChatId();
    if (target == null) {
      return res.status(400).json({
        error:
          "Задайте CHAT_ID в .env или откройте бота и отправьте /start, чтобы задать чат для уведомлений",
      });
    }

    const result = await bot.telegram.sendMessage(
      target,
      "Проверка: сервер достучался до Telegram ✅"
    );

    res.json({ ok: true, result });
  } catch (e) {
    console.error("TELEGRAM ERROR FULL:", e);
    res.status(500).json({ error: String(e) });
  }
});

// ================== CHECK ADMIN ==================
app.post("/check-admin", (req: Request, res: Response) => {
  const { userId } = req.body as { userId?: unknown };
  res.json({ isAdmin: isAdmin(userId) });
});

// ================== UPLOAD (Cloudinary, admin) ==================
app.post(
  "/upload",
  upload.single("file"),
  async (req: Request, res: Response) => {
    console.log("UPLOAD DATA:", req.body);
    if (!denyIfNotAdmin(req, res)) return;
    try {
      const cn = process.env.CLOUD_NAME;
      const ck = process.env.CLOUD_KEY;
      const cs = process.env.CLOUD_SECRET;
      if (!cn || !ck || !cs) {
        return res.status(503).json({
          error: "Cloudinary не настроен (CLOUD_NAME, CLOUD_KEY, CLOUD_SECRET)",
        });
      }
      const file = req.file;
      if (!file?.buffer?.length) {
        return res.status(400).json({ error: "Нет файла" });
      }
      const b64 = file.buffer.toString("base64");
      const dataUri = `data:${file.mimetype || "application/octet-stream"};base64,${b64}`;
      const result = await cloudinary.uploader.upload(dataUri, {
        folder: "telegram-miniapp",
      });
      res.json({ url: result.secure_url });
    } catch (e) {
      console.error("UPLOAD ERROR:", e);
      res.status(500).json({ error: "upload failed" });
    }
  }
);

// ================== PAYMENT (Prisma singleton id=1) ==================
app.post("/payment/list", async (req: Request, res: Response) => {
  if (!denyIfNotAdmin(req, res)) return;
  try {
    res.json(await listPaymentDetailsFromDb(prisma));
  } catch (e) {
    console.error("PAYMENT LIST ERROR:", e);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/payment", async (req: Request, res: Response) => {
  if (!denyIfNotAdmin(req, res)) return;
  try {
    console.log("PAYMENT SAVE:", req.body);
    const saved = await upsertPaymentSettings(
      prisma,
      req.body as Record<string, unknown>
    );
    res.json(saved);
  } catch (e) {
    console.error("PAYMENT ERROR:", e);
    res.status(500).json({ error: "Failed to save payment" });
  }
});

app.delete("/payment/:id", async (req: Request, res: Response) => {
  if (!denyIfNotAdmin(req, res)) return;
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Неверный id" });
    }

    const ok = await clearPaymentFieldByRowId(prisma, id);
    if (!ok) {
      return res.status(404).json({ error: "Не найдено" });
    }

    res.status(204).send();
  } catch (e) {
    console.error("PAYMENT DELETE ERROR:", e);
    res.status(500).json({ error: "Server error" });
  }
});

// ================== PROMO (Prisma) ==================
app.post("/promo/apply", async (req: Request, res: Response) => {
  try {
    const { code, total } = req.body as { code?: unknown; total?: unknown };
    const t = Number(total);
    if (code == null || String(code).trim() === "" || !Number.isFinite(t)) {
      return res.status(400).json({ error: "Нужны code и total" });
    }
    try {
      const result = await tryApplyPromoDb(prisma, String(code), t);
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

app.post("/promo/list", async (req: Request, res: Response) => {
  if (!denyIfNotAdmin(req, res)) return;
  try {
    res.json(await listPromosFromDb(prisma));
  } catch (e) {
    console.error("PROMO LIST ERROR:", e);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/promo", async (req: Request, res: Response) => {
  if (!denyIfNotAdmin(req, res)) return;
  try {
    console.log("PROMO SAVE:", req.body);
    const body = req.body as {
      code?: unknown;
      discount?: unknown;
      maxUses?: unknown;
      limit?: unknown;
    };
    const lim = body.limit ?? body.maxUses;
    const row = await createPromoDb(
      prisma,
      String(body.code ?? ""),
      Number(body.discount),
      Number(lim)
    );
    return res.status(201).json(row);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return res.status(409).json({ error: "Такой код уже есть" });
    }
    const msg = e instanceof Error ? e.message : "";
    if (msg === "EMPTY_CODE") {
      return res.status(400).json({ error: "Укажите code" });
    }
    if (msg === "BAD_DISCOUNT") {
      return res.status(400).json({ error: "discount от 0 до 100" });
    }
    if (msg === "BAD_MAX_USES") {
      return res.status(400).json({ error: "maxUses / limit — целое число ≥ 1" });
    }
    console.error("PROMO POST ERROR:", e);
    return res.status(500).json({ error: "Failed to save promo" });
  }
});

app.delete("/promo/:code", async (req: Request, res: Response) => {
  if (!denyIfNotAdmin(req, res)) return;
  try {
    const codeParam = req.params.code;
    const encoded =
      typeof codeParam === "string"
        ? codeParam
        : Array.isArray(codeParam)
          ? (codeParam[0] ?? "")
          : "";
    const raw = decodeURIComponent(encoded);
    const ok = await deletePromoByCodeDb(prisma, raw);
    if (!ok) {
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
  if (!denyIfNotAdmin(req, res)) return;
  try {
    console.log("PRODUCT CREATE DATA:", req.body);
    const { name, price, image, images, description, variants } = req.body as {
      name?: unknown;
      price?: unknown;
      image?: unknown;
      images?: unknown;
      description?: unknown;
      variants?: unknown;
    };

    const rawImages = Array.isArray(images)
      ? (images as unknown[]).filter((u) => u != null && String(u).trim() !== "").map((u) => String(u).trim())
      : [];
    const imageStr =
      typeof image === "string" && image.trim() !== "" ? image.trim() : "";
    const imageList =
      rawImages.length > 0 ? rawImages : imageStr ? [imageStr] : [];
    const primaryImage = imageList[0] ?? "";

    if (
      !name ||
      price == null ||
      !primaryImage ||
      !Array.isArray(variants) ||
      variants.length === 0
    ) {
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
        name: String(name),
        price: Number(price),
        image: primaryImage,
        images: imageList,
        description: description != null ? String(description) : "",
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatMemoryOrderAdminHtml(order: MemoryOrder): string {
  const itemLines = order.items.map((i) => {
    const colorPart = i.color ? `, ${escapeHtml(String(i.color))}` : "";
    const pricePart =
      i.price != null && Number.isFinite(Number(i.price))
        ? ` — ${escapeHtml(String(i.price))} ₸`
        : "";
    return `• ${escapeHtml(i.name)} (${escapeHtml(i.size)}${colorPart}) × ${Number(i.quantity)}${pricePart}`;
  });
  return (
    `📦 <b>Новый заказ #${order.id}</b>\n\n` +
    `👤 ${escapeHtml(order.name)}\n` +
    `📞 ${escapeHtml(order.phone)}\n` +
    `📍 ${escapeHtml(order.address)}\n\n` +
    `<b>Товары:</b>\n${itemLines.join("\n")}\n\n` +
    `<b>Итого:</b> ${escapeHtml(String(order.total))} ₸` +
    (order.customerTelegramId != null
      ? `\n🆔 Telegram: <code>${order.customerTelegramId}</code>`
      : "")
  );
}

// ================== IN-MEMORY ORDER SYSTEM ==================
app.post("/create-order", async (req: Request, res: Response) => {
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
      prismaOrderId?: number;
    };

    const name = String(body.name ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const address = String(body.address ?? "").trim();
    const items = Array.isArray(body.items) ? body.items : [];

    const totalComputed = await computeOrderTotalFromBody(body);
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

    const prismaOrderIdRaw = body.prismaOrderId;
    const prismaOrderId =
      prismaOrderIdRaw != null && Number.isFinite(Number(prismaOrderIdRaw))
        ? Math.trunc(Number(prismaOrderIdRaw))
        : undefined;

    const order = createMemoryOrder({
      name,
      phone,
      address: address || "—",
      items,
      total: orderTotal,
      ...(customerTelegramId != null
        ? { customerTelegramId }
        : {}),
      ...(prismaOrderId != null ? { id: prismaOrderId } : {}),
    });

    if (promoRaw) {
      try {
        await consumePromoDb(prisma, promoRaw);
      } catch (e) {
        console.error("consumePromo after create-order:", e);
      }
    }

    try {
      if (!bot) {
        throw new Error("BOT_UNDEFINED: check BOT_TOKEN and import order (dotenv before bot)");
      }

      const target = getNotifyTargetChatId();
      if (target == null) {
        console.error(
          "Telegram: нет CHAT_ID в env и не задан fallback с /start — заказ не отправлен в чат"
        );
      } else {
        await bot.telegram.sendMessage(
          target,
          formatMemoryOrderAdminHtml(order),
          {
            parse_mode: "HTML",
            reply_markup: adminMemoryOrderInlineKeyboard(order.id),
          }
        );
        console.log("✅ ORDER SENT TO ADMIN", order.id);
      }
    } catch (error) {
      console.error("❌ TELEGRAM SEND ERROR:", error);
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

app.post("/order/status", async (req: Request, res: Response) => {
  try {
    console.log("ORDER STATUS DATA:", req.body);
    if (!denyIfNotAdmin(req, res)) return;

    const { id, status } = req.body as {
      id?: unknown;
      status?: unknown;
    };

    const orderId = Number(id);
    if (!Number.isFinite(orderId) || !status || !isValidOrderStatus(String(status))) {
      return res.status(400).json({ error: "Нужны id и допустимый status" });
    }

    const st = String(status) as OrderStatus;

    try {
      const updated = await prisma.order.update({
        where: { id: orderId },
        data: { status: st },
      });
      const mem = getMemoryOrder(orderId);
      if (mem) {
        setMemoryOrderStatus(orderId, st);
      }
      return res.json(updated);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2025"
      ) {
        const mem = setMemoryOrderStatus(orderId, st);
        if (!mem) {
          return res.status(404).json({ error: "Заказ не найден" });
        }
        return res.json(mem);
      }
      console.error("ORDER STATUS ERROR:", e);
      return res.status(500).json({ error: "fail" });
    }
  } catch (e) {
    console.error("ORDER STATUS ERROR:", e);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/analytics", async (req: Request, res: Response) => {
  if (!denyIfNotAdmin(req, res)) return;
  try {
    console.log("ANALYTICS DATA:", req.body);
    const orders = await prisma.order.findMany();

    const totalOrders = orders.length;
    const totalRevenue = orders
      .filter((o) => o.status === "CONFIRMED")
      .reduce((sum, o) => sum + o.total, 0);
    const accepted = orders.filter((o) => o.status === "ACCEPTED").length;
    const pending = orders.filter((o) => o.status === "PAID_PENDING").length;
    const shipped = orders.filter((o) => o.status === "SHIPPED").length;
    const done = shipped;

    const byStatus: Record<string, number> = {};
    for (const o of orders) {
      byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
    }

    res.json({
      totalOrders,
      totalRevenue,
      accepted,
      pending,
      shipped,
      done,
      byStatus,
    });
  } catch (e) {
    console.error("ANALYTICS ERROR:", e);
    res.status(500).json({ error: "analytics failed" });
  }
});

function orderStatusRu(status: string): string {
  const map: Record<string, string> = {
    new: "Новый",
    NEW: "Новый",
    ACCEPTED: "Принят",
    PAID_PENDING: "Ожидает подтверждения оплаты",
    CONFIRMED: "Оплачен",
    SHIPPED: "Отправлен",
    CANCELLED: "Отменён",
    processing: "В обработке",
    shipped: "Отправлен",
    delivered: "Доставлен",
    cancelled: "Отменён",
  };
  return map[status] ?? map[status.toLowerCase()] ?? status;
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
  if (!denyIfNotAdmin(req, res)) return;
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
        source: "prisma" as const,
      };
    });
    res.json(orders);
  } catch (e) {
    console.error("LIST ORDERS ERROR:", e);
    res.status(500).json({ error: "Ошибка загрузки заказов" });
  }
});

/** In-memory заказы (мини-апп /create-order) — тот же формат, что у Prisma-списка + поле source. */
app.post("/memory-orders/list", (req: Request, res: Response) => {
  if (!denyIfNotAdmin(req, res)) return;
  try {
    const rows = listMemoryOrders().map((o) => ({
      id: o.id,
      name: o.name,
      phone: o.phone,
      total: o.total,
      status: o.status,
      statusText: orderStatusRu(o.status),
      source: "memory" as const,
    }));
    res.json(rows);
  } catch (e) {
    console.error("MEMORY ORDERS LIST ERROR:", e);
    res.status(500).json({ error: "Ошибка загрузки заказов" });
  }
});

// ================== CREATE ORDER ==================
app.post("/orders", async (req: Request, res: Response) => {
  try {
  const body = req.body;

  console.log("DATA:", body);

  if (!body.user || !body.items || body.total == null) {
    return res.status(400).json({ error: "Неверные данные заказа" });
  }

  const totalComputed = await computeOrderTotalFromBody(body);
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
          status: "NEW",
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

    if (totalComputed.promoRaw) {
      try {
        await consumePromoDb(prisma, totalComputed.promoRaw);
      } catch (e) {
        console.error("consumePromo after /orders:", e);
      }
    }

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
  if (!denyIfNotAdmin(req, res)) return;
  try {
    console.log("PRODUCT UPDATE DATA:", req.body);
    const { name, price, image, images, description } = req.body as {
      name?: unknown;
      price?: unknown;
      image?: unknown;
      images?: unknown;
      description?: unknown;
    };

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Неверный id" });
    }

    if (
      name === undefined &&
      price === undefined &&
      image === undefined &&
      images === undefined &&
      description === undefined
    ) {
      return res.status(400).json({ error: "Нет полей для обновления" });
    }

    const data: {
      name?: string;
      price?: number;
      image?: string;
      images?: string[];
      description?: string | null;
    } = {};
    if (name !== undefined) data.name = String(name);
    if (price !== undefined) data.price = Number(price);
    if (images !== undefined) {
      const list = Array.isArray(images)
        ? images
            .filter((u) => u != null && String(u).trim() !== "")
            .map((u) => String(u).trim())
        : [];
      data.images = list;
      const firstImg = list[0];
      if (firstImg !== undefined) {
        data.image = firstImg;
      }
    }
    if (image !== undefined) {
      data.image = String(image);
      if (images === undefined) {
        data.images = [String(image)];
      }
    }
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
  if (!denyIfNotAdmin(req, res)) return;
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

  if (bot) {
    bot.telegram
      .setWebhook(TELEGRAM_WEBHOOK_URL)
      .then(() => console.log("Webhook set:", TELEGRAM_WEBHOOK_URL))
      .catch((err) => console.error("Webhook error:", err));
  }
});