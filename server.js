require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { Pool } = require('pg');
const fs = require('fs');
const FormData = require('form-data');
const pdfGenerator = require('./pdf_generator'); // فایل PDF ساز شما

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const BALE_TOKEN = process.env.BALE_TOKEN;

// دیتابیس
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// سوالات نمونه MBTI (برای تست)
const MBTI_QUESTIONS = [
    { id: 1, q: "در یک مهمانی، شما معمولاً...", options: { A: "با افراد جدید صحبت میکنم", B: "با کسانی که میشناسم میمانم" } },
    { id: 2, q: "شما ترجیح میدهید...", options: { A: "واقع‌بین باشید", B: "خیال‌پرداز باشید" } }
];

// ==========================================
// 1. راه اندازی دیتابیس
// ==========================================
async function initDB() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                chat_id VARCHAR(50) UNIQUE,
                platform VARCHAR(20),
                username VARCHAR(100),
                first_name VARCHAR(100),
                coins INT DEFAULT 10,
                step VARCHAR(50) DEFAULT 'IDLE',
                mbti_type VARCHAR(10),
                mbti_answers TEXT,
                temp_data TEXT
            );
            
            -- جدول جدید برای مدیریت پیام های مخاطبین و رسید خوانده شدن
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                sender_chat_id VARCHAR(50),
                receiver_chat_id VARCHAR(50),
                content TEXT,
                status VARCHAR(20) DEFAULT 'pending',
                sender_paid BOOLEAN,
                platform VARCHAR(20)
            );
        `);
        console.    log("✅ دیتابیس آماده است.");
    } finally {
        client.release();
    }
}
initDB();

// ==========================================
// 2. توابع ارتباطی تلگرام و بله
// ==========================================
async function sendMessage(platform, chatId, text, replyMarkup = null) {
    const token = platform === 'telegram' ? TELEGRAM_TOKEN : BALE_TOKEN;
    const url = platform === 'telegram' 
        ? `https://api.telegram.org/bot${token}/sendMessage`
        : `https://tapi.bale.ai/bot${token}/sendMessage`;

    const payload = { chat_id: chatId, text: text, parse_mode: 'HTML' };
    if (replyMarkup) payload.reply_markup = replyMarkup;

    try { await axios.post(url, payload); } 
    catch (e) { console.error("Error sendMessage:", e.message); }
}

// تابع جدید برای ویرایش پیام (برای تست MBTI)
async function editMessageText(platform, chatId, messageId, text, replyMarkup = null) {
    const token = platform === 'telegram' ? TELEGRAM_TOKEN : BALE_TOKEN;
    const url = platform === 'telegram' 
        ? `https://api.telegram.org/bot${token}/editMessageText`
        : `https://tapi.bale.ai/bot${token}/editMessageText`;

    const payload = { chat_id: chatId, message_id: messageId, text: text, parse_mode: 'HTML' };
    if (replyMarkup) payload.reply_markup = replyMarkup;

    try { await axios.post(url, payload); } 
    catch (e) { console.error("Error editMessageText:", e.message); }
}

// تابع جدید برای ارسال فایل PDF
async function sendDocument(platform, chatId, filePath, caption = "") {
    const token = platform === 'telegram' ? TELEGRAM_TOKEN : BALE_TOKEN;
    const url = platform === 'telegram' 
        ? `https://api.telegram.org/bot${token}/sendDocument`
        : `https://tapi.bale.ai/bot${token}/sendDocument`;

    try {
        const form = new FormData();
        form.append('chat_id', chatId);
        form.append('document', fs.createReadStream(filePath));
        if (caption) form.append('caption', caption);

        await axios.post(url, form, { headers: form.getHeaders() });
    } catch (e) { console.error("Error sendDocument:", e.message); }
}

async function answerCallback(platform, callbackQueryId, text, showAlert = false) {
    const token = platform === 'telegram' ? TELEGRAM_TOKEN : BALE_TOKEN;
    const url = platform === 'telegram' 
        ? `https://api.telegram.org/bot${token}/answerCallbackQuery`
        : `https://tapi.bale.ai/bot${token}/answerCallbackQuery`;
    try { await axios.post(url, { callback_query_id: callbackQueryId, text: text, show_alert: showAlert }); } 
    catch (e) { /* ignore */ }
}

async function sendMainMenu(platform, chatId) {
    const keyboard = {
        keyboard: [
            [{ text: "ارسال به مخاطب ✉️" }, { text: "تست شخصیتی 🧠" }],
            [{ text: "جستجوی ویژه 🔍" }, { text: "چت با ناشناس 👤" }],
            [{ text: "پروفایل من 👤" }]
        ],
        resize_keyboard: true
    };
    await sendMessage(platform, chatId, "به منوی اصلی خوش آمدید:", keyboard);
}

// ==========================================
// 3. منطق MBTI (ویرایش در همان پیام + ارسال PDF)
// ==========================================
async function startMbtiTest(platform, chatId, user) {
    const state = { current: 0, answers: {} };
    await pool.query("UPDATE users SET step = $1, mbti_answers = $2 WHERE chat_id = $3", 
        ['MBTI_TEST_IN_PROGRESS', JSON.stringify(state), chatId]);
    
    // ارسال پیام اولیه که بعداً ویرایش میشود
    const q = MBTI_QUESTIONS[0];
    const text = `🧠 سوال 1 از ${MBTI_QUESTIONS.length}:\n\n${q.q}`;
    const keyboard = {
        inline_keyboard: [
            [{ text: q.options.A, callback_data: `mbti_ans_0_A` }],
            [{ text: q.options.B, callback_data: `mbti_ans_0_B` }]
        ]
    };
    await sendMessage(platform, chatId, text, keyboard);
}

async function handleMbtiAnswer(platform, chatId, user, data, messageId) {
    const parts = data.split('_');
    const answer = parts[3]; // A or B
    let state = JSON.parse(user.mbti_answers || '{"current":0, "answers":{}}');
    
    state.answers[state.current] = answer;
    state.current++;

    await pool.query("UPDATE users SET mbti_answers = $1 WHERE chat_id = $2", [JSON.stringify(state), chatId]);

    if (state.current < MBTI_QUESTIONS.length) {
        const q = MBTI_QUESTIONS[state.current];
        const text = `🧠 سوال ${state.current + 1} از ${MBTI_QUESTIONS.length}:\n\n${q.q}`;
        const keyboard = {
            inline_keyboard: [
                [{ text: q.options.A, callback_data: `mbti_ans_${state.current}_A` }],
                [{ text: q.options.B, callback_data: `mbti_ans_${state.current}_B` }]
            ]
        };
        // ویرایش پیام قبلی
        await editMessageText(platform, chatId, messageId, text, keyboard);
    } else {
        await editMessageText(platform, chatId, messageId, "⏳ در حال پردازش نتیجه شما...");
        await finishMbtiTest(platform, chatId, user, state, messageId);
    }
}

async function finishMbtiTest(platform, chatId, user, state, messageId) {
    // محاسبه نمایشی
    const resultType = "INTJ"; 
    await pool.query("UPDATE users SET step = 'IDLE', mbti_type = $1 WHERE chat_id = $2", [resultType, chatId]);
    
    const text = `🎉 تست تمام شد!\nتیپ شخصیتی شما: ${resultType}`;
    const keyboard = {
        inline_keyboard: [[{ text: "دریافت PDF نتیجه 📥", callback_data: "mbti_download_pdf" }]]
    };
    await editMessageText(platform, chatId, messageId, text, keyboard);
}

// ==========================================
// 4. مدیریت پیام‌ها (Text)
// ==========================================
async function handleMessage(platform, message) {
    const chatId = message.chat.id.toString();
    const text = message.text || '';
    const username = message.from.username || '';

    let res = await pool.query("SELECT * FROM users WHERE chat_id = $1 AND platform = $2", [chatId, platform]);
    if (res.rows.length === 0) {
        await pool.query("INSERT INTO users (chat_id, platform, username) VALUES ($1, $2, $3)", [chatId, platform, username]);
        res = await pool.query("SELECT * FROM users WHERE chat_id = $1", [chatId]);
    }
    const user = res.rows[0];

    if (text === '/start') {
        await pool.query("UPDATE users SET step = 'IDLE' WHERE chat_id = $1", [chatId]);
        await sendMainMenu(platform, chatId);
        return;
    }

    // --- منطق ماشین حالت کاربر ---

    if (user.step === "AWAITING_CONTACT_USERNAME") {
        const targetUsername = text.replace('@', '').toLowerCase();
        const targetRes = await pool.query("SELECT * FROM users WHERE LOWER(username) = $1 AND platform = $2", [targetUsername, platform]);
        
        if (targetRes.rows.length === 0) {
            await sendMessage(platform, chatId, "❌ کاربر مورد نظر شما عضو ربات نیست.");
            await pool.query("UPDATE users SET step = 'IDLE' WHERE chat_id = $1", [chatId]);
            await sendMainMenu(platform, chatId);
        } else {
            const targetUser = targetRes.rows[0];
            const tempData = { target_chat_id: targetUser.chat_id };
            await pool.query("UPDATE users SET step = 'AWAITING_CONTACT_MESSAGE', temp_data = $1 WHERE chat_id = $2", 
                [JSON.stringify(tempData), chatId]);
            await sendMessage(platform, chatId, "✅ کاربر یافت شد. پیام خود جهت ارسال را وارد کنید:");
        }
        return;
    }

    if (user.step === "AWAITING_CONTACT_MESSAGE") {
        let tempData = JSON.parse(user.temp_data || '{}');
        tempData.message = text;
        await pool.query("UPDATE users SET temp_data = $1 WHERE chat_id = $2", [JSON.stringify(tempData), chatId]);

        const keyboard = {
            inline_keyboard: [
                [{ text: "بله بفرست ✅", callback_data: "contact_send_yes" }],
                [{ text: "نه مطمئن نیستم ❌", callback_data: "contact_send_no" }]
            ]
        };
        await sendMessage(platform, chatId, `مطمئنی میخوای این پیامو بفرستی؟\n\nمتن پیام:\n${text}`, keyboard);
        return;
    }

    // --- منوی اصلی ---
    if (text === "ارسال به مخاطب ✉️") {
        await pool.query("UPDATE users SET step = 'AWAITING_CONTACT_USERNAME' WHERE chat_id = $1", [chatId]);
        await sendMessage(platform, chatId, "لطفاً آیدی (یوزرنیم) شخص مورد نظر را وارد کنید (مثال: @username):");
        return;
    }

    if (text === "تست شخصیتی 🧠") {
        const testCost = 5; // فرض میکنیم 5 سکه است
        if (user.coins >= testCost) {
            await pool.query("UPDATE users SET coins = coins - $1 WHERE chat_id = $2", [testCost, chatId]);
            await sendMessage(platform, chatId, `✅ ${testCost} سکه کسر شد. تست در حال آماده سازی است...`);
            await startMbtiTest(platform, chatId, user);
        } else {
            await sendMessage(platform, chatId, "❌ سکه کافی برای انجام تست ندارید.");
        }
        return;
    }

    if (text === "جستجوی ویژه 🔍") {
        const keyboard = {
            inline_keyboard: [
                [{ text: "هم استانی ها ( کسر 1 سکه) 📍", callback_data: "advsearch_province" }],
                [{ text: "همسن ( کسر 1 سکه) 🎂", callback_data: "advsearch_age" }],
                [{ text: "تیپ شخصیتی (کسر 4 سکه) 🧠", callback_data: "advsearch_mbti" }]
            ]
        };
        await sendMessage(platform, chatId, "یک گزینه را برای جستجو انتخاب کنید:", keyboard);
        return;
    }
}

// ==========================================
// 5. مدیریت دکمه‌های شیشه‌ای (Callback Queries)
// ==========================================
async function handleCallback(platform, callbackQuery) {
    const chatId = callbackQuery.message.chat.id.toString();
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;
    const cbId = callbackQuery.id;

    const res = await pool.query("SELECT * FROM users WHERE chat_id = $1", [chatId]);
    if (res.rows.length === 0) return;
    const user = res.rows[0];

    // --- تست MBTI ---
    if (data.startsWith('mbti_ans_')) {
        await handleMbtiAnswer(platform, chatId, user, data, messageId);
        await answerCallback(platform, cbId, "");
        return;
    }

    if (data === "mbti_download_pdf") {
        await answerCallback(platform, cbId, "در حال ساخت PDF...");
        // فرض بر این است که pdfGenerator.createPdfReport مسیر فایل را برمیگرداند
        const filePath = await pdfGenerator.createPdfReport(user.mbti_type, user.id);
        await sendDocument(platform, chatId, filePath, "این هم نتیجه تست MBTI شما! 🧠");
        return;
    }

    // --- ارسال به مخاطب (تایید نهایی) ---
    if (data === "contact_send_no") {
        await pool.query("UPDATE users SET step = 'IDLE', temp_data = NULL WHERE chat_id = $1", [chatId]);
        await editMessageText(platform, chatId, messageId, "❌ ارسال پیام لغو شد.");
        await sendMainMenu(platform, chatId);
        return;
    }

    if (data === "contact_send_yes") {
        let tempData = JSON.parse(user.temp_data || '{}');
        const targetChatId = tempData.target_chat_id;
        const msgContent = tempData.message;

        if (user.coins >= 2) {
            // فرستنده سکه دارد -> کسر میکنیم، پیام باز فرستاده میشود
            await pool.query("UPDATE users SET coins = coins - 2, step = 'IDLE', temp_data = NULL WHERE chat_id = $1", [chatId]);
            const msgRes = await pool.query(
                "INSERT INTO messages (sender_chat_id, receiver_chat_id, content, sender_paid, platform) VALUES ($1, $2, $3, $4, $5) RETURNING id",
                [chatId, targetChatId, msgContent, true, platform]
            );
            
            const dbMsgId = msgRes.rows[0].id;
            const keyboard = { inline_keyboard: [[{ text: "مشاهده پیام 👁", callback_data: `msg_read_${dbMsgId}` }]] };
            await sendMessage(platform, targetChatId, "شما یک پیام ناشناس جدید دارید! 💌", keyboard);
            await editMessageText(platform, chatId, messageId, "✅ 2 سکه کسر شد و پیام ارسال گردید.");
            
        } else {
            // فرستنده سکه ندارد -> گیرنده باید بپردازد
            await pool.query("UPDATE users SET step = 'IDLE', temp_data = NULL WHERE chat_id = $1", [chatId]);
            const msgRes = await pool.query(
                "INSERT INTO messages (sender_chat_id, receiver_chat_id, content, sender_paid, platform) VALUES ($1, $2, $3, $4, $5) RETURNING id",
                [chatId, targetChatId, msgContent, false, platform]
            );

            const dbMsgId = msgRes.rows[0].id;
            const keyboard = { inline_keyboard: [[{ text: "پرداخت 2 سکه و مشاهده 🔓", callback_data: `msg_pay_${dbMsgId}` }]] };
            await sendMessage(platform, targetChatId, "شما یک پیام ناشناس جدید دارید! 💌\nفرستنده سکه کافی نداشته است، برای مشاهده باید 2 سکه پرداخت کنید.", keyboard);
            await editMessageText(platform, chatId, messageId, "شما سکه کافی برای ارسال نداشتید. پیام ارسال شد و در صورت تایید و پرداخت سکه توسط مخاطب، به ایشان نمایش داده خواهد شد.");
        }
        return;
    }

    // --- خواندن/پرداخت پیام توسط گیرنده ---
    if (data.startsWith('msg_read_')) {
        const msgId = data.split('_')[2];
        const msgRes = await pool.query("SELECT * FROM messages WHERE id = $1 AND status = 'pending'", [msgId]);
        if (msgRes.rows.length > 0) {
            const msg = msgRes.rows[0];
            await pool.query("UPDATE messages SET status = 'read' WHERE id = $1", [msgId]);
            await editMessageText(platform, chatId, messageId, `💌 پیام ناشناس شما:\n\n${msg.content}`);
            await sendMessage(msg.platform, msg.sender_chat_id, "📜 کاربری که براش پیام ناشناس فرستاده بودی، پیامتو دید.");
        } else {
            await answerCallback(platform, cbId, "پیام قبلاً خوانده شده یا منقضی شده است.", true);
        }
        return;
    }

    if (data.startsWith('msg_pay_')) {
        const msgId = data.split('_')[2];
        const msgRes = await pool.query("SELECT * FROM messages WHERE id = $1 AND status = 'pending'", [msgId]);
        if (msgRes.rows.length > 0) {
            const msg = msgRes.rows[0];
            if (user.coins >= 2) {
                await pool.query("UPDATE users SET coins = coins - 2 WHERE chat_id = $1", [chatId]);
                await pool.query("UPDATE messages SET status = 'read' WHERE id = $1", [msgId]);
                await editMessageText(platform, chatId, messageId, `✅ 2 سکه کسر شد.\n\n💌 پیام ناشناس شما:\n\n${msg.content}`);
                await sendMessage(msg.platform, msg.sender_chat_id, "📜 کاربری که براش پیام ناشناس فرستاده بودی، پیامتو دید.");
            } else {
                await answerCallback(platform, cbId, "❌ شما سکه کافی برای باز کردن این پیام ندارید.", true);
            }
        }
        return;
    }

    // --- جستجوی ویژه ---
    const searchCosts = { 'advsearch_province': 1, 'advsearch_age': 1, 'advsearch_mbti': 4 };
    if (searchCosts[data]) {
        const cost = searchCosts[data];
        if (user.coins >= cost) {
            await pool.query("UPDATE users SET coins = coins - $1 WHERE chat_id = $2", [cost, chatId]);
            await answerCallback(platform, cbId, `✅ ${cost} سکه کسر شد. در حال جستجو...`);
            // منطق جستجو را اینجا اضافه کنید...
        } else {
            await answerCallback(platform, cbId, `❌ برای این جستجو به ${cost} سکه نیاز دارید.`, true);
        }
        return;
    }
}

// ==========================================
// 6. وب‌هوک‌ها
// ==========================================
app.post('/webhook/telegram', async (req, res) => {
    try {
        if (req.body.message) await handleMessage('telegram', req.body.message);
        if (req.body.callback_query) await handleCallback('telegram', req.body.callback_query);
    } catch (e) { console.error("Telegram Webhook Error:", e); }
    res.sendStatus(200);
});

app.post('/webhook/bale', async (req, res) => {
    try {
        if (req.body.message) await handleMessage('bale', req.body.message);
        if (req.body.callback_query) await handleCallback('bale', req.body.callback_query);
    } catch (e) { console.error("Bale Webhook Error:", e); }
    res.sendStatus(200);
});

app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});
