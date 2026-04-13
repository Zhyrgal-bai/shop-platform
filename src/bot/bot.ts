import "dotenv/config";
import { Telegraf } from "telegraf";
import type { OrderStatus } from "../server/orderStatus.js";
import { prisma } from "../server/db.js";
import { listPaymentDetailsFromDb } from "../server/paymentRepo.js";
import {
  mbankOrderQrImageUrl,
  mbankPaymentQrCaption,
} from "../server/mbankQrUrl.js";

/** Если `CHAT_ID` в env нет — подставляется chat id из последнего `/start`. */
let notifyFallbackChatId: number | undefined;

export function getNotifyTargetChatId(): string | number | undefined {
  const env = process.env.CHAT_ID;
  if (env != null && String(env).trim() !== "") {
    return String(env).trim();
  }
  return notifyFallbackChatId;
}

/** Этап 2: одна строка — как в ТЗ (новый заказ + сообщение «клиент оплатил»). */
export function adminConfirmPaymentOnlyKeyboard(orderId: number) {
  return {
    inline_keyboard: [
      [
        {
          text: "💰 Подтвердить оплату",
          callback_data: `confirm_${orderId}`,
        },
      ],
    ],
  };
}

/** Этап 3: одна строка «Отправлено» (как в ТЗ). */
export function adminShipOnlyKeyboard(orderId: number) {
  return {
    inline_keyboard: [
      [{ text: "🚚 Отправлено", callback_data: `ship_${orderId}` }],
    ],
  };
}

/** Уведомление админу о новом заказе: этапы 2–3 + принять/отклонить. */
export function adminNewOrderNotifyKeyboard(orderId: number) {
  return {
    inline_keyboard: [
      ...adminConfirmPaymentOnlyKeyboard(orderId).inline_keyboard,
      [
        { text: "✅ Принять", callback_data: `accept_${orderId}` },
        { text: "❌ Отклонить", callback_data: `cancel_${orderId}` },
      ],
      ...adminShipOnlyKeyboard(orderId).inline_keyboard,
    ],
  };
}

/** @deprecated для новых заказов используйте adminNewOrderNotifyKeyboard */
export function adminOrderInlineKeyboard(orderId: number) {
  return adminNewOrderNotifyKeyboard(orderId);
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

const DEFAULT_MBANK_FALLBACK = "0556996312";

/** Кнопка «Я оплатил» после перевода в ACCEPTED. */
export function yaOpltilKeyboard(orderId: number) {
  return {
    inline_keyboard: [
      [{ text: "💰 Я оплатил", callback_data: `paid_${orderId}` }],
    ],
  };
}

async function buildAcceptedPaymentMessage(
  orderId: number,
  orderTotal: number
): Promise<{ text: string; qrUrl: string; qrCaption: string }> {
  const details = await listPaymentDetailsFromDb(prisma);
  const mbankRow = details.find((d) => d.type.toLowerCase() === "mbank");
  const mbankVal =
    mbankRow?.value?.trim() && mbankRow.value.trim().length > 0
      ? mbankRow.value.trim()
      : DEFAULT_MBANK_FALLBACK;
  const text =
    `💳 Оплата заказа #${orderId}\n\n` +
    `Сумма: ${orderTotal} сом\n\n` +
    `MBANK: ${mbankVal}\n\n` +
    `👇 После оплаты нажмите:`;
  return {
    text,
    qrUrl: mbankOrderQrImageUrl(orderTotal),
    qrCaption: mbankPaymentQrCaption(orderId, orderTotal),
  };
}

async function sendMbankAmountQrPhoto(
  telegram: Telegraf["telegram"],
  tgId: number,
  qrUrl: string,
  qrCaption: string
): Promise<void> {
  try {
    await telegram.sendPhoto(tgId, qrUrl, { caption: qrCaption });
  } catch (e) {
    console.error("sendPhoto MBANK QR failed:", e);
  }
}

/** Сообщение об оплате + кнопка «Я оплатил» (этап 1) — после ACCEPTED. */
export async function sendAcceptedPaymentPromptToTelegramUser(params: {
  telegram: Telegraf["telegram"];
  telegramUserId: number;
  orderId: number;
  orderTotal: number;
}): Promise<void> {
  const { telegram, telegramUserId, orderId, orderTotal } = params;
  const { text, qrUrl, qrCaption } = await buildAcceptedPaymentMessage(
    orderId,
    orderTotal
  );
  await telegram.sendMessage(telegramUserId, text, {
    reply_markup: yaOpltilKeyboard(orderId),
  });
  await sendMbankAmountQrPhoto(telegram, telegramUserId, qrUrl, qrCaption);
}

/** То же при смене статуса через API (нет ctx.telegram). */
export async function sendAcceptedPaymentPromptForOrderFromApi(order: {
  id: number;
  total: number;
  user: { telegramId: bigint };
}): Promise<void> {
  const tgId = Number(order.user.telegramId);
  if (!Number.isFinite(tgId) || tgId <= 0) return;
  const { text, qrUrl, qrCaption } = await buildAcceptedPaymentMessage(
    order.id,
    order.total
  );
  const token = process.env.BOT_TOKEN;
  if (!token) return;

  if (bot) {
    await bot.telegram.sendMessage(tgId, text, {
      reply_markup: yaOpltilKeyboard(order.id),
    });
    await sendMbankAmountQrPhoto(bot.telegram, tgId, qrUrl, qrCaption);
    return;
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: tgId,
          text,
          reply_markup: yaOpltilKeyboard(order.id),
        }),
      }
    );
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean };
    if (!res.ok || json.ok === false) {
      console.error("sendAcceptedPayment sendMessage failed", res.status, json);
    }
  } catch (e) {
    console.error("sendAcceptedPayment sendMessage error:", e);
  }
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${encodeURIComponent(token)}/sendPhoto`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: tgId,
          photo: qrUrl,
          caption: qrCaption,
        }),
      }
    );
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean };
    if (!res.ok || json.ok === false) {
      console.error("sendPhoto MBANK QR (http) failed", res.status, json);
    }
  } catch (e) {
    console.error("sendPhoto MBANK QR (http) error:", e);
  }
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

        const rowAfter = await updateOrderStatusInDb(orderId, "ACCEPTED");

        await ctx.editMessageText(`🟢 Заказ #${orderId} принят. Ожидаем оплату.`, {
          reply_markup: { inline_keyboard: [] },
        });

        const tgId = order.customerTelegramId;
        if (tgId != null && Number.isFinite(tgId)) {
          await sendAcceptedPaymentPromptToTelegramUser({
            telegram: ctx.telegram,
            telegramUserId: tgId,
            orderId: rowAfter.id,
            orderTotal: rowAfter.total,
          });
        }

        await ctx.answerCbQuery("Обновлено ✅");
        return;
      }

      // ---------- SHIP (админ) — callback_data: ship_${orderId} ----------
      if (action === "ship" || action === "done" || data.startsWith("ship_")) {
        if (order.status === "SHIPPED") {
          await ctx.answerCbQuery("Уже отправлено");
          return;
        }
        if (order.status !== "CONFIRMED") {
          await ctx.answerCbQuery("Сначала подтвердите оплату");
          return;
        }

        const rowAfter = await updateOrderStatusInDb(orderId, "SHIPPED");

        await ctx.editMessageText(`🚚 Заказ #${orderId} отправлен`, {
          reply_markup: { inline_keyboard: [] },
        });

        const tgId = Number(rowAfter.user.telegramId);
        if (Number.isFinite(tgId) && tgId > 0) {
          await ctx.telegram.sendMessage(
            tgId,
            `🚚 Заказ отправлен!\n\nВаш заказ #${rowAfter.id} уже в пути 📦`
          );
        }

        await ctx.answerCbQuery("Заказ отправлен 🚚");
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
            `💰 Клиент оплатил заказ #${orderId}\nПроверь оплату`,
            {
              reply_markup: {
                inline_keyboard: [
                  ...adminConfirmPaymentOnlyKeyboard(orderId).inline_keyboard,
                  [
                    {
                      text: "❌ Отклонить",
                      callback_data: `cancel_${orderId}`,
                    },
                  ],
                ],
              },
            }
          );
        }

        await ctx.answerCbQuery("Ожидайте подтверждения 🙏");
        return;
      }

      // ---------- CONFIRM (админ) — callback_data: confirm_${orderId} ----------
      if (action === "confirm" || data.startsWith("confirm_")) {
        if (order.status !== "PAID_PENDING") {
          await ctx.answerCbQuery(
            order.status === "NEW"
              ? "Сначала примите заказ и дождитесь оплаты"
              : "Уже обработано"
          );
          return;
        }

        const rowAfter = await updateOrderStatusInDb(orderId, "CONFIRMED");

        await ctx.editMessageText(`🟢 Оплата подтверждена · заказ #${orderId}`, {
          reply_markup: adminShipOnlyKeyboard(orderId),
        });

        const tgId = Number(rowAfter.user.telegramId);
        if (Number.isFinite(tgId) && tgId > 0) {
          await ctx.telegram.sendMessage(
            tgId,
            `💰 Оплата подтверждена!\n\nВаш заказ #${rowAfter.id} готовится к отправке 📦`
          );
        }

        await ctx.answerCbQuery("Оплата подтверждена ✅");
        return;
      }

      // ---------- CANCEL / REJECT (админ): отмена NEW или отклонение оплаты ----------
      if (action === "reject" || action === "cancel") {
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

          await ctx.answerCbQuery("Обновлено ✅");
          return;
        }

        if (order.status !== "PAID_PENDING") {
          await ctx.answerCbQuery("Недоступно для этого статуса");
          return;
        }

        const rowBack = await updateOrderStatusInDb(orderId, "ACCEPTED");

        await ctx.editMessageText(`❌ Оплата не подтверждена\nЗаказ #${orderId}`, {
          reply_markup: { inline_keyboard: [] },
        });

        const tgId = order.customerTelegramId;
        if (tgId != null && Number.isFinite(tgId)) {
          await sendAcceptedPaymentPromptToTelegramUser({
            telegram: ctx.telegram,
            telegramUserId: tgId,
            orderId: rowBack.id,
            orderTotal: rowBack.total,
          });
        }

        await ctx.answerCbQuery("Обновлено ✅");
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
