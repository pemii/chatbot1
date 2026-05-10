require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Telegraf, Markup } = require("telegraf");
const {
  questions,
  tieBreakers,
  calculateResult,
  formatShortResult,
  formatFullReport
} = require("./mbti_test");
const { createPdfReport } = require("./pdf_generator");

const bot = new Telegraf(process.env.BOT_TOKEN);
const sessionsFile = path.join(__dirname, "sessions.json");

function loadSessions() {
  try {
    if (!fs.existsSync(sessionsFile)) {
      fs.writeFileSync(sessionsFile, JSON.stringify({}, null, 2));
    }
    return JSON.parse(fs.readFileSync(sessionsFile, "utf8"));
  } catch (err) {
    return {};
  }
}

function saveSessions(data) {
  fs.writeFileSync(sessionsFile, JSON.stringify(data, null, 2));
}

let sessions = loadSessions();

function getUserSession(userId) {
  if (!sessions[userId]) {
    sessions[userId] = {
      currentQuestion: 1,
      answers: {},
      stage: "idle",
      tieQueue: [],
      result: null,
      messageId: null
    };
    saveSessions(sessions);
  }
  return sessions[userId];
}

function resetSession(userId) {
  sessions[userId] = {
    currentQuestion: 1,
    answers: {},
    stage: "idle",
    tieQueue: [],
    result: null,
    messageId: null
  };
  saveSessions(sessions);
}

function getQuestionKeyboard(questionId) {
  const q = questions[questionId - 1];
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(`A) ${q.option_a}`, `answer:${questionId}:A`),
      Markup.button.callback(`B) ${q.option_b}`, `answer:${questionId}:B`)
    ],
    [
      Markup.button.callback("❌ لغو تست", "cancel_test")
    ]
  ]);
}

function getTieKeyboard(dim) {
  const q = tieBreakers[dim];
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(`A) ${q.option_a}`, `tie:${dim}:A`),
      Markup.button.callback(`B) ${q.option_b}`, `tie:${dim}:B`)
    ],
    [
      Markup.button.callback("❌ لغو تست", "cancel_test")
    ]
  ]);
}

function getResultKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("📘 گزارش کامل", "show_full_report")
    ],
    [
      Markup.button.callback("📄 دانلود PDF", "download_pdf")
    ],
    [
      Markup.button.callback("🔄 انجام مجدد تست", "restart_test")
    ]
  ]);
}

async function sendOrEditQuestion(ctx, userId) {
  const session = getUserSession(userId);
  const q = questions[session.currentQuestion - 1];
  if (!q) return;

  const text =
    `🧠 تست شخصیت\n\n` +
    `سؤال ${session.currentQuestion} از 60\n\n` +
    `${q.question}`;

  try {
    if (session.messageId) {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        session.messageId,
        undefined,
        text,
        {
          reply_markup: getQuestionKeyboard(session.currentQuestion).reply_markup
        }
      );
    } else {
      const sent = await ctx.reply(text, getQuestionKeyboard(session.currentQuestion));
      session.messageId = sent.message_id;
      saveSessions(sessions);
    }
  } catch (err) {
    const sent = await ctx.reply(text, getQuestionKeyboard(session.currentQuestion));
    session.messageId = sent.message_id;
    saveSessions(sessions);
  }
}

async function sendOrEditTieQuestion(ctx, userId, dim) {
  const session = getUserSession(userId);
  const q = tieBreakers[dim];

  const text =
    `برای دقیق‌تر شدن نتیجه، یک سؤال تکمیلی داریم:\n\n` +
    `${q.question}`;

  try {
    if (session.messageId) {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        session.messageId,
        undefined,
        text,
        {
          reply_markup: getTieKeyboard(dim).reply_markup
        }
      );
    } else {
      const sent = await ctx.reply(text, getTieKeyboard(dim));
      session.messageId = sent.message_id;
      saveSessions(sessions);
    }
  } catch (err) {
    const sent = await ctx.reply(text, getTieKeyboard(dim));
    session.messageId = sent.message_id;
    saveSessions(sessions);
  }
}

async function showFinalResult(ctx, userId) {
  const session = getUserSession(userId);
  const result = calculateResult(session.answers);

  if (result.error) {
    await ctx.reply("خطا در محاسبه نتیجه. لطفاً دوباره تلاش کنید.");
    return;
  }

  if (result.hasTies) {
    session.stage = "tie_break";
    session.tieQueue = [...result.ties];
    session.result = null;
    saveSessions(sessions);

    await sendOrEditTieQuestion(ctx, userId, session.tieQueue[0]);
    return;
  }

  session.result = result;
  session.stage = "done";
  saveSessions(sessions);

  const text = formatShortResult(result);

  try {
    if (session.messageId) {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        session.messageId,
        undefined,
        text,
        {
          reply_markup: getResultKeyboard().reply_markup
        }
      );
    } else {
      const sent = await ctx.reply(text, getResultKeyboard());
      session.messageId = sent.message_id;
      saveSessions(sessions);
    }
  } catch (err) {
    const sent = await ctx.reply(text, getResultKeyboard());
    session.messageId = sent.message_id;
    saveSessions(sessions);
  }
}

bot.start(async (ctx) => {
  const userId = ctx.from.id;
  resetSession(userId);

  const text =
    `سلام ${ctx.from.first_name || ""} 👋\n\n` +
    `به تست شخصیت خوش آمدید.\n` +
    `این آزمون شامل 60 سؤال است و حدود 10 تا 15 دقیقه زمان می‌برد.\n\n` +
    `در پایان، تیپ شخصیتی، خلاصه تحلیل و گزارش کامل دریافت می‌کنید.\n\n` +
    `برای شروع، روی دکمه زیر بزنید.`;

  await ctx.reply(
    text,
    Markup.inlineKeyboard([
      [Markup.button.callback("✅ شروع تست", "start_test")]
    ])
  );
});

bot.action("start_test", async (ctx) => {
  try { await ctx.answerCbQuery(); } catch (e) {}

  const userId = ctx.from.id;
  resetSession(userId);

  const session = getUserSession(userId);
  session.stage = "questions";
  session.currentQuestion = 1;
  saveSessions(sessions);

  await sendOrEditQuestion(ctx, userId);
});

bot.action("cancel_test", async (ctx) => {
  try { await ctx.answerCbQuery("تست لغو شد"); } catch (e) {}

  const userId = ctx.from.id;
  resetSession(userId);

  await ctx.reply(
    "❌ تست شما لغو شد.\nاگر خواستید دوباره شروع کنید، روی دکمه زیر بزنید.",
    Markup.inlineKeyboard([
      [Markup.button.callback("🔄 شروع دوباره", "start_test")]
    ])
  );
});

bot.action("restart_test", async (ctx) => {
  try { await ctx.answerCbQuery("شروع مجدد تست"); } catch (e) {}

  const userId = ctx.from.id;
  resetSession(userId);

  const session = getUserSession(userId);
  session.stage = "questions";
  session.currentQuestion = 1;
  saveSessions(sessions);

  await sendOrEditQuestion(ctx, userId);
});

bot.action(/answer:(\d+):(A|B)/, async (ctx) => {
  try { await ctx.answerCbQuery(); } catch (e) {}

  const userId = ctx.from.id;
  const session = getUserSession(userId);

  if (session.stage !== "questions") return;

  const questionId = parseInt(ctx.match[1], 10);
  const answer = ctx.match[2];

  if (questionId !== session.currentQuestion) {
    return;
  }

  session.answers[questionId] = answer;

  if (session.currentQuestion < 60) {
    session.currentQuestion += 1;
    saveSessions(sessions);
    await sendOrEditQuestion(ctx, userId);
  } else {
    saveSessions(sessions);
    await showFinalResult(ctx, userId);
  }
});

bot.action(/tie:(EI|SN|TF|JP):(A|B)/, async (ctx) => {
  try { await ctx.answerCbQuery(); } catch (e) {}

  const userId = ctx.from.id;
  const session = getUserSession(userId);

  if (session.stage !== "tie_break") return;

  const dim = ctx.match[1];
  const answer = ctx.match[2];

  if (!session.tieQueue.length || session.tieQueue[0] !== dim) {
    return;
  }

  session.answers[`tie_${dim}`] = answer;
  session.tieQueue.shift();
  saveSessions(sessions);

  if (session.tieQueue.length > 0) {
    await sendOrEditTieQuestion(ctx, userId, session.tieQueue[0]);
  } else {
    await showFinalResult(ctx, userId);
  }
});

bot.action("show_full_report", async (ctx) => {
  try { await ctx.answerCbQuery(); } catch (e) {}

  const userId = ctx.from.id;
  const session = getUserSession(userId);

  if (!session.result) {
    await ctx.reply("هنوز نتیجه‌ای برای نمایش وجود ندارد.");
    return;
  }

  const fullText = formatFullReport(session.result);
  await ctx.reply(fullText);
});

bot.action("download_pdf", async (ctx) => {
  try { await ctx.answerCbQuery("در حال آماده‌سازی PDF..."); } catch (e) {}

  const userId = ctx.from.id;
  const session = getUserSession(userId);

  if (!session.result) {
    await ctx.reply("هنوز نتیجه‌ای برای دانلود وجود ندارد.");
    return;
  }

  try {
    const filePath = await createPdfReport(session.result, userId);
    await ctx.replyWithDocument({ source: filePath });
  } catch (err) {
    console.error("PDF ERROR:", err);
    await ctx.reply("در ساخت فایل PDF خطایی رخ داد.");
  }
});

bot.command("result", async (ctx) => {
  const userId = ctx.from.id;
  const session = getUserSession(userId);

  if (!session.result) {
    await ctx.reply("هنوز نتیجه‌ای برای شما ثبت نشده است.");
    return;
  }

  await ctx.reply(formatShortResult(session.result), getResultKeyboard());
});

bot.command("help", async (ctx) => {
  await ctx.reply(
    `راهنما:\n` +
    `/start - شروع ربات\n` +
    `/result - مشاهده آخرین نتیجه\n` +
    `/help - راهنما`
  );
});

bot.catch((err, ctx) => {
  console.error("BOT ERROR:", err);
});

bot.launch().then(() => {
  console.log("Bot is running...");
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
