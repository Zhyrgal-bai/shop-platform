import { Telegraf } from "telegraf";

export const bot = new Telegraf(process.env.BOT_TOKEN!);

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

// чтобы узнать свой telegram id
bot.on("message", (ctx) => {
  console.log("USER ID:", ctx.from.id);
});

bot.launch();

console.log("Bot started 🤖");