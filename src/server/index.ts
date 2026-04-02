import express from "express";
import type { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import "../bot/bot.js";
import cors from "cors";

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
  try {
    const body = req.body;

    console.log("ORDER BODY:", body); // 🔥 лог

    if (!body.user || !body.items || body.items.length === 0) {
      return res.status(400).json({ error: "Пустой заказ" });
    }

    let user = await prisma.user.findUnique({
      where: { telegramId: body.user.telegramId },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          telegramId: Number(body.user.telegramId),
          name: body.user.name || "Unknown",
        },
      });
    }

    const order = await prisma.order.create({
      data: {
        userId: user.id,
        total: Number(body.total) || 0,
        status: "new",

        items: {
          create: body.items.map((item: any) => ({
            productId: Number(item.productId) || 0,
            name: item.name || "unknown",
            size: item.size || "unknown",
            color: item.color || "unknown",
            quantity: Number(item.quantity) || 1,
            price: Number(item.price) || 0,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    console.log("ORDER CREATED:", order); // 🔥 лог

    res.json(order);
  } catch (error) {
    console.error("ORDER ERROR:", error); // 🔥 самое важное
    res.status(500).json({ error: "Ошибка при создании заказа" });
  }
});

// ================== START SERVER ==================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});