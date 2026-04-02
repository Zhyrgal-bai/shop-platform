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
              url: "https://frontend-one-zeta-45.vercel.app",
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
    // ✅ проверяем что это именно data callback
    if (!("data" in ctx.callbackQuery)) return;

    const data = ctx.callbackQuery.data;

    console.log("CALLBACK:", data);

    // ✅ Принять заказ
    if (data.startsWith("order_accept_")) {
      const orderId = Number(data.split("_")[2]);

      await prisma.order.update({
        where: { id: orderId },
        data: { status: "accepted" },
      });

      await ctx.answerCbQuery("Заказ принят ✅");

      await ctx.editMessageText(`✅ Заказ #${orderId} принят`);
    }

    // ❌ Завершить заказ
    if (data.startsWith("order_done_")) {
      const orderId = Number(data.split("_")[2]);

      await prisma.order.update({
        where: { id: orderId },
        data: { status: "completed" },
      });

      await ctx.answerCbQuery("Заказ завершен ✅");

      await ctx.editMessageText(`📦 Заказ #${orderId} завершен`);
    }
  } catch (error) {
    console.error("CALLBACK ERROR:", error);
  }
});

// ================== LAUNCH ==================
bot.launch();

console.log("Bot started 🤖");