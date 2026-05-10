require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { Pool } = require('pg');
const locations = require('./locations');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const BALE_TOKEN = process.env.BALE_TOKEN;

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const BALE_API = `https://tapi.bale.ai/bot${BALE_TOKEN}`;

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
        console.log("Database Ready!");
    } catch (error) {
        console.error("DB Error:", error.message);
    }
}
initDB();

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

function createInlineKeyboard(items, prefix) {
    let keyboard = [];
    let row = [];
    for (let i = 0; i < items.length; i++) {
        row.push({ text: items[i], callback_data: prefix + items[i] });
        if (row.length === 2 || i === items.length - 1) {
            keyboard.push(row);
            row = [];
        }
    }
    return { inline_keyboard: keyboard };
}

// تابع جدید: ارسال منوی اصلی
async function sendMainMenu(platform, chatId) {
    const menu = {
        keyboard: [
            [{ text: "جستجوی ناشناس 🔍" }],
            [{ text: "پروفایل من 👤" }, { text: "کیف پول 💰" }],
            [{ text: "ارسال لینک دعوت 🔗" }, { text: "راهنما ❓" }]
        ],
        resize_keyboard: true, // تغییر اندازه دکمه‌ها برای نمایش بهتر
        one_time_keyboard: false // کیبورد مخفی نشود
    };
    await sendMessage(platform, chatId, "🏠 به منوی اصلی خوش آمدید. لطفاً یک گزینه را انتخاب کنید:", menu);
}

async function handleUpdate(platform, req, res) {
    res.sendStatus(200); 
    
    try {
        const body = req.body;

        if (body.message && body.message.text) {
            const msg = body.message;
            const chatId = msg.chat.id.toString();
            const text = msg.text;

            let userResult = await pool.query('SELECT * FROM users WHERE chat_id = $1 AND platform = $2', [chatId, platform]);
            
            if (userResult.rows.length === 0) {
                await pool.query('INSERT INTO users (chat_id, platform, step) VALUES ($1, $2, $3)', [chatId, platform, 'ASK_GENDER']);
                const keyboard = {
                    inline_keyboard: [
                        [{ text: "پسر هستم 👦", callback_data: "gender_boy" }, { text: "دختر هستم 👧", callback_data: "gender_girl" }]
                    ]
                };
                await sendMessage(platform, chatId, "سلام! به ربات چت ناشناس خوش اومدی.\n🎁 پاداش ورود: 1000 توکن + 20 سکه\n\nلطفاً جنسیت خودت رو انتخاب کن:", keyboard);
                return;
            }

            const user = userResult.rows[0];

            if (user.step === 'ASK_USERNAME') {
                const persianRegex = /^[\u0600-\u06FF\s]+$/;
                if (!persianRegex.test(text)) {
                    await sendMessage(platform, chatId, "❌ فقط حروف فارسی مجاز است:");
                    return;
                }
                await pool.query('UPDATE users SET username = $1, step = $2 WHERE id = $3', [text, 'ASK_AGE', user.id]);
                await sendMessage(platform, chatId, `✅ نام کاربری "${text}" ثبت شد.\nحالا سن خودت رو به عدد (مثلاً 22) وارد کن:`);
            }
            else if (user.step === 'ASK_AGE') {
                const age = parseInt(text);
                if (isNaN(age) || age < 10 || age > 99) {
                    await sendMessage(platform, chatId, "❌ لطفاً سن معتبر به عدد وارد کن:");
                    return;
                }
                await pool.query('UPDATE users SET age = $1, step = $2 WHERE id = $3', [age, 'ASK_PROVINCE', user.id]);
                const provinces = Object.keys(locations);
                await sendMessage(platform, chatId, `✅ سن شما (${age}) ثبت شد.\nاستان خودت رو انتخاب کن:`, createInlineKeyboard(provinces, 'prv_'));
            }
            // === کدهای جدید برای کاربرانی که ثبت‌نامشان کامل شده ===
            else if (user.step === 'REGISTERED') {
                if (text === '/start') {
                    await sendMainMenu(platform, chatId);
                } 
                else if (text === "پروفایل من 👤") {
                    const profileText = `👤 **پروفایل شما**\n\n` +
                                        `🏷 نام کاربری: ${user.username}\n` +
                                        `⚧ جنسیت: ${user.gender}\n` +
                                        `🎂 سن: ${user.age}\n` +
                                        `📍 شهر: ${user.province} - ${user.city}\n\n` +
                                        `⭐ امتیاز: ${user.score}\n` +
                                        `💰 سکه: ${user.coins}\n` +
                                        `🎟 توکن: ${user.tokens}`;
                    await sendMessage(platform, chatId, profileText);
                }
                else if (text === "کیف پول 💰") {
                    await sendMessage(platform, chatId, `موجودی شما:\n🪙 ${user.coins} سکه\n🎟 ${user.tokens} توکن\n\n(بخش فروشگاه به زودی فعال می‌شود)`);
                }
                else if (text === "جستجوی ناشناس 🔍") {
                    await sendMessage(platform, chatId, "⏳ در حال توسعه... (در فاز بعدی سیستم وصل کردن کاربران به یکدیگر را می‌نویسیم)");
                }
                else if (text === "ارسال لینک دعوت 🔗" || text === "راهنما ❓") {
                    await sendMessage(platform, chatId, "این بخش به زودی فعال می‌شود.");
                }
                else {
                    await sendMessage(platform, chatId, "متوجه نشدم! لطفاً از دکمه‌های منو استفاده کن.");
                }
            }
            else if (text === '/start') {
                await sendMessage(platform, chatId, "شما در حال ثبت‌نام هستید. لطفاً مرحله فعلی را تکمیل کنید.");
            }
        }
        
        else if (body.callback_query) {
            const query = body.callback_query;
            const chatId = query.message.chat.id.toString();
            const data = query.data;

            let userResult = await pool.query('SELECT * FROM users WHERE chat_id = $1 AND platform = $2', [chatId, platform]);
            if (userResult.rows.length > 0) {
                const user = userResult.rows[0];

                if (user.step === 'ASK_GENDER') {
                    const gender = data === 'gender_boy' ? 'پسر' : 'دختر';
                    await pool.query('UPDATE users SET gender = $1, step = $2 WHERE id = $3', [gender, 'ASK_USERNAME', user.id]);
                    await sendMessage(platform, chatId, `✅ جنسیت (${gender}) ثبت شد.\nحالا یک نام کاربری فارسی انتخاب کن:`);
                }
                else if (user.step === 'ASK_PROVINCE' && data.startsWith('prv_')) {
                    const province = data.replace('prv_', '');
                    await pool.query('UPDATE users SET province = $1, step = $2 WHERE id = $3', [province, 'ASK_CITY', user.id]);
                    const cities = locations[province] || [];
                    await sendMessage(platform, chatId, `✅ استان ${province} ثبت شد.\nشهر خودت رو انتخاب کن:`, createInlineKeyboard(cities, 'cty_'));
                }
                else if (user.step === 'ASK_CITY' && data.startsWith('cty_')) {
                    const city = data.replace('cty_', '');
                    // ثبت شهر و تغییر وضعیت کاربر به REGISTERED
                    await pool.query('UPDATE users SET city = $1, step = $2 WHERE id = $3', [city, 'REGISTERED', user.id]);
                    
                    await sendMessage(platform, chatId, `🎉 عالی! شهر ${city} هم ثبت شد.\nثبت‌نام شما با موفقیت به پایان رسید.`);
                    // نمایش خودکار منوی اصلی بلافاصله پس از پایان ثبت‌نام
                    await sendMainMenu(platform, chatId);
                }
            }
        }
    } catch (error) {
        console.error("Handler Error:", error.message);
    }
}

app.post('/webhook/telegram', (req, res) => handleUpdate('telegram', req, res));
app.post('/webhook/bale', (req, res) => handleUpdate('bale', req, res));

app.get('/', (req, res) => { res.send('Bot Server with Main Menu is Running!'); });
app.listen(PORT, () => { console.log(`Server is running on port ${PORT}`); });
