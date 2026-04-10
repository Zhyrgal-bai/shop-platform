import express from "express";
import type { Request, Response } from "express";
import { Prisma, PrismaClient } from "@prisma/client";
import cors from "cors";
import dotenv from "dotenv";
import { isAdmin } from "./adminAuth.js";

dotenv.config(); // ✅ ОБЯЗАТЕЛЬНО

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
  const userId = req.body?.userId;
  res.json({ isAdmin: isAdmin(userId) });
});

// ================== CREATE PRODUCT ==================
app.post("/products", async (req: Request, res: Response) => {
  try {
    const { userId, name, price, image, description, variants } = req.body;

    if (!isAdmin(userId)) {
      return res.status(403).json({ message: "Access denied" });
    }

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

type SendOrderItem = { name: string; size: string; quantity: number };

// ================== SEND ORDER (Telegram) ==================
app.post("/send-order", async (req: Request, res: Response) => {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  const CHAT_ID = process.env.CHAT_ID;

  if (!BOT_TOKEN || !CHAT_ID) {
    return res.status(500).json({
      error: "Telegram не настроен: задайте BOT_TOKEN и CHAT_ID в окружении",
    });
  }

  try {
    const body = req.body as {
      name?: string;
      phone?: string;
      address?: string;
      items?: SendOrderItem[];
      total?: number;
    };

    const name = String(body.name ?? "").trim() || "—";
    const phone = String(body.phone ?? "").trim() || "—";
    const address = String(body.address ?? "").trim() || "—";
    const items = Array.isArray(body.items) ? body.items : [];
    const total =
      typeof body.total === "number" && !Number.isNaN(body.total)
        ? body.total
        : Number(body.total);

    if (items.length === 0 || !Number.isFinite(total)) {
      return res.status(400).json({
        error: "Нужны поля items (непустой массив) и total",
      });
    }

    for (const i of items) {
      if (!i?.name || !i?.size || !Number.isFinite(Number(i.quantity))) {
        return res.status(400).json({
          error: "Каждый товар: name, size, quantity",
        });
      }
    }

    const message = `
🛒 НОВЫЙ ЗАКАЗ

👤 Имя: ${name}
📞 Телефон: ${phone}
📍 Адрес: ${address}

📦 Товары:
${items.map((i) => `• ${i.name} (${i.size}) x${i.quantity}`).join("\n")}

💰 Итого: ${total} сом
`.trim();

    const tgRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: message,
        }),
      }
    );

    const tgData = (await tgRes.json().catch(() => ({}))) as {
      ok?: boolean;
      description?: string;
    };

    if (!tgRes.ok || tgData.ok === false) {
      console.error("Telegram sendMessage failed:", tgRes.status, tgData);
      return res.status(502).json({
        error: "Telegram не принял сообщение",
        details: tgData.description ?? tgRes.statusText,
      });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("SEND-ORDER ERROR:", err);
    res.status(500).json({ error: "Ошибка при отправке заказа в Telegram" });
  }
});

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

// ================== CREATE ORDER ==================
app.post("/orders", async (req: Request, res: Response) => {
  const body = req.body;

  console.log("ORDER BODY:", body);

  if (!body.user || !body.items || !body.total) {
    return res.status(400).json({ error: "Неверные данные заказа" });
  }

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

      const order = await tx.order.create({
        data: {
          userId: user.id,
          total: Number(body.total),
          status: "new",
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
});

// ================== UPDATE PRODUCT ==================
app.put("/products/:id", async (req: Request, res: Response) => {
  try {
    const { userId, name, price, image, description } = req.body;

    if (!isAdmin(userId)) {
      return res.status(403).json({ message: "Access denied" });
    }

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
    const userId = req.body?.userId;

    if (!isAdmin(userId)) {
      return res.status(403).json({ message: "Access denied" });
    }

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

// ================== START SERVER ==================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});