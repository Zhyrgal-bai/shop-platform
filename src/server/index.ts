import express from "express"; // подключаем express (сервер)
import type { Request, Response } from "express"; // типы для TypeScript
import { PrismaClient } from "@prisma/client"; // подключаем Prisma (работа с БД)
import "../bot/bot.js";

const app = express(); // создаём сервер
const prisma = new PrismaClient(); // создаём подключение к базе данных

app.use(express.json()); // чтобы сервер понимал JSON (запросы от клиента)


// ================== ROOT ==================
// Проверка сервера (работает ли вообще)
app.get("/", (req: Request, res: Response) => {
  res.send("Server is working 🚀");
});


// ================== CREATE PRODUCT ==================
// Добавление нового товара (админка)
app.post("/products", async (req, res) => {
  try {
    const { name, price, image, description, variants } = req.body;

    const product = await prisma.product.create({
      data: {
        name,
        price,
        image,
        description,

        variants: {
          create: variants.map((v: any) => ({
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
    console.error(e);
    res.status(500).json({ error: "Ошибка создания товара" });
  }
});


// ================== GET PRODUCTS ==================
// Получение всех товаров (для пользователя / React)
app.get("/products", async (req: Request, res: Response) => {
  try {
    // берём товары вместе с вариантами и размерами
    const products = await prisma.product.findMany({
      include: {
        variants: {
          include: {
            sizes: true, // размеры и остатки
          },
        },
      },
    });

    // отправляем список товаров
    res.json(products);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Ошибка получения товаров" });
  }
});


// ================== CREATE ORDER ==================
// оформление заказа
app.post("/orders", async (req: Request, res: Response) => {
  try {
    const body = req.body as {
      user: {
        telegramId: number;
        name: string;
      };
      items: {
        productId: number;
        name: string;
        size: string;
        color: string;
        quantity: number;
        price: number;
      }[];
      total: number;
    };

    // найти или создать пользователя
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

    // создать заказ
    const order = await prisma.order.create({
      data: {
        userId: user.id,
        total: body.total,
        status: "new",

        items: {
          create: body.items.map((item) => ({
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
// запуск сервера
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});