require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const BALE_TOKEN = process.env.BALE_TOKEN;

// آدرس‌های API
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const BALE_API = `https://tapi.bale.ai/bot${BALE_TOKEN}`;

// اتصال به دیتابیس
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// ساخت جدول کاربران (اگر وجود نداشته باشد)
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
                UNIQUE(chat_id, platform)
            );
        `);
        console.log("Database Ready!");
    } catch (error) {
        console.error("DB Error:", error.message);
    }
}
initDB();

// تابع کمکی برای ارسال پیام
async function sendMessage(platform, chatId, text, replyMarkup = null) {
    const url = platform === 'telegram' ? TELEGRAM_API : BALE_API;
    const payload = { chat_id: chatId, text: text };
    if (replyMarkup) payload.reply_markup = replyMarkup;
    try {
        await axios.post(`${url}/sendMessage`, payload);
    } catch (error) {
        console.error(`Send Message Error (${platform}):`, error.message);
    }
}

// هسته مرکزی پردازش پیام‌ها
async function handleUpdate(platform, req, res) {
    res.sendStatus(200); // پاسخ سریع به تلگرام/بله تا پیام را دوباره نفرستند
    
    try {
        const body = req.body;

        // اگر کاربر متن فرستاد
        if (body.message && body.message.text) {
            const msg = body.message;
            const chatId = msg.chat.id.toString();
            const text = msg.text;

            // جستجوی کاربر در دیتابیس
            let userResult = await pool.query('SELECT * FROM users WHERE chat_id = $1 AND platform = $2', [chatId, platform]);
            
            // اگر کاربر جدید است
            if (userResult.rows.length === 0) {
                // ثبت کاربر در دیتابیس و اعطای پاداش اولیه
                await pool.query(
                    'INSERT INTO users (chat_id, platform, step) VALUES ($1, $2, $3)', 
                    [chatId, platform, 'ASK_GENDER']
                );
                
                const keyboard = {
                    inline_keyboard: [
                        [{ text: "پسر هستم 👦", callback_data: "gender_boy" }, { text: "دختر هستم 👧", callback_data: "gender_girl" }]
                    ]
                };
                await sendMessage(platform, chatId, "سلام! به ربات چت ناشناس خوش اومدی.\n🎁 پاداش ورود: 1000 توکن + 20 سکه به شما تعلق گرفت.\n\nبرای شروع، لطفاً جنسیت خودت رو انتخاب کن (توجه: بعداً قابل تغییر نیست):", keyboard);
                return;
            }

            const user = userResult.rows[0];

            // اگر در مرحله وارد کردن نام کاربری است
            if (user.step === 'ASK_USERNAME') {
                // بررسی اینکه فقط حروف فارسی و فاصله باشد
                const persianRegex = /^[\u0600-\u06FF\s]+$/;
                if (!persianRegex.test(text)) {
                    await sendMessage(platform, chatId, "❌ لطفاً نام کاربری را فقط با حروف فارسی (بدون عدد و حروف انگلیسی) وارد کن:");
                    return;
                }

                // ذخیره نام کاربری و رفتن به مرحله بعد
                await pool.query('UPDATE users SET username = $1, step = $2 WHERE id = $3', [text, 'ASK_AGE', user.id]);
                await sendMessage(platform, chatId, `✅ نام کاربری "${text}" ثبت شد.\n\nحالا لطفاً سن خودت رو به عدد (مثلاً 22) وارد کن:`);
            }
            else if (text === '/start') {
                await sendMessage(platform, chatId, "شما قبلاً ثبت‌نام را شروع کرده‌اید. لطفاً مراحل را ادامه دهید.");
            }
        }
        
        // اگر کاربر روی دکمه‌های شیشه‌ای کلیک کرد
        else if (body.callback_query) {
            const query = body.callback_query;
            const chatId = query.message.chat.id.toString();
            const data = query.data; // اطلاعات دکمه فشرده شده

            let userResult = await pool.query('SELECT * FROM users WHERE chat_id = $1 AND platform = $2', [chatId, platform]);
            if (userResult.rows.length > 0) {
                const user = userResult.rows[0];

                if (user.step === 'ASK_GENDER') {
                    const gender = data === 'gender_boy' ? 'پسر' : 'دختر';
                    // بروزرسانی جنسیت و رفتن به مرحله پرسش نام
                    await pool.query('UPDATE users SET gender = $1, step = $2 WHERE id = $3', [gender, 'ASK_USERNAME', user.id]);
                    await sendMessage(platform, chatId, `✅ جنسیت شما (${gender}) ثبت شد.\n\nحالا یک نام کاربری فارسی برای خودت انتخاب کن (این نام به بقیه نمایش داده میشه):`);
                }
            }
        }
    } catch (error) {
        console.error("Handler Error:", error.message);
    }
}

// مسیرهای دریافت اطلاعات (Webhooks)
app.post('/webhook/telegram', (req, res) => handleUpdate('telegram', req, res));
app.post('/webhook/bale', (req, res) => handleUpdate('bale', req, res));

app.get('/', (req, res) => {
    res.send('Bot Server with Database is Running!');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
