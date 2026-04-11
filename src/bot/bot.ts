import "dotenv/config";
import { Telegraf } from "telegraf";
import { getMemoryOrder, setMemoryOrderStatus } from "../server/memoryOrders.js";
import { listPaymentDetails } from "../server/memoryPayments.js";

const botToken = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.CHAT_ID;

/** `new Telegraf(BOT_TOKEN)` — без токена экземпляр не создаём */
export const bot = botToken ? new Telegraf(botToken) : undefined;

function paidKeyboard(orderId: number) {
  return {
    inline_keyboard: [
      [{ text: "✅ Я оплатил", callback_data: `paid_${orderId}` }],
    ],
  };
}

/** Реквизиты из backend (память) + кнопка «Я оплатил»; QR отдельно через sendPhoto. */
async function sendPaymentDetailsToCustomer(
  telegram: Telegraf["telegram"],
  tgId: number,
  orderId: number
): Promise<void> {
  const details = listPaymentDetails();
  const nonQr = details.filter(
    (d) => d.type.toLowerCase() !== "qr"
  );
  const qrList = details.filter(
    (d) => d.type.toLowerCase() === "qr"
  );

  const lines = nonQr.map(
    (d) => `${d.type.toUpperCase()}: ${d.value}`
  );

  let text = `💳 Оплата заказа #${orderId}\n\n💳 Реквизиты:\n\n`;
  if (lines.length > 0) {
    text += `${lines.join("\n")}\n\n`;
  } else if (qrList.length === 0) {
    text += "Реквизиты пока не настроены.\n\n";
  }
  text += "Нажмите после оплаты:";

  await telegram.sendMessage(tgId, text, {
    reply_markup: paidKeyboard(orderId),
  });

  for (const d of qrList) {
    const src = d.value.trim();
    if (!src) continue;
    try {
      await telegram.sendPhoto(tgId, src, {
        caption: "QR для оплаты",
      });
    } catch (e) {
      console.error("sendPhoto QR failed:", e);
    }
  }
}

if (bot) {
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

  bot.on("message", (ctx) => {
    console.log("USER ID:", ctx.from.id);
  });

  bot.on("callback_query", async (ctx) => {
    try {
      if (!("data" in ctx.callbackQuery)) return;

      const data = ctx.callbackQuery.data;
      if (!data) return;

      const msg = ctx.callbackQuery.message;
      if (!msg || !("text" in msg)) {
        await ctx.answerCbQuery("Сообщение недоступно");
        return;
      }

      const [action, orderIdStr] = data.split("_");
      const orderId = Number(orderIdStr);

      if (!orderIdStr || !Number.isFinite(orderId)) {
        await ctx.answerCbQuery("Неверные данные");
        return;
      }

      const order = getMemoryOrder(orderId);
      if (!order) {
        await ctx.answerCbQuery("Заказ не найден");
        return;
      }

      console.log("CALLBACK:", data, "order", orderId, "status", order.status);

      // ---------- ACCEPT (админ) ----------
      if (action === "accept") {
        if (order.status !== "NEW") {
          await ctx.answerCbQuery("Уже обработано");
          return;
        }

        setMemoryOrderStatus(orderId, "ACCEPTED");

        await ctx.editMessageText(
          `🟢 Заказ #${orderId} ПРИНЯТ`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "❌ Завершить",
                    callback_data: `done_${orderId}`,
                  },
                ],
              ],
            },
          }
        );

        const tgId = order.customerTelegramId;
        if (tgId != null) {
          await sendPaymentDetailsToCustomer(ctx.telegram, tgId, orderId);
        }

        await ctx.answerCbQuery();
        return;
      }

      // ---------- DONE (админ) ----------
      if (action === "done") {
        if (order.status === "DONE") {
          await ctx.answerCbQuery("Уже обработано");
          return;
        }
        if (order.status === "PAID_PENDING") {
          await ctx.answerCbQuery("Сначала подтвердите или отклоните оплату");
          return;
        }
        if (order.status !== "ACCEPTED" && order.status !== "CONFIRMED") {
          await ctx.answerCbQuery("Сначала примите заказ");
          return;
        }

        setMemoryOrderStatus(orderId, "DONE");

        await ctx.editMessageText(`🔴 Заказ #${orderId} ЗАВЕРШЁН`, {
          reply_markup: { inline_keyboard: [] },
        });

        await ctx.answerCbQuery();
        return;
      }

      // ---------- PAID (клиент) ----------
      if (action === "paid") {
        if (order.customerTelegramId == null) {
          await ctx.answerCbQuery("Заказ без привязки к Telegram");
          return;
        }
        if (ctx.from?.id !== order.customerTelegramId) {
          await ctx.answerCbQuery("Нет доступа");
          return;
        }
        if (order.status !== "ACCEPTED") {
          await ctx.answerCbQuery("Уже обработано");
          return;
        }

        setMemoryOrderStatus(orderId, "PAID_PENDING");

        await ctx.editMessageText(
          `💳 Оплата заказа #${orderId}\n\nЗаявка отправлена администратору. Ожидайте подтверждения.`,
          { reply_markup: { inline_keyboard: [] } }
        );

        if (!ADMIN_CHAT_ID) {
          console.error("CHAT_ID не задан — не удалось уведомить админа об оплате");
        } else {
          await ctx.telegram.sendMessage(
            ADMIN_CHAT_ID,
            `💰 Клиент оплатил\nЗаказ #${orderId}`,
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "✅ Подтвердить",
                      callback_data: `confirm_${orderId}`,
                    },
                    {
                      text: "❌ Отклонить",
                      callback_data: `reject_${orderId}`,
                    },
                  ],
                ],
              },
            }
          );
        }

        await ctx.answerCbQuery();
        return;
      }

      // ---------- CONFIRM (админ) ----------
      if (action === "confirm") {
        if (order.status !== "PAID_PENDING") {
          await ctx.answerCbQuery("Уже обработано");
          return;
        }

        setMemoryOrderStatus(orderId, "CONFIRMED");

        await ctx.editMessageText(`🟢 Заказ #${orderId} ОПЛАЧЕН`, {
          reply_markup: { inline_keyboard: [] },
        });

        await ctx.answerCbQuery();
        return;
      }

      // ---------- REJECT (админ) ----------
      if (action === "reject") {
        if (order.status !== "PAID_PENDING") {
          await ctx.answerCbQuery("Уже обработано");
          return;
        }

        setMemoryOrderStatus(orderId, "ACCEPTED");

        await ctx.editMessageText(`❌ Оплата не подтверждена\nЗаказ #${orderId}`, {
          reply_markup: { inline_keyboard: [] },
        });

        const tgId = order.customerTelegramId;
        if (tgId != null) {
          await sendPaymentDetailsToCustomer(ctx.telegram, tgId, orderId);
        }

        await ctx.answerCbQuery();
        return;
      }

      await ctx.answerCbQuery();
    } catch (error) {
      console.error("CALLBACK ERROR:", error);
      try {
        await ctx.answerCbQuery("Ошибка");
      } catch {
        /* ignore */
      }
    }
  });
}
