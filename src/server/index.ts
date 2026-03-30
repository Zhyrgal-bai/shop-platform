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

    // 🔴 ВАЛИДАЦИЯ
    if (!name || !price || !image || !variants || variants.length === 0) {
      return res.status(400).json({ error: "Неверные данные" });
    }

    const cleanVariants = variants.map((v: any) => ({
      color: v.color,
      sizes: v.sizes.filter((s: any) => s.size && s.stock > 0), // 👈 ФИЛЬТР
    }));

    const product = await prisma.product.create({
      data: {
        name,
        price,
        image,
        description: description || "",

        variants: {
          create: cleanVariants.map((v: any) => ({
            color: v.color,

            sizes: {
              create: v.sizes.map((s: any) => ({
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
    console.error("PRISMA ERROR:", e); // 👈 САМОЕ ВАЖНОЕ
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
    console.error(error);
    res.status(500).json({ error: "Ошибка получения товаров" });
  }
});


// ================== CREATE ORDER ==================
app.post("/orders", async (req: Request, res: Response) => {
  try {
    const body = req.body;

    let user = await prisma.user.findUnique({
      where: { telegramId: body.user.telegramId },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          telegramId: body.user.telegramId,
          name: body.user.name,
        },
      });
    }

    const order = await prisma.order.create({
      data: {
        userId: user.id,
        total: body.total,
        status: "new",

        items: {
          create: body.items.map((item: any) => ({
            productId: item.productId,
            name: item.name,
            size: item.size,
            color: item.color,
            quantity: item.quantity,
            price: item.price,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Ошибка при создании заказа" });
  }
});


// ================== START SERVER ==================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});