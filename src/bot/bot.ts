import "dotenv/config";
import { Telegraf } from "telegraf";
import type { OrderStatus } from "../server/orderStatus.js";
import { prisma } from "../server/db.js";
import { listPaymentDetailsFromDb } from "../server/paymentRepo.js";

/** Если `CHAT_ID` в env нет — подставляется chat id из последнего `/start`. */
let notifyFallbackChatId: number | undefined;

export function getNotifyTargetChatId(): string | number | undefined {
  const env = process.env.CHAT_ID;
  if (env != null && String(env).trim() !== "") {
    return String(env).trim();
  }
  return notifyFallbackChatId;
}

/** Кнопки админа для заказа из БД (Prisma). */
export function adminOrderInlineKeyboard(orderId: number) {
  return {
    inline_keyboard: [
      [
        { text: "✅ Принять", callback_data: `accept_${orderId}` },
        { text: "❌ Отклонить", callback_data: `reject_${orderId}` },
      ],
      [
        { text: "💰 Подтвердить оплату", callback_data: `confirm_${orderId}` },
        { text: "🚚 Отправлено", callback_data: `ship_${orderId}` },
      ],
    ],
  };
}

/** @deprecated используйте adminOrderInlineKeyboard */
export const adminMemoryOrderInlineKeyboard = adminOrderInlineKeyboard;

/** `new Telegraf(process.env.BOT_TOKEN)` — без токена не создаём */
export const bot = process.env.BOT_TOKEN
  ? new Telegraf(process.env.BOT_TOKEN)
  : undefined;

async function loadOrderForBot(orderId: number) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: { user: true, items: true },
  });
}

async function updateOrderStatusInDb(orderId: number, status: OrderStatus) {
  const row = await prisma.order.update({
    where: { id: orderId },
    data: { status },
    include: { user: true, items: true },
  });
  console.log("ORDER STATUS UPDATE:", orderId, status);
  return row;
}

function paidKeyboard(orderId: number) {
  return {
    inline_keyboard: [
      [{ text: "✅ Я оплатил", callback_data: `paid_${orderId}` }],
    ],
  };
}

/** Реквизиты из БД + кнопка «Я оплатил»; QR отдельно через sendPhoto. */
async function sendPaymentDetailsToCustomer(
  telegram: Telegraf["telegram"],
  tgId: number,
  orderId: number,
  intro?: string
): Promise<void> {
  const details = await listPaymentDetailsFromDb(prisma);
  const nonQr = details.filter((d) => d.type.toLowerCase() !== "qr");
  const qrList = details.filter((d) => d.type.toLowerCase() === "qr");

  const lines = nonQr.map((d) => `${d.type.toUpperCase()}: ${d.value}`);

  let text = "";
  if (intro != null && intro.trim() !== "") {
    text += `${intro.trim()}\n\n`;
  }
  text += `💳 Оплата заказа #${orderId}\n\n💳 Реквизиты:\n\n`;
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

function shipOnlyKeyboard(orderId: number) {
  return {
    inline_keyboard: [
      [{ text: "🚚 Отправлено", callback_data: `ship_${orderId}` }],
    ],
  };
}

if (bot) {
  const tgBot = bot;

  void tgBot.telegram
    .getMe()
    .then((info) => {
      console.log("BOT INFO:", info);
    })
    .catch((err) => {
      console.error("BOT ERROR:", err);
    });

  tgBot.start((ctx) => {
    const chatId = ctx.chat?.id;
    console.log("USER STARTED BOT:", chatId);
    if (chatId != null) {
      notifyFallbackChatId = chatId;
      console.log("NOTIFY_FALLBACK chat set from /start:", notifyFallbackChatId);
    }
    void ctx.reply("Бот работает ✅");
  });

  tgBot.on("message", (ctx) => {
    console.log("USER ID:", ctx.from.id);
  });

  tgBot.on("callback_query", async (ctx) => {
    try {
      if (!("data" in ctx.callbackQuery)) return;

      const data = ctx.callbackQuery.data;
      if (!data) return;

      const msg = ctx.callbackQuery.message;
      if (!msg || !("text" in msg)) {
        await ctx.answerCbQuery("Сообщение недоступно");
        return;
      }

      const underscore = data.indexOf("_");
      if (underscore < 0) {
        await ctx.answerCbQuery("Неверные данные");
        return;
      }
      const action = data.slice(0, underscore);
      const orderIdStr = data.slice(underscore + 1);
      const orderId = Number(orderIdStr);

      if (!orderIdStr || !Number.isFinite(orderId)) {
        await ctx.answerCbQuery("Неверные данные");
        return;
      }

      const row = await loadOrderForBot(orderId);
      if (!row) {
        await ctx.answerCbQuery("Заказ не найден");
        return;
      }

      const order = {
        status: row.status as OrderStatus,
        customerTelegramId: Number(row.user.telegramId),
      };

      console.log("CALLBACK:", data, "order", orderId, "status", order.status);

      // ---------- ACCEPT (админ) ----------
      if (action === "accept") {
        if (order.status !== "NEW") {
          await ctx.answerCbQuery("Уже обработано");
          return;
        }

        await updateOrderStatusInDb(orderId, "ACCEPTED");

        await ctx.editMessageText(`🟢 Заказ #${orderId} принят. Ожидаем оплату.`, {
          reply_markup: { inline_keyboard: [] },
        });

        const tgId = order.customerTelegramId;
        if (tgId != null && Number.isFinite(tgId)) {
          await sendPaymentDetailsToCustomer(
            ctx.telegram,
            tgId,
            orderId,
            "✅ Заказ принят. Оплатите по реквизитам:"
          );
        }

        await ctx.answerCbQuery();
        return;
      }

      // ---------- SHIP (админ) + legacy done ----------
      if (action === "ship" || action === "done") {
        if (order.status === "SHIPPED") {
          await ctx.answerCbQuery("Уже отправлено");
          return;
        }
        if (order.status !== "CONFIRMED") {
          await ctx.answerCbQuery("Сначала подтвердите оплату");
          return;
        }

        await updateOrderStatusInDb(orderId, "SHIPPED");

        await ctx.editMessageText(`🚚 Заказ #${orderId} отправлен`, {
          reply_markup: { inline_keyboard: [] },
        });

        const tgId = order.customerTelegramId;
        if (tgId != null && Number.isFinite(tgId)) {
          await ctx.telegram.sendMessage(tgId, "🚚 Заказ отправлен");
        }

        await ctx.answerCbQuery();
        return;
      }

      // ---------- PAID (клиент) ----------
      if (action === "paid") {
        if (!Number.isFinite(order.customerTelegramId)) {
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

        await updateOrderStatusInDb(orderId, "PAID_PENDING");

        await ctx.editMessageText(
          `💳 Оплата заказа #${orderId}\n\nЗаявка отправлена администратору. Ожидайте подтверждения.`,
          { reply_markup: { inline_keyboard: [] } }
        );

        const adminChat = getNotifyTargetChatId();
        if (adminChat == null) {
          console.error(
            "CHAT_ID не задан и не было /start — не удалось уведомить админа об оплате"
          );
        } else {
          await ctx.telegram.sendMessage(
            adminChat,
            `💳 Клиент оплатил заказ #${orderId}`,
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
          await ctx.answerCbQuery(
            order.status === "NEW"
              ? "Сначала примите заказ и дождитесь оплаты"
              : "Уже обработано"
          );
          return;
        }

        await updateOrderStatusInDb(orderId, "CONFIRMED");

        await ctx.editMessageText(`🟢 Оплата подтверждена · заказ #${orderId}`, {
          reply_markup: shipOnlyKeyboard(orderId),
        });

        const tgId = order.customerTelegramId;
        if (tgId != null && Number.isFinite(tgId)) {
          await ctx.telegram.sendMessage(tgId, "💰 Оплата подтверждена");
        }

        await ctx.answerCbQuery();
        return;
      }

      // ---------- REJECT (админ): отмена NEW или отклонение оплаты ----------
      if (action === "reject") {
        if (order.status === "NEW") {
          await updateOrderStatusInDb(orderId, "CANCELLED");

          await ctx.editMessageText(`❌ Заказ #${orderId} отклонён`, {
            reply_markup: { inline_keyboard: [] },
          });

          const tgId = order.customerTelegramId;
          if (tgId != null && Number.isFinite(tgId)) {
            await ctx.telegram.sendMessage(
              tgId,
              "❌ Заказ отклонён администратором."
            );
          }

          await ctx.answerCbQuery();
          return;
        }

        if (order.status !== "PAID_PENDING") {
          await ctx.answerCbQuery("Недоступно для этого статуса");
          return;
        }

        await updateOrderStatusInDb(orderId, "ACCEPTED");

        await ctx.editMessageText(`❌ Оплата не подтверждена\nЗаказ #${orderId}`, {
          reply_markup: { inline_keyboard: [] },
        });

        const tgId = order.customerTelegramId;
        if (tgId != null && Number.isFinite(tgId)) {
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
