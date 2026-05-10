require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { Pool } = require('pg');
const locations = require('./locations'); // اضافه شدن فایل لوکیشن‌ها

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

// آماده‌سازی و بروزرسانی دیتابیس
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
        // اضافه کردن ستون‌های جدید اگر وجود نداشته باشند (برای جلوگیری از خطا با catch کنترل شده‌اند)
        await pool.query(`ALTER TABLE users ADD COLUMN age INTEGER;`).catch(() => {});
        await pool.query(`ALTER TABLE users ADD COLUMN province VARCHAR(50);`).catch(() => {});
        await pool.query(`ALTER TABLE users ADD COLUMN city VARCHAR(50);`).catch(() => {});
        
        console.log("Database Ready and Updated!");
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

// تابع کمکی برای ساخت دکمه‌های شیشه‌ای دو ستونه
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

async function handleUpdate(platform, req, res) {
    res.sendStatus(200); 
    
    try {
        const body = req.body;

        // پردازش پیام‌های متنی
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
                await sendMessage(platform, chatId, "سلام! به ربات چت ناشناس خوش اومدی.\n🎁 پاداش ورود: 1000 توکن + 20 سکه به شما تعلق گرفت.\n\nبرای شروع، لطفاً جنسیت خودت رو انتخاب کن (توجه: بعداً قابل تغییر نیست):", keyboard);
                return;
            }

            const user = userResult.rows[0];

            if (user.step === 'ASK_USERNAME') {
                const persianRegex = /^[\u0600-\u06FF\s]+$/;
                if (!persianRegex.test(text)) {
                    await sendMessage(platform, chatId, "❌ لطفاً نام کاربری را فقط با حروف فارسی (بدون عدد و انگلیسی) وارد کن:");
                    return;
                }
                await pool.query('UPDATE users SET username = $1, step = $2 WHERE id = $3', [text, 'ASK_AGE', user.id]);
                await sendMessage(platform, chatId, `✅ نام کاربری "${text}" ثبت شد.\n\nحالا لطفاً سن خودت رو به عدد (مثلاً 22) وارد کن:`);
            }
            else if (user.step === 'ASK_AGE') {
                const age = parseInt(text);
                // اعتبارسنجی سن (باید عدد باشد و بین 10 تا 99)
                if (isNaN(age) || age < 10 || age > 99) {
                    await sendMessage(platform, chatId, "❌ لطفاً یک سن معتبر به عدد (مثلاً 22) وارد کن:");
                    return;
                }
                
                await pool.query('UPDATE users SET age = $1, step = $2 WHERE id = $3', [age, 'ASK_PROVINCE', user.id]);
                
                // استخراج لیست استان‌ها از فایل locations و ساخت کیبورد
                const provinces = Object.keys(locations);
                const provinceKeyboard = createInlineKeyboard(provinces, 'prv_');
                
                await sendMessage(platform, chatId, `✅ سن شما (${age}) ثبت شد.\n\nلطفاً استان محل سکونت خودت رو از لیست زیر انتخاب کن:`, provinceKeyboard);
            }
            else if (text === '/start') {
                if (user.step === 'REGISTERED') {
                    await sendMessage(platform, chatId, "شما قبلاً ثبت‌نام کرده‌اید. به منوی اصلی خوش آمدید.");
                } else {
                    await sendMessage(platform, chatId, "شما در حال ثبت‌نام هستید. لطفاً مرحله فعلی را تکمیل کنید.");
                }
            }
        }
        
        // پردازش کلیک روی دکمه‌های شیشه‌ای
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
                    await sendMessage(platform, chatId, `✅ جنسیت شما (${gender}) ثبت شد.\n\nحالا یک نام کاربری فارسی برای خودت انتخاب کن:`);
                }
                else if (user.step === 'ASK_PROVINCE' && data.startsWith('prv_')) {
                    const province = data.replace('prv_', ''); // حذف پیشوند
                    await pool.query('UPDATE users SET province = $1, step = $2 WHERE id = $3', [province, 'ASK_CITY', user.id]);
                    
                    // استخراج لیست شهرهای آن استان و ساخت کیبورد
                    const cities = locations[province] || [];
                    const cityKeyboard = createInlineKeyboard(cities, 'cty_');
                    
                    await sendMessage(platform, chatId, `✅ استان ${province} ثبت شد.\n\nحالا شهر خودت رو انتخاب کن:`, cityKeyboard);
                }
                else if (user.step === 'ASK_CITY' && data.startsWith('cty_')) {
                    const city = data.replace('cty_', '');
                    await pool.query('UPDATE users SET city = $1, step = $2 WHERE id = $3', [city, 'REGISTERED', user.id]);
                    
                    await sendMessage(platform, chatId, `🎉 عالی! شهر ${city} هم ثبت شد.\n\n✅ ثبت‌نام شما با موفقیت به پایان رسید و اطلاعات شما در دیتابیس ذخیره شد.\n\nبه زودی منوی اصلی برای شما فعال می‌شود.`);
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
    res.send('Bot Server with Locations is Running!');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
