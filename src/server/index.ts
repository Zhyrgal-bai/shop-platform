import express from "express";
import type { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { bot } from "../bot/bot.js";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config(); // ✅ ОБЯЗАТЕЛЬНО

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// ================== ROOT ==================
app.get("/", (req: Request, res: Response) => {
  res.send("Server is working 🚀");
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

        await tx.product.update({
          where: { id: productId },
          data: { sold: { increment: qty } },
        });
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

    // ================== 🔥 TELEGRAM NOTIFICATION ==================
    try {
      console.log("ADMIN_ID:", process.env.ADMIN_ID);

      const message = `
🛒 <b>Новый заказ</b>

👤 <b>${user.name || "Без имени"}</b>
🆔 <code>${user.telegramId}</code>

💰 <b>${order.total} сом</b>

📦 <b>Товары:</b>
${order.items
  .map(
    (i) =>
      `• ${i.name} (${i.color}, ${i.size}) x${i.quantity}`
  )
  .join("\n")}
      `;

      await bot.telegram.sendMessage(
        Number(process.env.ADMIN_ID),
        message,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "✅ Принять",
                  callback_data: `order_accept_${order.id}`,
                },
                {
                  text: "❌ Завершить",
                  callback_data: `order_done_${order.id}`,
                },
              ],
            ],
          },
        }
      );

      console.log("✅ TELEGRAM SENT");
    } catch (err) {
      console.error("❌ TELEGRAM ERROR:", err);
    }
    // ============================================================

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

// ================== START SERVER ==================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});