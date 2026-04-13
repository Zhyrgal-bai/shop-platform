import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import multer from "multer";
import { Prisma } from "@prisma/client";
import cors from "cors";
import {
  isCloudinaryConfigured,
  uploadImageToCloudinary,
} from "./cloudinary.js";
import { denyIfNotAdmin, denyIfNotAdminQuery, isAdmin } from "./adminAuth.js";
import { isValidOrderStatus, type OrderStatus } from "./orderStatus.js";
import {
  adminNewOrderNotifyKeyboard,
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
import { notifyAfterOrderStatusChangeFromApi } from "./orderTelegramNotify.js";

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

type CleanVariantInput = {
  color: string;
  sizes: { size: string; stock: number }[];
};

function clampDiscountPercent(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.min(100, Math.max(0, Math.round(v)));
}

function normalizeVariantsInput(
  raw: unknown
): CleanVariantInput[] | { error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: "Нужен хотя бы один вариант" };
  }
  const out: CleanVariantInput[] = [];
  for (let i = 0; i < raw.length; i++) {
    const v = raw[i] as { color?: unknown; sizes?: unknown };
    const color = String(v?.color ?? "").trim();
    if (!color) {
      return { error: `Вариант ${i + 1}: укажите название цвета` };
    }
    const sizesRaw = v?.sizes;
    if (!Array.isArray(sizesRaw) || sizesRaw.length === 0) {
      return { error: `Вариант ${i + 1}: нужны размеры` };
    }
    const sizes: { size: string; stock: number }[] = [];
    for (const s of sizesRaw) {
      const z = s as { size?: unknown; stock?: unknown };
      const size = String(z?.size ?? "").trim();
      const stock = Number(z?.stock);
      if (!size || !Number.isFinite(stock) || stock < 0) {
        return { error: `Вариант ${i + 1}: неверные размер или количество` };
      }
      if (stock > 0) {
        sizes.push({ size, stock: Math.round(stock) });
      }
    }
    if (sizes.length === 0) {
      return {
        error: `Вариант ${i + 1}: укажите остаток хотя бы для одного размера`,
      };
    }
    out.push({ color, sizes });
  }
  return out;
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
      if (!isCloudinaryConfigured()) {
        return res.status(503).json({
          error: "Cloudinary не настроен (CLOUD_NAME, CLOUD_KEY, CLOUD_SECRET)",
        });
      }
      const file = req.file;
      if (!file?.buffer?.length) {
        return res.status(400).json({ error: "Нет файла" });
      }
      const url = await uploadImageToCloudinary(
        file.buffer,
        file.mimetype || "application/octet-stream"
      );
      res.json({ url });
    } catch (e) {
      console.error("UPLOAD ERROR:", e);
      res.status(500).json({ error: "upload failed" });
    }
  }
);

app.post(
  "/products/upload-images",
  upload.array("files", 15),
  async (req: Request, res: Response) => {
    console.log("UPLOAD-IMAGES DATA:", req.body);
    if (!denyIfNotAdmin(req, res)) return;
    try {
      if (!isCloudinaryConfigured()) {
        return res.status(503).json({
          error: "Cloudinary не настроен (CLOUD_NAME, CLOUD_KEY, CLOUD_SECRET)",
        });
      }
      const files = req.files as Express.Multer.File[] | undefined;
      if (!files?.length) {
        return res.status(400).json({ error: "Нет файлов" });
      }
      const urls: string[] = [];
      for (const file of files) {
        if (!file.buffer?.length) continue;
        const url = await uploadImageToCloudinary(
          file.buffer,
          file.mimetype || "application/octet-stream"
        );
        urls.push(url);
      }
      if (urls.length === 0) {
        return res.status(400).json({ error: "Пустые файлы" });
      }
      res.json({ urls });
    } catch (e) {
      console.error("UPLOAD-IMAGES ERROR:", e);
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
    const body = req.body as {
      name?: unknown;
      price?: unknown;
      image?: unknown;
      images?: unknown;
      description?: unknown;
      category?: unknown;
      discountPercent?: unknown;
      variants?: unknown;
    };

    const { name, price, image, images, description, category, discountPercent, variants } =
      body;

    const rawImages = Array.isArray(images)
      ? (images as unknown[])
          .filter((u) => u != null && String(u).trim() !== "")
          .map((u) => String(u).trim())
      : [];
    const imageStr =
      typeof image === "string" && image.trim() !== "" ? image.trim() : "";
    const imageList =
      rawImages.length > 0 ? rawImages : imageStr ? [imageStr] : [];
    const primaryImage = imageList[0] ?? "";

    const cleanVariants = normalizeVariantsInput(variants);
    if ("error" in cleanVariants) {
      return res.status(400).json({ error: cleanVariants.error });
    }

    if (!name || price == null || !primaryImage) {
      return res.status(400).json({ error: "Неверные данные" });
    }

    const product = await prisma.product.create({
      data: {
        name: String(name),
        price: Number(price),
        image: primaryImage,
        images: imageList,
        description: description != null ? String(description) : "",
        category:
          category != null && String(category).trim() !== ""
            ? String(category).trim()
            : "",
        discountPercent: clampDiscountPercent(discountPercent),
        variants: {
          create: cleanVariants.map((v) => ({
            color: v.color,
            sizes: {
              create: v.sizes.map((s) => ({
                size: s.size,
                stock: s.stock,
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

async function performOrderStatusUpdate(
  orderId: number,
  statusRaw: unknown
): Promise<
  | { ok: true; body: unknown }
  | { ok: false; statusCode: number; error: string }
> {
  const stRaw = String(statusRaw ?? "");
  console.log("ORDER STATUS:", stRaw);
  if (!isValidOrderStatus(stRaw)) {
    return { ok: false, statusCode: 400, error: "Нужен допустимый status" };
  }
  let st: OrderStatus = stRaw as OrderStatus;
  if (stRaw === "CONFIRMED") {
    st = "CONFIRMED";
  }
  try {
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { status: st },
    });
    const withUser = await prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true },
    });
    if (withUser) {
      void notifyAfterOrderStatusChangeFromApi({
        id: withUser.id,
        status: withUser.status,
        total: withUser.total,
        user: { telegramId: withUser.user.telegramId },
      });
    }
    return { ok: true, body: updated };
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2025"
    ) {
      return { ok: false, statusCode: 404, error: "Заказ не найден" };
    }
    console.error("ORDER STATUS ERROR:", e);
    return { ok: false, statusCode: 500, error: "fail" };
  }
}

app.post("/order/status", async (req: Request, res: Response) => {
  try {
    console.log("ORDER STATUS DATA:", req.body);
    if (!denyIfNotAdmin(req, res)) return;

    const { id, status } = req.body as {
      id?: unknown;
      status?: unknown;
    };

    const orderId = Number(id);
    if (!Number.isFinite(orderId)) {
      return res.status(400).json({ error: "Нужен id" });
    }

    const result = await performOrderStatusUpdate(orderId, status);
    if (!result.ok) {
      return res.status(result.statusCode).json({ error: result.error });
    }
    return res.json(result.body);
  } catch (e) {
    console.error("ORDER STATUS ERROR:", e);
    res.status(500).json({ error: "Server error" });
  }
});

app.put("/orders/:id/status", async (req: Request, res: Response) => {
  try {
    if (!denyIfNotAdmin(req, res)) return;
    const orderId = Number(req.params.id);
    if (!Number.isFinite(orderId)) {
      return res.status(400).json({ error: "Неверный id" });
    }
    const { status } = req.body as { status?: unknown };
    const result = await performOrderStatusUpdate(orderId, status);
    if (!result.ok) {
      return res.status(result.statusCode).json({ error: result.error });
    }
    return res.json(result.body);
  } catch (e) {
    console.error("PUT ORDER STATUS ERROR:", e);
    res.status(500).json({ error: "Server error" });
  }
});

app.put("/orders/:id", async (req: Request, res: Response) => {
  try {
    if (!denyIfNotAdmin(req, res)) return;
    const orderId = Number(req.params.id);
    if (!Number.isFinite(orderId)) {
      return res.status(400).json({ error: "Неверный id" });
    }
    const body = req.body as { status?: unknown; tracking?: unknown };
    const hasTracking = Object.prototype.hasOwnProperty.call(body, "tracking");
    const hasStatus =
      body.status !== undefined &&
      body.status !== null &&
      String(body.status).trim() !== "";

    if (!hasStatus && !hasTracking) {
      return res
        .status(400)
        .json({ error: "Укажите status и/или tracking" });
    }

    const data: { status?: OrderStatus; tracking?: string | null } = {};
    if (hasTracking) {
      const t = body.tracking;
      data.tracking =
        t === null || t === undefined || String(t).trim() === ""
          ? null
          : String(t).trim();
    }
    if (hasStatus) {
      const stRaw = String(body.status);
      if (!isValidOrderStatus(stRaw)) {
        return res.status(400).json({ error: "Нужен допустимый status" });
      }
      data.status = stRaw as OrderStatus;
    }

    const exists = await prisma.order.findUnique({ where: { id: orderId } });
    if (!exists) {
      return res.status(404).json({ error: "Заказ не найден" });
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data,
      include: { user: true },
    });

    if (hasStatus) {
      void notifyAfterOrderStatusChangeFromApi({
        id: updated.id,
        status: updated.status,
        total: updated.total,
        user: { telegramId: updated.user.telegramId },
      });
    }

    return res.json(updated);
  } catch (e) {
    console.error("PUT ORDER ERROR:", e);
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
      .filter((o) => o.status === "CONFIRMED" || o.status === "SHIPPED")
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

app.get("/products/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Неверный id" });
    }
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        variants: {
          include: { sizes: true },
        },
      },
    });
    if (!product) {
      return res.status(404).json({ error: "Товар не найден" });
    }
    res.json(product);
  } catch (error) {
    console.error("GET PRODUCT ERROR:", error);
    res.status(500).json({ error: "Ошибка получения товара" });
  }
});

async function fetchAdminOrdersPayload() {
  const rows = await prisma.order.findMany({
    include: { user: true },
    orderBy: { id: "desc" },
  });
  return rows.map((o) => {
    const phone =
      (o as { customerPhone?: string | null }).customerPhone?.trim() || "—";
    const tracking =
      (o as { tracking?: string | null }).tracking?.trim() || null;
    return {
      id: o.id,
      name: o.user.name?.trim() || "Гость",
      phone,
      status: o.status,
      statusText: orderStatusRu(o.status),
      total: o.total,
      tracking,
    };
  });
}

// ================== MY ORDERS (mini app, по Telegram userId) ==================
app.get("/orders/my", async (req: Request, res: Response) => {
  try {
    const raw = req.query.userId;
    const q = Array.isArray(raw) ? raw[0] : raw;
    const telegramId = Number(q);
    if (!Number.isFinite(telegramId) || telegramId <= 0) {
      return res.status(400).json({ error: "Нужен userId (Telegram)" });
    }

    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });
    if (!user) {
      return res.json([]);
    }

    const orders = await prisma.order.findMany({
      where: { userId: user.id },
      orderBy: { id: "desc" },
      include: { items: true },
    });
    res.json(orders);
  } catch (e) {
    console.error("GET /orders/my:", e);
    res.status(500).json({ error: "Ошибка загрузки заказов" });
  }
});

// ================== LIST ORDERS (admin, Prisma) ==================
app.get("/orders", async (req: Request, res: Response) => {
  if (!denyIfNotAdminQuery(req, res)) return;
  try {
    res.json(await fetchAdminOrdersPayload());
  } catch (e) {
    console.error("LIST ORDERS ERROR:", e);
    res.status(500).json({ error: "Ошибка загрузки заказов" });
  }
});

app.post("/orders/list", async (req: Request, res: Response) => {
  if (!denyIfNotAdmin(req, res)) return;
  try {
    res.json(await fetchAdminOrdersPayload());
  } catch (e) {
    console.error("LIST ORDERS ERROR:", e);
    res.status(500).json({ error: "Ошибка загрузки заказов" });
  }
});

/** Уведомление админу в Telegram о новом заказе из POST /orders (Prisma). */
async function notifyAdminNewOrderTelegram(input: {
  orderId: number;
  customerName: string;
  phone: string;
  address: string;
  total: number;
  items: { name: string; quantity: number }[];
}): Promise<void> {
  const chatId = getNotifyTargetChatId();
  if (chatId == null) {
    console.log(
      "TELEGRAM ORDER NOTIFY: пропуск (нет чата: задайте CHAT_ID или /start у бота)"
    );
    return;
  }

  const message =
    `🛒 Новый заказ #${input.orderId}\n\n` +
    `👤 Имя: ${input.customerName}\n` +
    `📞 Телефон: ${input.phone}\n` +
    `📍 Адрес: ${input.address}\n\n` +
    `💰 Сумма: ${input.total} сом\n\n` +
    `📦 Товары:\n` +
    input.items.map((i) => `- ${i.name} x${i.quantity}`).join("\n");

  try {
    if (bot) {
      await bot.telegram.sendMessage(chatId, message, {
        reply_markup: adminNewOrderNotifyKeyboard(input.orderId),
      });
      console.log("TELEGRAM ORDER NOTIFY: ok", input.orderId);
      return;
    }

    const token = process.env.BOT_TOKEN;
    if (!token) {
      console.log("TELEGRAM ORDER NOTIFY: пропуск (нет BOT_TOKEN)");
      return;
    }

    const res = await fetch(
      `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          reply_markup: adminNewOrderNotifyKeyboard(input.orderId),
        }),
      }
    );
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      description?: string;
    };
    if (!res.ok || json.ok === false) {
      console.error(
        "TELEGRAM ORDER NOTIFY: sendMessage failed",
        res.status,
        json
      );
    } else {
      console.log("TELEGRAM ORDER NOTIFY: ok", input.orderId);
    }
  } catch (error) {
    console.error("TELEGRAM ORDER NOTIFY error:", error);
  }
}

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

    const bodyAddr = (body as { address?: unknown }).address;
    const address =
      bodyAddr != null && String(bodyAddr).trim() !== ""
        ? String(bodyAddr).trim()
        : "—";
    const displayName =
      user.name?.trim() ||
      String(
        (body as { user?: { name?: string } }).user?.name ?? ""
      ).trim() ||
      "Гость";
    const phone =
      order.customerPhone?.trim() ||
      String((body as { phone?: unknown }).phone ?? "").trim() ||
      "—";

    void notifyAdminNewOrderTelegram({
      orderId: order.id,
      customerName: displayName,
      phone,
      address,
      total: order.total,
      items: order.items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
      })),
    });

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
    const body = req.body as {
      name?: unknown;
      price?: unknown;
      image?: unknown;
      images?: unknown;
      description?: unknown;
      category?: unknown;
      discountPercent?: unknown;
      variants?: unknown;
    };

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Неверный id" });
    }

    const {
      name,
      price,
      image,
      images,
      description,
      category,
      discountPercent,
      variants,
    } = body;

    const hasVariantUpdate = variants !== undefined;
    if (
      name === undefined &&
      price === undefined &&
      image === undefined &&
      images === undefined &&
      description === undefined &&
      category === undefined &&
      discountPercent === undefined &&
      !hasVariantUpdate
    ) {
      return res.status(400).json({ error: "Нет полей для обновления" });
    }

    let cleanVariants: CleanVariantInput[] | undefined;
    if (hasVariantUpdate) {
      const parsed = normalizeVariantsInput(variants);
      if ("error" in parsed) {
        return res.status(400).json({ error: parsed.error });
      }
      cleanVariants = parsed;
    }

    const scalar: {
      name?: string;
      price?: number;
      image?: string;
      images?: string[];
      description?: string | null;
      category?: string;
      discountPercent?: number;
    } = {};

    if (name !== undefined) scalar.name = String(name);
    if (price !== undefined) scalar.price = Number(price);
    if (discountPercent !== undefined) {
      scalar.discountPercent = clampDiscountPercent(discountPercent);
    }
    if (category !== undefined) {
      scalar.category = String(category).trim();
    }
    if (images !== undefined) {
      const list = Array.isArray(images)
        ? images
            .filter((u) => u != null && String(u).trim() !== "")
            .map((u) => String(u).trim())
        : [];
      scalar.images = list;
      const firstImg = list[0];
      if (firstImg !== undefined) {
        scalar.image = firstImg;
      }
    }
    if (image !== undefined) {
      scalar.image = String(image);
      if (images === undefined) {
        scalar.images = [String(image)];
      }
    }
    if (description !== undefined) {
      scalar.description = description === null ? null : String(description);
    }

    const product = await prisma.$transaction(async (tx) => {
      if (cleanVariants) {
        await tx.size.deleteMany({
          where: { variant: { productId: id } },
        });
        await tx.variant.deleteMany({ where: { productId: id } });
        for (const v of cleanVariants) {
          await tx.variant.create({
            data: {
              productId: id,
              color: v.color,
              sizes: {
                create: v.sizes.map((s) => ({
                  size: s.size,
                  stock: s.stock,
                })),
              },
            },
          });
        }
      }

      const include = {
        variants: { include: { sizes: true } },
      };
      if (Object.keys(scalar).length > 0) {
        return tx.product.update({
          where: { id },
          data: scalar,
          include,
        });
      }
      return tx.product.findUniqueOrThrow({
        where: { id },
        include,
      });
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