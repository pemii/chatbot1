require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { Pool } = require('pg');
const locations = require('./locations');

// اضافه شدن فایل‌های مدیریت تست شخصیتی و PDF
const mbtiTest = require('./mbti_test');
const pdfGenerator = require('./pdf_generator');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const BALE_TOKEN = process.env.BALE_TOKEN;
const BOT_USERNAME = process.env.BOT_USERNAME || 'YOUR_BOT_USERNAME';
// در صورت نیاز ایدی ادمین را برای دریافت فیش‌های واریزی در .env قرار دهید
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const BALE_API = `https://tapi.bale.ai/bot${BALE_TOKEN}`;

const CHANNEL_USERNAME = '@CROWCHAT_1';
const SECOND_CHANNEL_USERNAME = '@ADS_LINK2';

// قیمت تست شخصیت‌شناسی با سکه (قابل تنظیم از متغیر محیطی)
const TEST_PRICE_COINS = process.env.TEST_PRICE_COINS ? parseInt(process.env.TEST_PRICE_COINS) : 5;

const mbtiPairs = {
    'INTJ': 'ENFP', 'ENFP': 'INTJ',
    'INFJ': 'ENTP', 'ENTP': 'INFJ',
    'INFP': 'ENFJ', 'ENFJ': 'INFP',
    'INTP': 'ENTJ', 'ENTJ': 'INTP',
    'ISFJ': 'ESTP', 'ESTP': 'ISFJ',
    'ISTJ': 'ESFP', 'ESFP': 'ISTJ',
    'ISFP': 'ESFJ', 'ESFJ': 'ISFP',
    'ISTP': 'ESTJ', 'ESTJ': 'ISTP'
};

const MBTI_INFO_TEXT = `E / I: برون‌گرا / درون‌گرا
S / N: حسی و واقع‌گرا / شهودی و آینده‌نگر
T / F: منطقی / احساسی و ارزش‌محور
J / P: منظم و برنامه‌ریز / منعطف و بداهه‌پرداز

انواع ۱۶ تیپ شخصیتی MBTI:
۱. تحلیل‌گرها
INTJ: استراتژیست، مستقل، آینده‌نگر
INTP: متفکر، کنجکاو، اهل تحلیل
ENTJ: فرمانده، هدف‌گرا، مدیر
ENTP: ایده‌پرداز، بحث‌دوست، خلاق

۲. دیپلمات‌ها
INFJ: عمیق، آرمان‌گرا، حامی
INFP: خیال‌پرداز، ارزش‌محور، حساس
ENFJ: رهبر اجتماعی، الهام‌بخش، حمایتگر
ENFP: پرانرژی، خلاق، اجتماعی

۳. نگهبان‌ها
ISTJ: مسئولیت‌پذیر، دقیق، قابل اعتماد
ISFJ: مهربان، وفادار، مراقب
ESTJ: مدیر، منظم، عمل‌گرا
ESFJ: اجتماعی، حمایتگر، هماهنگ‌کننده

۴. کاوشگرها
ISTP: فنی، مستقل، آرام
ISFP: هنرمند، لطیف، آزاد
ESTP: جسور، عمل‌گرا، هیجان‌طلب
ESFP: شاد، اجتماعی، لحظه‌محور

نکته مهم: سازگاری فقط به تیپ شخصیتی بستگی ندارد. بلوغ عاطفی، سبک ارتباط، ارزش‌ها، شرایط زندگی و مهارت حل تعارض خیلی مهم‌ترند. اما در MBTI معمولاً بعضی ترکیب‌ها راحت‌تر با هم کنار می‌آیند.

سازگاری‌های رایج و خوب:
INTJ با: ENFP، ENTP، INFJ، ENTJ
INTP با: ENTJ، ENTP، INFJ، ENFP
ENTJ با: INTP، INTJ، ENFP، ENTP
ENTP با: INFJ، INTJ، ENFP، INTP
INFJ با: ENTP، ENFP، INTJ، INFP
INFP با: ENFJ، INFJ، ENFP، ISFP
ENFJ با: INFP، ISFP، INFJ، ENFP
ENFP با: INTJ، INFJ، INFP، ENTP
ISTJ با: ESFJ، ESTJ، ISFJ، ISTP
ISFJ با: ESTP، ESFP، ISTJ، ESFJ
ESTJ با: ISTJ، ISFJ، ENTJ، ESFJ
ESFJ با: ISFP، ISTJ، ISFJ، ESTJ
ISTP با: ESTJ، ESFJ، ISTJ، ISFP
ISFP با: ENFJ، ESFJ، INFP، ISTP
ESTP با: ISFJ، ISTJ، ESFP، ESTJ
ESFP با: ISFJ، ISTJ، ESFJ، ESTP

جمع‌بندی مکمل‌های طلایی:
INTJ + ENFP
INFJ + ENTP
INFP + ENFJ
INTP + ENTJ
ISFJ + ESTP
ISTJ + ESFP
ISFP + ESFJ
ISTP + ESTJ`;

const MBTI_BUY_TEXT = `تا حالا برات سوال شده چرا بعضی تصمیم‌ها رو سریع می‌گیری، چرا از بعضی جمع‌ها انرژی می‌گیری یا چرا با بعضی آدم‌ها راحت‌تر ارتباط برقرار می‌کنی؟

تست MBTI بهت کمک می‌کنه تیپ شخصیتی خودت رو بشناسی و بفهمی در ارتباطات، کار، تصمیم‌گیری و رشد فردی چه الگوهایی داری.

در گزارش نهایی دریافت می‌کنی:
- معرفی تیپ شخصیتی تو
- تحلیل کامل رفتارها و ترجیحاتت
- نقاط قوت و چالش‌های شخصیتی
- سبک ارتباطی در رابطه و کار
- تیپ‌های سازگار با تو
- پیشنهادهای کاربردی برای رشد فردی و شغلی

زمان انجام: ۱۰ تا ۱۵ دقیقه
هزینه: ${TEST_PRICE_COINS} سکه 🪙

برای شروع تست، پرداخت را انجام بده. بعد از پرداخت، لینک تست برایت فعال می‌شود.`;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function initDB() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                chat_id VARCHAR(50) NOT NULL,
                platform VARCHAR(10) NOT NULL,
                step VARCHAR(50) DEFAULT 'NONE',
                gender VARCHAR(20),
                username VARCHAR(50),
                tokens INTEGER DEFAULT 1000,
                coins INTEGER DEFAULT 20,
                score INTEGER DEFAULT 20,
                age INTEGER,
                province VARCHAR(50),
                city VARCHAR(50),
                UNIQUE(chat_id, platform)
            );
        `);

        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS partner_id INTEGER;`);
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS job VARCHAR(100);`);
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_id VARCHAR(255);`);
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS receive_anon INTEGER DEFAULT 1;`);
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS gender_edit_count INTEGER DEFAULT 0;`);
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS personality_type VARCHAR(20);`);
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS internal_username VARCHAR(20);`);

        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referrer_id INTEGER;`);
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS mbti_answers JSONB DEFAULT '[]'::jsonb;`);

        await pool.query(`UPDATE users SET internal_username = 'USER_' || id || 'X' WHERE internal_username IS NULL;`);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS followers (
                follower_id INTEGER,
                followed_id INTEGER,
                PRIMARY KEY (follower_id, followed_id)
            );
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS likes (
                liker_id INTEGER,
                liked_id INTEGER,
                PRIMARY KEY (liker_id, liked_id)
            );
        `);

        console.log("Database Ready with Advanced MBTI & Coin Features!");
    } catch (error) {
        console.error("DB Error:", error.message);
    }
}

initDB();

function toEnglishDigits(str) {
    const persianNumbers = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return str.split('').map(c => {
        let index = persianNumbers.indexOf(c);
        return index !== -1 ? index : c;
    }).join('');
}

function generateInternalUsername() {
    return 'USER_' + Math.random().toString(36).substring(2, 9).toUpperCase();
}

async function sendMessage(platform, chatId, text, replyMarkup = null) {
    const url = platform === 'telegram' ? TELEGRAM_API : BALE_API;
    const payload = { chat_id: chatId, text: text };
    if (replyMarkup) { payload.reply_markup = replyMarkup; }
    try {
        await axios.post(`${url}/sendMessage`, payload);
    } catch (error) {
        console.error(`Send Message Error (${platform}):`, error.response?.data || error.message);
    }
}

async function sendPhoto(platform, chatId, photoId, caption, replyMarkup = null) {
    const url = platform === 'telegram' ? TELEGRAM_API : BALE_API;
    const payload = { chat_id: chatId, photo: photoId, caption: caption };
    if (replyMarkup) { payload.reply_markup = replyMarkup; }
    try {
        await axios.post(`${url}/sendPhoto`, payload);
    } catch (error) {
        console.error(`Send Photo Error (${platform}):`, error.response?.data || error.message);
        await sendMessage(platform, chatId, caption, replyMarkup);
    }
}

async function answerCallback(platform, callbackQueryId, text = null) {
    const url = platform === 'telegram' ? TELEGRAM_API : BALE_API;

    try {
        const payload = {
            callback_query_id: callbackQueryId
        };

        if (text) {
            payload.text = text;
            payload.show_alert = false;
        }

        await axios.post(`${url}/answerCallbackQuery`, payload);
    } catch (error) {
        console.error(`Answer Callback Error (${platform}):`, error.response?.data || error.message);
    }
}

function getMbtiQuestions() {
    return (
        mbtiTest.questions ||
        mbtiTest.QUESTIONS ||
        mbtiTest.mbtiQuestions ||
        mbtiTest.MBTI_QUESTIONS ||
        []
    );
}

function getQuestionId(question, index) {
    return question.id || question.number || index + 1;
}

function getQuestionText(question, index) {
    return question.text || question.question || question.title || `سؤال ${index + 1}`;
}

function getOptionA(question) {
    return (
        question.optionA ||
        question.option_a ||
        question.a ||
        question.A ||
        question.answers?.A ||
        question.options?.A ||
        "گزینه A"
    );
}


function getOptionB(question) {
    return (
        question.optionB ||
        question.option_b ||
        question.b ||
        question.B ||
        question.answers?.B ||
        question.options?.B ||
        "گزینه B"
    );
}


function parseMbtiState(raw) {
    if (!raw) {
        return {
            stage: "main",
            current: 1,
            answers: {},
            tieAnswers: {},
            result: null
        };
    }

    if (Array.isArray(raw)) {
        return {
            stage: "main",
            current: 1,
            answers: {},
            tieAnswers: {},
            result: null
        };
    }

    if (typeof raw === "object") {
        return {
            stage: raw.stage || "main",
            current: raw.current || 1,
            answers: raw.answers || {},
            tieAnswers: raw.tieAnswers || {},
            result: raw.result || null
        };
    }

    try {
        const parsed = JSON.parse(raw);
        return parseMbtiState(parsed);
    } catch (e) {
        return {
            stage: "main",
            current: 1,
            answers: {},
            tieAnswers: {},
            result: null
        };
    }
}

async function saveMbtiState(userId, state) {
    await pool.query(
        "UPDATE users SET mbti_answers = $1 WHERE id = $2",
        [JSON.stringify(state), userId]
    );
}

async function startMbtiTest(platform, chatId, user) {
    const questions = getMbtiQuestions();

    if (!questions || questions.length === 0) {
        await sendMessage(
            platform,
            chatId,
            "❌ خطا: سوالات تست در فایل mbti_test.js پیدا نشد. لطفاً خروجی این فایل را بررسی کنید."
        );
        return;
    }

    const state = {
        stage: "main",
        current: 1,
        answers: {},
        tieAnswers: {},
        result: null
    };

    await pool.query(
        "UPDATE users SET step = $1, mbti_answers = $2 WHERE id = $3",
        ["MBTI_TEST_IN_PROGRESS", JSON.stringify(state), user.id]
    );

    await sendMbtiQuestion(platform, chatId, user.id, state);
}

async function sendMbtiQuestion(platform, chatId, userId, state) {
    const questions = getMbtiQuestions();
    const current = state.current || 1;
    const index = current - 1;
    const question = questions[index];

    if (!question) {
        await finishMbtiTest(platform, chatId, userId, state);
        return;
    }

    const qId = getQuestionId(question, index);
    const qText = getQuestionText(question, index);
    const optionA = getOptionA(question);
    const optionB = getOptionB(question);

    const text = `🧠 تست شخصیت‌شناسی MBTI

سؤال ${current} از ${questions.length}

${qText}

یکی از گزینه‌ها را انتخاب کن:`;

    const kb = {
        inline_keyboard: [
            [{ text: `الف) ${optionA}`, callback_data: `mbti_ans_${qId}_A` }],
            [{ text: `ب) ${optionB}`, callback_data: `mbti_ans_${qId}_B` }]
        ]
    };

    await sendMessage(platform, chatId, text, kb);
}

async function handleMbtiAnswer(platform, chatId, user, data) {
    const questions = getMbtiQuestions();

    if (!questions || questions.length === 0) {
        await sendMessage(platform, chatId, "❌ خطا: سوالات تست پیدا نشد.");
        return;
    }

    const state = parseMbtiState(user.mbti_answers);
    const parts = data.split("_");
    const questionId = parts[2];
    const answer = parts[3];

    if (!["A", "B"].includes(answer)) {
        await sendMessage(platform, chatId, "❌ پاسخ نامعتبر است.");
        return;
    }

    state.answers[questionId] = answer;
    state.current = (state.current || 1) + 1;

    await saveMbtiState(user.id, state);

    if (state.current > questions.length) {
        await finishMbtiTest(platform, chatId, user.id, state);
    } else {
        await sendMbtiQuestion(platform, chatId, user.id, state);
    }
}

async function finishMbtiTest(platform, chatId, userId, state) {
    try {
        let result;

        if (typeof mbtiTest.calculateResult === "function") {
            result = mbtiTest.calculateResult(state.answers, state.tieAnswers || {});
        } else if (typeof mbtiTest.getResult === "function") {
            result = mbtiTest.getResult(state.answers, state.tieAnswers || {});
        } else {
            await sendMessage(
                platform,
                chatId,
                "❌ خطا: تابع calculateResult در فایل mbti_test.js پیدا نشد."
            );
            return;
        }

        if (!result || result.error) {
            console.error("MBTI Result Error:", result);

            await sendMessage(
                platform,
                chatId,
                "❌ نتیجه تست قابل محاسبه نبود. احتمالاً بعضی پاسخ‌ها ثبت نشده‌اند. لطفاً دوباره تست را انجام بده."
            );

            await pool.query(
                "UPDATE users SET step = $1 WHERE id = $2",
                ["REGISTERED", userId]
            );

            return;
        }

        const finalType = result.finalType || result.type || result.mbtiType || "نامشخص";

        state.stage = "finished";
        state.result = result;

        await pool.query(
            "UPDATE users SET step = $1, personality_type = $2, mbti_answers = $3 WHERE id = $4",
            ["REGISTERED", finalType, JSON.stringify(state), userId]
        );

        let shortText;

        if (typeof mbtiTest.formatShortResult === "function") {
            shortText = mbtiTest.formatShortResult(result);
        } else {
            shortText = `✅ تست شما کامل شد.

🧠 تیپ شخصیتی شما: ${finalType}

برای دریافت جزئیات بیشتر، از دکمه‌های زیر استفاده کن.`;
        }

        if (!shortText) {
            shortText = `✅ تست شما کامل شد.

🧠 تیپ شخصیتی شما: ${finalType}

برای دریافت جزئیات بیشتر، از دکمه‌های زیر استفاده کن.`;
        }

        const kb = {
            inline_keyboard: [
                [{ text: "📄 گزارش کامل", callback_data: "mbti_full_report" }],
                [{ text: "📥 دانلود PDF", callback_data: "mbti_download_pdf" }],
                [{ text: "🔁 انجام مجدد تست", callback_data: "mbti_pay_start" }],
                [{ text: "پشتیبانی 🎧", url: "https://t.me/crow_support" }]
            ]
        };

        await sendMessage(platform, chatId, shortText, kb);
    } catch (error) {
        console.error("Finish MBTI Error:", error);
        await sendMessage(platform, chatId, "❌ هنگام محاسبه نتیجه تست خطایی رخ داد.");
    }
}


function createInlineKeyboard(items, prefix, columns = 3) {
    let keyboard = [];
    let row = [];
    for (let i = 0; i < items.length; i++) {
        row.push({ text: items[i], callback_data: prefix + items[i] });
        if (row.length === columns || i === items.length - 1) {
            keyboard.push(row);
            row = [];
        }
    }
    return { inline_keyboard: keyboard };
}

async function sendMainMenu(platform, chatId) {
    const connectBtnText = platform === 'telegram' ? 'اتصال به بله 🟢' : 'اتصال به تلگرام 🔵';
    const menu = {
        keyboard: [
            [{ text: "چت با ناشناس 👤" }],
            [{ text: "جستجوی ویژه 🔍" }, { text: "جستجوی همبازی دوز 🎮" }],
            [{ text: "پروفایل ⚙️" }, { text: "ارسال به مخاطب ✉️" }],
            [{ text: "تست شخصیتی 🧠" }, { text: "ایردراپ 💎" }],
            [{ text: "سکه 🪙" }, { text: "تبلیغ در ربات 📢" }],
            [{ text: connectBtnText }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
    };
    await sendMessage(platform, chatId, "🏠 منوی اصلی ربات:\nلطفاً یک گزینه را انتخاب کنید.", menu);
}

const skipKeyboard = {
    keyboard: [[{ text: "رد کردن ⏭" }]],
    resize_keyboard: true,
    one_time_keyboard: true
};

function usernameToUrl(platform, username) {
    const cleanUsername = username.replace('@', '');
    return platform === 'telegram' ? `https://t.me/${cleanUsername}` : `https://ble.ir/${cleanUsername}`;
}

function getJoinKeyboard(platform) {
    return {
        inline_keyboard: [
            [{ text: "📢 کانال اطلاع‌رسانی", url: usernameToUrl(platform, CHANNEL_USERNAME) }],
            [{ text: "📢 کانال دوم", url: usernameToUrl(platform, SECOND_CHANNEL_USERNAME) }],
            [{ text: "✅ بررسی عضویت", callback_data: "check_join" }]
        ]
    };
}

async function checkTelegramChannelMembership(chatId, channelUsername) {
    try {
        const response = await axios.post(`${TELEGRAM_API}/getChatMember`, {
            chat_id: channelUsername, user_id: chatId
        });
        const status = response.data?.result?.status;
        return ['member', 'administrator', 'creator'].includes(status);
    } catch (error) {
        return false;
    }
}

async function handleJoinCheck(platform, chatId, userId) {
    if (platform === 'telegram') {
        const isFirstChannelMember = await checkTelegramChannelMembership(chatId, CHANNEL_USERNAME);
        const isSecondChannelMember = await checkTelegramChannelMembership(chatId, SECOND_CHANNEL_USERNAME);

        if (!isFirstChannelMember || !isSecondChannelMember) {
            let notJoinedText = "❌ عضویت شما کامل تایید نشد.\n\n";
            if (!isFirstChannelMember) notJoinedText += "🔸 شما هنوز عضو کانال اطلاع‌رسانی نیستید.\n";
            if (!isSecondChannelMember) notJoinedText += "🔸 شما هنوز عضو کانال دوم نیستید.\n";
            notJoinedText += "\nلطفاً در هر دو کانال عضو شوید و دوباره روی «بررسی عضویت» بزنید.";
            await sendMessage(platform, chatId, notJoinedText, getJoinKeyboard(platform));
            return;
        }
    }

    await pool.query('UPDATE users SET step = $1 WHERE id = $2', ['REGISTERED', userId]);

    let u = await pool.query('SELECT referrer_id FROM users WHERE id = $1', [userId]);
    if (u.rows.length > 0 && u.rows[0].referrer_id) {
        let refId = u.rows[0].referrer_id;
        await pool.query('UPDATE users SET coins = coins + 15, tokens = tokens + 1000, score = score + 15 WHERE id = $1', [refId]);
        let refUser = await pool.query('SELECT chat_id, platform FROM users WHERE id = $1', [refId]);
        if (refUser.rows.length > 0) {
            await sendMessage(refUser.rows[0].platform, refUser.rows[0].chat_id, "🎉 کاربری که دعوت کرده بودید پروفایل خود را تکمیل کرد!\n🎁 15 سکه + 1000 توکن + 15 امتیاز دریافت کردید.");
        }
    }

    const successText = `✅ عضویت شما تایید شد.\n\n🎉 شما 1000 توکن، 20 سکه و 20 امتیاز دریافت کردید!`;
    await sendMessage(platform, chatId, "✅ عضویت شما تایید شد.", { remove_keyboard: true });
    await sendMessage(platform, chatId, successText);
    await sendMainMenu(platform, chatId);
}

async function showProfile(user, platform, chatId) {
    const anonStatus = user.receive_anon === 1 ? 'فعال ✅' : 'غیرفعال ❌';
    let caption = `👤 **پروفایل شما**\n\n`;
    caption += `📝 نام: ${user.username}\n`;
    caption += `⚧ جنسیت: ${user.gender}\n`;
    caption += `🎂 سن: ${user.age}\n`;
    caption += `📍 مکان: ${user.province} - ${user.city}\n`;
    caption += `💼 شغل: ${user.job || 'ثبت نشده'}\n`;
    caption += `🧠 تیپ شخصیتی: ${user.personality_type || 'نامشخص (از منو تست بده)'}\n\n`;
    caption += `🆔 شناسه کاربری: ${user.id}\n`;
    caption += `🔑 یوزرنیم داخلی: /${user.internal_username}`;

    const kb = {
        inline_keyboard: [
            [{ text: 'ویرایش پروفایل ✏️', callback_data: 'prof_edit_menu' }],
            [{ text: 'دنبال کننده ها 👥', callback_data: 'prof_followers' }, { text: 'دنبال شده ها 🫂', callback_data: 'prof_following' }],
            [{ text: 'لایک کننده ها ❤️', callback_data: 'prof_likers' }],
            [{ text: 'لینک ناشناس به من 🔗', callback_data: 'prof_anon_link' }],
            [{ text: `دریافت پیام ناشناس: ${anonStatus}`, callback_data: 'prof_anon_toggle' }],
            [{ text: 'موجودی من 💰', callback_data: 'prof_balance' }]
        ]
    };

    if (user.photo_id && user.photo_id !== "بدون عکس") {
        await sendPhoto(platform, chatId, user.photo_id, caption, kb);
    } else {
        await sendMessage(platform, chatId, caption, kb);
    }
}

async function handleUpdate(platform, req, res) {
    res.sendStatus(200);

    try {
        const body = req.body;
        const msg = body.message;

        if (msg) {
            const chatId = msg.chat.id.toString();
            const text = msg.text;
            const photo = msg.photo;

            if (text && text.toUpperCase() === '/RESET') {
                await pool.query('DELETE FROM users WHERE chat_id = $1 AND platform = $2', [chatId, platform]);
                await sendMessage(platform, chatId, "♻️ اطلاعات شما حذف شد. /start را بفرستید.", { remove_keyboard: true });
                return;
            }

            let userResult = await pool.query('SELECT * FROM users WHERE chat_id = $1 AND platform = $2', [chatId, platform]);

            if (userResult.rows.length === 0) {
                let referrerId = null;
                if (text && text.startsWith('/start ref_')) {
                    const possibleRef = parseInt(text.split('_')[1]);
                    if (!isNaN(possibleRef)) referrerId = possibleRef;
                }

                const intUsername = generateInternalUsername();
                await pool.query('INSERT INTO users (chat_id, platform, step, internal_username, referrer_id) VALUES ($1, $2, $3, $4, $5)', [chatId, platform, 'ASK_GENDER', intUsername, referrerId]);

                if (referrerId) {
                    await pool.query('UPDATE users SET coins = coins + 5 WHERE id = $1', [referrerId]);
                    let refUser = await pool.query('SELECT chat_id, platform FROM users WHERE id = $1', [referrerId]);
                    if (refUser.rows.length > 0) {
                        await sendMessage(refUser.rows[0].platform, refUser.rows[0].chat_id, "🎉 یک کاربر با لینک دعوت شما وارد ربات شد!\n🎁 5 سکه پاداش دریافت کردید.");
                    }
                }

                const keyboard = { inline_keyboard: [[{ text: "پسر هستم 👦", callback_data: "gender_boy" }, { text: "دختر هستم 👧", callback_data: "gender_girl" }]] };
                await sendMessage(platform, chatId, "سلام! به ربات چت ناشناس خوش اومدی.\nلطفاً جنسیت خودت رو انتخاب کن:", keyboard);
                return;
            }

            const user = userResult.rows[0];

            if (text && (text.startsWith('/USER_') || text.startsWith('USER_'))) {
                const targetUsername = text.startsWith('/') ? text.substring(1) : text;
                let pRes = await pool.query('SELECT * FROM users WHERE internal_username = $1', [targetUsername]);
                if (pRes.rows.length > 0) {
                    let target = pRes.rows[0];
                    let profileStr = `👤 **پروفایل مخاطب**\n\n📝 نام: ${target.username || 'نامشخص'}\n⚧ جنسیت: ${target.gender || 'نامشخص'}\n🎂 سن: ${target.age || 'نامشخص'}\n📍 استان: ${target.province || 'نامشخص'}\n🧠 تیپ شخصیتی: ${target.personality_type || 'ثبت نشده'}`;
                    await sendMessage(platform, chatId, profileStr);
                } else {
                    await sendMessage(platform, chatId, "❌ پروفایل این کاربر پیدا نشد.");
                }
                return;
            }

            if (user.step.startsWith('AWAIT_RECEIPT_')) {
                if (text === "❌ انصراف از خرید" || text === '/start') {
                    await pool.query('UPDATE users SET step = $1 WHERE id = $2', ['REGISTERED', user.id]);
                    await sendMessage(platform, chatId, "🛑 عملیات لغو شد.");
                    await sendMainMenu(platform, chatId);
                }
                else if (photo && photo.length > 0) {
                    await pool.query('UPDATE users SET step = $1 WHERE id = $2', ['REGISTERED', user.id]);
                    await sendMessage(platform, chatId, "✅ تصویر فیش واریزی شما دریافت شد.\n\nپس از بررسی و تأیید توسط ادمین، سکه‌های بسته خریداری‌شده به حساب شما اضافه خواهد شد.", { remove_keyboard: true });
                    await sendMainMenu(platform, chatId);

                    if (ADMIN_CHAT_ID) {
                        const amount = user.step.split('_')[2];
                        const caption = `🧾 **فیش واریزی جدید**\n\n👤 کاربر: ${user.username} (ID: ${user.id})\n💰 بسته درخواستی: ${amount} سکه\nپلتفرم: ${platform}`;
                        await sendPhoto('telegram', ADMIN_CHAT_ID, photo[photo.length - 1].file_id, caption);
                    }
                } else {
                    await sendMessage(platform, chatId, "لطفاً فقط تصویر فیش واریزی را ارسال کنید.\n\nتوجه: در این مرحله فقط ارسال عکس پذیرفته می‌شود.");
                }
                return;
            }

            if (user.step === 'ASK_USERNAME' && text) {
                const persianRegex = /^[\u0600-\u06FF\s]+$/;
                if (!persianRegex.test(text)) {
                    await sendMessage(platform, chatId, "❌ فقط حروف فارسی مجاز است.");
                    return;
                }
                await pool.query('UPDATE users SET username = $1, step = $2 WHERE id = $3', [text, 'ASK_AGE', user.id]);
                await sendMessage(platform, chatId, `✅ نام کاربری ثبت شد.\nحالا سن خودت رو وارد کن (حداقل 15 - حداکثر 80):`);
            }
            else if (user.step === 'ASK_AGE' && text) {
                const age = parseInt(toEnglishDigits(text));
                if (isNaN(age) || age < 15 || age > 80) {
                    await sendMessage(platform, chatId, "❌ لطفاً یک سن معتبر بین ۱۵ تا ۸۰ وارد کن:");
                    return;
                }
                await pool.query('UPDATE users SET age = $1, step = $2 WHERE id = $3', [age, 'ASK_PROVINCE', user.id]);
                const provinces = Object.keys(locations);
                await sendMessage(platform, chatId, `✅ سن ثبت شد.\nلطفاً استان خودت رو انتخاب کن:`, createInlineKeyboard(provinces, 'prv_', 3));
            }
            else if (user.step === 'ASK_JOB' && text) {
                let jobStr = text === "رد کردن ⏭" ? "ثبت نشده" : text;
                await pool.query('UPDATE users SET job = $1, step = $2 WHERE id = $3', [jobStr, 'ASK_PHOTO', user.id]);
                await sendMessage(platform, chatId, "📸 در صورت تمایل یک عکس برای پروفایل ارسال کن:", skipKeyboard);
            }
            else if (user.step === 'ASK_PHOTO') {
                let photoId = (photo && photo.length > 0) ? photo[photo.length - 1].file_id : "بدون عکس";
                await pool.query('UPDATE users SET photo_id = $1, step = $2 WHERE id = $3', [photoId, 'CHECK_JOIN', user.id]);
                await sendMessage(platform, chatId, "⚠️ برای استفاده از ربات، عضو کانال‌ها شوید:", getJoinKeyboard(platform));
            }
            else if (user.step === 'CHECK_JOIN' && text) {
                await sendMessage(platform, chatId, "⚠️ لطفاً ابتدا در کانال‌ها عضو شوید:", getJoinKeyboard(platform));
            }
            else if (user.step === 'EDIT_USERNAME' && text) {
                const persianRegex = /^[\u0600-\u06FF\s]+$/;
                if (!persianRegex.test(text)) {
                    await sendMessage(platform, chatId, "❌ فقط حروف فارسی مجاز است.");
                    return;
                }
                await pool.query('UPDATE users SET username = $1, step = $2 WHERE id = $3', [text, 'REGISTERED', user.id]);
                await sendMessage(platform, chatId, "✅ نام شما با موفقیت تغییر کرد.");
                await sendMainMenu(platform, chatId);
            }
            else if (user.step === 'EDIT_AGE' && text) {
                const age = parseInt(toEnglishDigits(text));
                if (isNaN(age) || age < 15 || age > 80) {
                    await sendMessage(platform, chatId, "❌ لطفاً یک سن معتبر بین ۱۵ تا ۸۰ وارد کن:");
                    return;
                }
                await pool.query('UPDATE users SET age = $1, step = $2 WHERE id = $3', [age, 'REGISTERED', user.id]);
                await sendMessage(platform, chatId, "✅ سن شما با موفقیت تغییر کرد.");
                await sendMainMenu(platform, chatId);
            }
            else if (user.step === 'MBTI_TEST_IN_PROGRESS' && text) {
                if (text === '/start' || text === '❌ انصراف از تست') {
                    await pool.query('UPDATE users SET step = $1 WHERE id = $2', ['REGISTERED', user.id]);
                    await sendMessage(platform, chatId, "🛑 تست شخصیت‌شناسی لغو شد.", { remove_keyboard: true });
                    await sendMainMenu(platform, chatId);
                } else {
                    await sendMessage(platform, chatId, "لطفاً پاسخ هر سؤال را فقط از طریق دکمه‌های زیر همان سؤال انتخاب کن.");
                }
                return;
            }
            else if (user.step === 'REGISTERED' && text) {
                if (text.startsWith('/start')) {
                    await sendMainMenu(platform, chatId);
                }
                else if (text === "چت با ناشناس 👤") {
                    let partnerResult = await pool.query('SELECT * FROM users WHERE step = $1 AND id != $2 LIMIT 1', ['SEARCHING', user.id]);
                    if (partnerResult.rows.length > 0) {
                        let partner = partnerResult.rows[0];
                        await pool.query('UPDATE users SET step = $1, partner_id = $2 WHERE id = $3', ['CHATTING', partner.id, user.id]);
                        await pool.query('UPDATE users SET step = $1, partner_id = $2 WHERE id = $3', ['CHATTING', user.id, partner.id]);

                        const chatKeyboard = {
                            keyboard: [
                                [{ text: "مشاهده پروفایل مخاطب 👤" }, { text: "بازی دوز با مخاطب 🎮" }],
                                [{ text: "پایان چت ❌" }]
                            ],
                            resize_keyboard: true
                        };

                        const userSafeMsg = `🎉 چت با ${partner.username} شروع شد - بهش /سلام کن\n\n⚠️ برای حفظ امنیت خود به هیچ کس اعتماد نکنید. مسئولیت هرگونه سوءاستفاده برعهده ی کاربر است.`;
                        const partnerSafeMsg = `🎉 چت با ${user.username} شروع شد - بهش /سلام کن\n\n⚠️ برای حفظ امنیت خود به هیچ کس اعتماد نکنید. مسئولیت هرگونه سوءاستفاده برعهده ی کاربر است.`;

                        await sendMessage(platform, chatId, userSafeMsg, chatKeyboard);
                        await sendMessage(partner.platform, partner.chat_id, partnerSafeMsg, chatKeyboard);
                    } else {
                        await pool.query('UPDATE users SET step = $1 WHERE id = $2', ['SEARCHING', user.id]);
                        await sendMessage(platform, chatId, "⏳ در حال جستجوی یک فرد ناشناس...", { keyboard: [[{ text: "❌ انصراف از جستجو" }]], resize_keyboard: true });
                    }
                }
                else if (text === "پروفایل ⚙️") {
                    await showProfile(user, platform, chatId);
                }
                else if (text === "تست شخصیتی 🧠") {
                    const kb = {
                        inline_keyboard: [
                            [{ text: "توضیحات تیپ شخصیتی 📖", callback_data: "mbti_info" }],
                            [{ text: "انتخاب تیپ شخصیتی 🎯", callback_data: "mbti_select_menu" }],
                            [{ text: "تیپمو نمیدونم میخوام تستشو بدم 🛒", callback_data: "mbti_buy_test" }]
                        ]
                    };
                    await sendMessage(platform, chatId, "بخش شخصیت‌شناسی MBTI:\nیک گزینه را انتخاب کنید:", kb);
                }
                else if (text === "سکه 🪙") {
                    const kb = {
                        inline_keyboard: [
                            [{ text: "🛒 خرید سکه", callback_data: "coin_buy" }],
                            [{ text: "👥 دریافت سکه از طریق دعوت", callback_data: "coin_invite" }]
                        ]
                    };
                    await sendMessage(platform, chatId, "بخش سکه 🪙\nیک گزینه را انتخاب کنید:", kb);
                }
                else if (text === "جستجوی ویژه 🔍") {
                    const kb = {
                        inline_keyboard: [
                            [{ text: 'هم استانی ها 📍', callback_data: 'advsearch_province' }],
                            [{ text: 'همسن 🎂', callback_data: 'advsearch_age' }],
                            [{ text: 'تیپ شخصیتی 🧠', callback_data: 'advsearch_personality' }]
                        ]
                    };
                    await sendMessage(platform, chatId, "🔍 به چه کسی میخوای وصل بشی؟", kb);
                }
                else {
                    await sendMessage(platform, chatId, "این بخش در حال توسعه است...");
                }
            }
            else if (user.step === 'SEARCHING' && text) {
                if (text === "❌ انصراف از جستجو" || text === '/start') {
                    await pool.query('UPDATE users SET step = $1 WHERE id = $2', ['REGISTERED', user.id]);
                    await sendMessage(platform, chatId, "🛑 جستجو لغو شد.");
                    await sendMainMenu(platform, chatId);
                } else {
                    await sendMessage(platform, chatId, "⏳ هنوز در حال جستجو هستیم... (برای لغو دکمه زیر را بزنید)");
                }
            }
            else if (user.step === 'CHATTING' && text) {
                if (text === "پایان چت ❌" || text === "پایان چت") {
                    const kb = {
                        inline_keyboard: [
                            [{ text: "اره ببند", callback_data: "confirm_end_chat" }, { text: "نه اشتباه شد", callback_data: "cancel_end_chat" }]
                        ]
                    };
                    await sendMessage(platform, chatId, "مطمئنی میخوای چت رو ببندی؟", kb);
                }
                else if (text === "مشاهده پروفایل مخاطب 👤" || text === "مشاهده پروفایل مخاطب") {
                    if (user.partner_id) {
                        let pRes = await pool.query('SELECT * FROM users WHERE id = $1', [user.partner_id]);
                        if (pRes.rows.length > 0) {
                            let partner = pRes.rows[0];
                            let profileStr = `👤 **پروفایل مخاطب**\n\n📝 نام: ${partner.username}\n⚧ جنسیت: ${partner.gender}\n🎂 سن: ${partner.age}\n📍 مکان: ${partner.province}\n🧠 تیپ شخصیتی: ${partner.personality_type || 'ثبت نشده'}\n\nبرای مشاهده کامل پروفایل بزنید: /${partner.internal_username}`;
                            await sendMessage(platform, chatId, profileStr);

                            await sendMessage(partner.platform, partner.chat_id, `👀 ${user.username} ( /${user.internal_username} ) پروفایل شما را مشاهده کرد.`);
                        }
                    }
                }
                else if (text === "بازی دوز با مخاطب 🎮" || text === "بازی دوز با مخاطب") {
                    await sendMessage(platform, chatId, "🎮 بازی دوز دو نفره به زودی فعال می‌شود...");
                }
                else if (user.partner_id) {
                    let pRes = await pool.query('SELECT * FROM users WHERE id = $1', [user.partner_id]);
                    if (pRes.rows.length > 0) {
                        await sendMessage(pRes.rows[0].platform, pRes.rows[0].chat_id, `💬 ناشناس:\n${text}`);
                    }
                }
            }
        }
        else if (body.callback_query) {
            const query = body.callback_query;
            const chatId = query.message.chat.id.toString();
            const data = query.data;

            let userResult = await pool.query('SELECT * FROM users WHERE chat_id = $1 AND platform = $2', [chatId, platform]);

            if (userResult.rows.length > 0) {
                const user = userResult.rows[0];

                await answerCallback(platform, query.id);

                if (data && data.startsWith("mbti_ans_")) {
                    if (user.step !== "MBTI_TEST_IN_PROGRESS") {
                        await sendMessage(platform, chatId, "❌ در حال حاضر تست فعالی برای شما وجود ندارد.");
                        return;
                    }

                    await handleMbtiAnswer(platform, chatId, user, data);
                    return;
                }

                if (data === "mbti_full_report") {
                    const state = parseMbtiState(user.mbti_answers);

                    if (!state.result) {
                        await sendMessage(platform, chatId, "❌ گزارش کاملی برای شما پیدا نشد. لطفاً ابتدا تست را انجام دهید.");
                        return;
                    }

                    let fullReportText;

                    if (typeof mbtiTest.formatFullReport === "function") {
                        fullReportText = mbtiTest.formatFullReport(state.result);
                    } else {
                        const finalType = state.result.finalType || state.result.type || "نامشخص";
                        fullReportText = `📄 گزارش کامل تست

تیپ شخصیتی شما: ${finalType}

گزارش کامل برای این تیپ در فایل mbti_test.js قابل تنظیم است.`;
                    }

                    await sendMessage(platform, chatId, fullReportText);
                    return;
                }

                if (data === "mbti_download_pdf") {
                    const state = parseMbtiState(user.mbti_answers);

                    if (!state.result) {
                        await sendMessage(platform, chatId, "❌ نتیجه‌ای برای ساخت PDF پیدا نشد. لطفاً ابتدا تست را انجام دهید.");
                        return;
                    }

                    try {
                        const filePath = await pdfGenerator.createPdfReport(state.result, user.id);

                        await sendMessage(
                            platform,
                            chatId,
                            `✅ فایل PDF ساخته شد.

مسیر فایل روی سرور:
${filePath}

برای ارسال مستقیم PDF به تلگرام، باید تابع sendDocument هم اضافه شود.`
                        );
                    } catch (error) {
                        console.error("PDF Error:", error);
                        await sendMessage(platform, chatId, "❌ هنگام ساخت PDF خطایی رخ داد.");
                    }

                    return;
                }

                if (user.step === 'ASK_GENDER' || user.step === 'EDIT_GENDER') {
                    const gender = data === 'gender_boy' ? 'پسر' : 'دختر';
                    if (user.step === 'EDIT_GENDER') {
                        await pool.query('UPDATE users SET gender = $1, step = $2, gender_edit_count = gender_edit_count + 1 WHERE id = $3', [gender, 'REGISTERED', user.id]);
                        await sendMessage(platform, chatId, `✅ جنسیت شما به (${gender}) تغییر یافت.`);
                        await sendMainMenu(platform, chatId);
                    } else {
                        await pool.query('UPDATE users SET gender = $1, step = $2 WHERE id = $3', [gender, 'ASK_USERNAME', user.id]);
                        await sendMessage(platform, chatId, `✅ جنسیت ثبت شد.\nیک نام کاربری فارسی انتخاب کن:`);
                    }
                }
                else if (user.step === 'ASK_PROVINCE' && data.startsWith('prv_')) {
                    const province = data.replace('prv_', '');
                    await pool.query('UPDATE users SET province = $1, step = $2 WHERE id = $3', [province, 'ASK_CITY', user.id]);
                    await sendMessage(platform, chatId, `✅ استان ثبت شد.\nشهر خودت رو انتخاب کن:`, createInlineKeyboard(locations[province] || [], 'cty_', 3));
                }
                else if (user.step === 'ASK_CITY' && data.startsWith('cty_')) {
                    const city = data.replace('cty_', '');
                    await pool.query('UPDATE users SET city = $1, step = $2 WHERE id = $3', [city, 'ASK_JOB', user.id]);
                    await sendMessage(platform, chatId, `🎉 عالی! شهر ثبت شد.\n💼 حالا شغل خودت رو تایپ کن:`, skipKeyboard);
                }
                else if (user.step === 'CHECK_JOIN' && data === 'check_join') {
                    await handleJoinCheck(platform, chatId, user.id);
                }

                else if (data === 'confirm_end_chat') {
                    if (user.step === 'CHATTING') {
                        await pool.query('UPDATE users SET step = $1, partner_id = NULL WHERE id = $2', ['REGISTERED', user.id]);
                        await sendMessage(platform, chatId, "🔴 چت پایان یافت.", { remove_keyboard: true });
                        await sendMainMenu(platform, chatId);

                        if (user.partner_id) {
                            let pRes = await pool.query('SELECT * FROM users WHERE id = $1', [user.partner_id]);
                            if (pRes.rows.length > 0) {
                                let partner = pRes.rows[0];
                                await pool.query('UPDATE users SET step = $1, partner_id = NULL WHERE id = $2', ['REGISTERED', partner.id]);
                                await sendMessage(partner.platform, partner.chat_id, "🔴 طرف مقابل چت را ترک کرد.", { remove_keyboard: true });
                                await sendMainMenu(partner.platform, partner.chat_id);
                            }
                        }
                    }
                }
                else if (data === 'cancel_end_chat') {
                    await sendMessage(platform, chatId, "✅ انصراف از خروج. به چت خود ادامه دهید...");
                }

                else if (data === 'mbti_info') {
                    await sendMessage(platform, chatId, MBTI_INFO_TEXT);
                }
                else if (data === 'mbti_select_menu') {
                    const types = ['INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP', 'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP'];
                    const kb = createInlineKeyboard(types, 'mbtiset_', 4);
                    await sendMessage(platform, chatId, "تیپ شخصیتی خود را از لیست زیر انتخاب کنید:", kb);
                }
                else if (data.startsWith('mbtiset_')) {
                    const type = data.replace('mbtiset_', '');
                    await pool.query('UPDATE users SET personality_type = $1 WHERE id = $2', [type, user.id]);
                    await sendMessage(platform, chatId, `✅ تیپ شخصیتی (${type}) در پروفایل شما ثبت شد.`);
                }
                else if (data === 'mbti_buy_test') {
                    const kb = {
                        inline_keyboard: [
                            [{ text: `پرداخت ${TEST_PRICE_COINS} سکه و شروع تست 🪙`, callback_data: "mbti_pay_start" }],
                            [{ text: "پشتیبانی 🎧", url: "https://t.me/crow_support" }]
                        ]
                    };
                    await sendMessage(platform, chatId, MBTI_BUY_TEXT, kb);
                }
                else if (data === 'mbti_pay_start') {
                    if (user.coins >= TEST_PRICE_COINS) {
                        await pool.query(
                            'UPDATE users SET coins = coins - $1, step = $2, mbti_answers = $3 WHERE id = $4',
                            [
                                TEST_PRICE_COINS,
                                'MBTI_TEST_IN_PROGRESS',
                                JSON.stringify({
                                    stage: "main",
                                    current: 1,
                                    answers: {},
                                    tieAnswers: {},
                                    result: null
                                }),
                                user.id
                            ]
                        );

                        const kbCancel = {
                            keyboard: [[{ text: "❌ انصراف از تست" }]],
                            resize_keyboard: true
                        };

                        await sendMessage(
                            platform,
                            chatId,
                            `✅ مبلغ ${TEST_PRICE_COINS} سکه از حساب شما کسر شد و تست آغاز گردید.`,
                            kbCancel
                        );

                        const updatedUserResult = await pool.query(
                            'SELECT * FROM users WHERE id = $1',
                            [user.id]
                        );

                        const updatedUser = updatedUserResult.rows[0];

                        await startMbtiTest(platform, chatId, updatedUser);
                    } else {
                        await sendMessage(
                            platform,
                            chatId,
                            `❌ موجودی سکه شما برای انجام این تست کافی نیست.

نیاز به ${TEST_PRICE_COINS} سکه داری.
لطفاً از منوی اصلی، بخش «سکه 🪙» اقدام به دریافت یا خرید سکه کن.`
                        );
                    }
                }

                else if (data === 'coin_invite') {
                    const botLink = platform === 'telegram' ? `https://t.me/${BOT_USERNAME}?start=ref_${user.id}` : `https://ble.ir/${BOT_USERNAME}?start=ref_${user.id}`;

                    const inviteText1 = `با دعوت از دوستانت، هم به آن‌ها یک تجربه متفاوت معرفی کن و هم جایزه بگیر 🎉

اینجا می‌تونی بر اساس تیپ شخصیتی‌ات هم‌صحبت پیدا کنی، بازی کنی، جایزه بگیری، در ایردراپ شرکت کنی و توکن دریافت کنی.

با جمع‌کردن امتیاز در رقابت 100 روزه، شانس خودت را در قرعه‌کشی هم امتحان کن.

لینک دعوت شما:
${botLink}`;

                    const inviteText2 = `🎁 پاداش دعوت:

• هر دعوت موفق = 5 سکه
• تکمیل پروفایل توسط کاربر دعوت‌شده = 15 سکه + 1000 توکن ایردراپ + 15 امتیاز`;

                    await sendMessage(platform, chatId, inviteText1);
                    await sendMessage(platform, chatId, inviteText2);
                }
                else if (data === 'coin_buy') {
                    const kb = {
                        inline_keyboard: [
                            [{ text: "120 سکه — 90 هزار تومان", callback_data: "buy_pkg_120_90" }],
                            [{ text: "160 سکه — 115 هزار تومان", callback_data: "buy_pkg_160_115" }],
                            [{ text: "200 سکه — 135 هزار تومان", callback_data: "buy_pkg_200_135" }],
                            [{ text: "250 سکه — 160 هزار تومان", callback_data: "buy_pkg_250_160" }]
                        ]
                    };
                    await sendMessage(platform, chatId, "بسته‌های خرید سکه 🛒:", kb);
                }
                else if (data.startsWith('buy_pkg_')) {
                    const parts = data.split('_');
                    const coinsAmount = parts[2];
                    const priceK = parts[3];

                    const text = `برای خرید بسته ${coinsAmount} سکه، مبلغ ${priceK} هزار تومان را به شماره کارت زیر واریز کنید و سپس تصویر فیش واریزی را ارسال نمایید.

پس از بررسی و تأیید پرداخت، سکه‌های بسته به حساب شما اضافه خواهد شد.

شماره کارت:
6219861964486582
به نام: عبداللهی`;

                    const kb = {
                        inline_keyboard: [[{ text: "✅ پرداخت کردم", callback_data: `paid_pkg_${coinsAmount}` }]]
                    };
                    await sendMessage(platform, chatId, text, kb);
                }
                else if (data.startsWith('paid_pkg_')) {
                    const coinsAmount = data.split('_')[2];
                    await pool.query('UPDATE users SET step = $1 WHERE id = $2', [`AWAIT_RECEIPT_${coinsAmount}`, user.id]);

                    const text = `لطفاً تصویر فیش واریزی را ارسال کنید.

توجه: در این مرحله فقط ارسال عکس پذیرفته می‌شود.`;
                    const cancelKb = { keyboard: [[{ text: "❌ انصراف از خرید" }]], resize_keyboard: true };
                    await sendMessage(platform, chatId, text, cancelKb);
                }

                else if (data === 'prof_edit_menu') {
                    const genderLimitStr = user.gender_edit_count >= 1 ? '❌ (قفل شد)' : '✏️';
                    const kb = {
                        inline_keyboard: [
                            [{ text: 'ویرایش نام', callback_data: 'edit_name' }, { text: 'ویرایش سن', callback_data: 'edit_age' }],
                            [{ text: 'ویرایش استان و شهر', callback_data: 'edit_location' }, { text: 'ویرایش عکس', callback_data: 'edit_photo' }],
                            [{ text: `ویرایش جنسیت ${genderLimitStr}`, callback_data: 'edit_gender' }],
                            [{ text: 'بازگشت به پروفایل 🔙', callback_data: 'prof_back' }]
                        ]
                    };
                    await sendMessage(platform, chatId, "⚙️ انتخاب کنید کدام بخش ویرایش شود:", kb);
                }
                else if (data === 'prof_back') {
                    await showProfile(user, platform, chatId);
                }
                else if (data === 'prof_anon_toggle') {
                    const newValue = user.receive_anon === 1 ? 0 : 1;
                    await pool.query(`UPDATE users SET receive_anon = $1 WHERE id = $2`, [newValue, user.id]);
                    user.receive_anon = newValue;
                    await showProfile(user, platform, chatId);
                }
                else if (data === 'prof_anon_link') {
                    const link = platform === 'telegram' ? `https://t.me/${BOT_USERNAME}?start=anon_${user.id}` : `https://ble.ir/${BOT_USERNAME}?start=anon_${user.id}`;
                    await sendMessage(platform, chatId, `🔗 لینک پیام ناشناس اختصاصی شما:\n\n${link}\n\nاین لینک را در شبکه‌های اجتماعی خود قرار دهید.`);
                }
                else if (data === 'prof_balance') {
                    await sendMessage(platform, chatId, `💰 **موجودی شما:**\n\n🪙 سکه: ${user.coins}\n💎 توکن ایردراپ: ${user.tokens}`);
                }

                else if (data === 'edit_name') {
                    await pool.query('UPDATE users SET step = $1 WHERE id = $2', ['EDIT_USERNAME', user.id]);
                    await sendMessage(platform, chatId, "لطفاً نام کاربری جدید خود را (فقط فارسی) وارد کنید:", { remove_keyboard: true });
                }
                else if (data === 'edit_age') {
                    await pool.query('UPDATE users SET step = $1 WHERE id = $2', ['EDIT_AGE', user.id]);
                    await sendMessage(platform, chatId, "لطفاً سن جدید خود را به عدد وارد کنید:", { remove_keyboard: true });
                }
                else if (data === 'edit_gender') {
                    if (user.gender_edit_count >= 1) {
                        await sendMessage(platform, chatId, "❌ شما قبلاً یک بار جنسیت خود را تغییر داده‌اید.");
                    } else {
                        await pool.query('UPDATE users SET step = $1 WHERE id = $2', ['EDIT_GENDER', user.id]);
                        const kb = { inline_keyboard: [[{ text: "پسر 👦", callback_data: "gender_boy" }, { text: "دختر 👧", callback_data: "gender_girl" }]] };
                        await sendMessage(platform, chatId, "لطفاً جنسیت صحیح خود را انتخاب کنید (فقط همین یک بار امکان پذیر است):", kb);
                    }
                }

                else if (data.startsWith('advsearch_')) {
                    const searchMode = data.split('_')[1];

                    if (searchMode === 'personality') {
                        if (!user.personality_type) {
                            await sendMessage(platform, chatId, "❌ شما هنوز تیپ شخصیتی خود را ثبت نکرده‌اید. لطفاً ابتدا از منوی تست شخصیتی اقدام کنید.");
                            return;
                        }
                    }

                    const kb = {
                        inline_keyboard: [
                            [{ text: 'فقط دختر 👧', callback_data: `dosearch_${searchMode}_female` }, { text: 'فقط پسر 👦', callback_data: `dosearch_${searchMode}_male` }],
                            [{ text: 'همه 👫', callback_data: `dosearch_${searchMode}_all` }]
                        ]
                    };
                    await sendMessage(platform, chatId, "دنبال چه جنسیتی هستی؟", kb);
                }
                else if (data.startsWith('dosearch_')) {
                    const parts = data.split('_');
                    const searchMode = parts[1];
                    const targetGenderCode = parts[2];

                    let targetGenderText = "همه";
                    if (targetGenderCode === 'male') targetGenderText = "پسر";
                    if (targetGenderCode === 'female') targetGenderText = "دختر";

                    let msgText = `🔍 در حال جستجوی کاربران (${searchMode}) با فیلتر جنسیت (${targetGenderText})...`;

                    if (searchMode === 'personality') {
                        const myType = user.personality_type;
                        const targetType = mbtiPairs[myType];
                        msgText = `🔍 شما تیپ ${myType} هستید. در حال جستجو برای تیپ مکمل شما ( ${targetType} ) با فیلتر جنسیت (${targetGenderText})...`;
                    }

                    await pool.query('UPDATE users SET step = $1 WHERE id = $2', ['SEARCHING', user.id]);
                    const cancelKb = { keyboard: [[{ text: "❌ انصراف از جستجو" }]], resize_keyboard: true };
                    await sendMessage(platform, chatId, msgText, cancelKb);
                }
            }
        }
    } catch (error) {
        console.error("Handler Error:", error.message);
    }
}

app.post('/webhook/telegram', (req, res) => handleUpdate('telegram', req, res));
app.post('/webhook/bale', (req, res) => handleUpdate('bale', req, res));

app.get('/', (req, res) => {
    res.send('Bot Server is Running! (Advanced MBTI Search & Coin/Referral Features Added)');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
