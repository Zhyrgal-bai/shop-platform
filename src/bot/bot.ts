import { Telegraf } from "telegraf";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ✅ создаём бота
export const bot = new Telegraf(process.env.BOT_TOKEN!);

// ================== START ==================
bot.start((ctx) => {
  ctx.reply("Добро пожаловать в Bars 👕", {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Открыть магазин",
            web_app: {
              url: "https://bars-miniapp.vercel.app",
            },
          },
        ],
      ],
    },
  });
});

// ================== DEBUG USER ID ==================
bot.on("message", (ctx) => {
  console.log("USER ID:", ctx.from.id);
});

// ================== CALLBACK BUTTONS ==================
bot.on("callback_query", async (ctx) => {
  try {
    if (!("data" in ctx.callbackQuery)) return;

    const data = ctx.callbackQuery.data;
    console.log("CALLBACK:", data);

    // ================== ✅ ПРИНЯТЬ ==================
    if (data.startsWith("order_accept_")) {
      const orderId = Number(data.split("_")[2]);

      // обновляем статус
      await prisma.order.update({
        where: { id: orderId },
        data: { status: "accepted" },
      });

      // получаем заказ с пользователем
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { user: true },
      });

      await ctx.answerCbQuery("Заказ принят ✅");

      // ❗ НЕ удаляем старое сообщение
      await ctx.reply(`✅ Заказ #${orderId} принят`);

      // 🔥 уведомление пользователю
      if (order?.user?.telegramId) {
        await bot.telegram.sendMessage(
          Number(order.user.telegramId),
          "✅ Ваш заказ принят!"
        );
      }
    }

    // ================== ❌ ЗАВЕРШИТЬ ==================
    if (data.startsWith("order_done_")) {
      const orderId = Number(data.split("_")[2]);

      await prisma.order.update({
        where: { id: orderId },
        data: { status: "completed" },
      });

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { user: true },
      });

      await ctx.answerCbQuery("Заказ завершен ✅");

      await ctx.reply(`📦 Заказ #${orderId} завершен`);

      // 🔥 уведомление пользователю
      if (order?.user?.telegramId) {
        await bot.telegram.sendMessage(
          Number(order.user.telegramId),
          "📦 Ваш заказ завершен!"
        );
      }
    }
  } catch (error) {
    console.error("CALLBACK ERROR:", error);
  }
});

// ================== LAUNCH ==================
bot.launch();

console.log("Bot started 🤖");