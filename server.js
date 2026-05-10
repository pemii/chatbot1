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
        // اضافه کردن ستون پارتنر برای چت دو نفره (اگر وجود نداشته باشد ارور نمیدهد)
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS partner_id INTEGER;`);
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

async function sendMainMenu(platform, chatId) {
    const menu = {
        keyboard: [
            [{ text: "جستجوی ناشناس 🔍" }],
            [{ text: "پروفایل من 👤" }, { text: "کیف پول 💰" }],
            [{ text: "ارسال لینک دعوت 🔗" }, { text: "راهنما ❓" }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
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
                await sendMessage(platform, chatId, "سلام! به ربات چت ناشناس خوش اومدی.\nلطفاً جنسیت خودت رو انتخاب کن:", keyboard);
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
                await sendMessage(platform, chatId, `✅ نام کاربری "${text}" ثبت شد.\nحالا سن خودت رو به عدد وارد کن:`);
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
            else if (user.step === 'REGISTERED') {
                if (text === '/start') {
                    await sendMainMenu(platform, chatId);
                } 
                else if (text === "پروفایل من 👤") {
                    const profileText = `👤 پروفایل شما\n🏷 نام کاربری: ${user.username}\n⚧ جنسیت: ${user.gender}\n🎂 سن: ${user.age}\n📍 شهر: ${user.province} - ${user.city}`;
                    await sendMessage(platform, chatId, profileText);
                }
                else if (text === "جستجوی ناشناس 🔍") {
                    // جستجو برای پیدا کردن یک فرد دیگر که او هم در حال جستجو است
                    let partnerResult = await pool.query('SELECT * FROM users WHERE step = $1 AND id != $2 LIMIT 1', ['SEARCHING', user.id]);

                    if (partnerResult.rows.length > 0) {
                        // یک نفر پیدا شد!
                        let partner = partnerResult.rows[0];
                        
                        // آپدیت وضعیت هر دو نفر به CHATTING و تنظیم partner_id
                        await pool.query('UPDATE users SET step = $1, partner_id = $2 WHERE id = $3', ['CHATTING', partner.id, user.id]);
                        await pool.query('UPDATE users SET step = $1, partner_id = $2 WHERE id = $3', ['CHATTING', user.id, partner.id]);

                        const chatKeyboard = { keyboard: [[{ text: "❌ لغو چت" }]], resize_keyboard: true };

                        // ارسال پیام شروع چت به هر دو نفر
                        await sendMessage(platform, chatId, "🎉 یک نفر پیدا شد! می‌تونی چت رو شروع کنی.\n(برای خروج دکمه 'لغو چت' رو بزن)", chatKeyboard);
                        await sendMessage(partner.platform, partner.chat_id, "🎉 یک نفر پیدا شد! می‌تونی چت رو شروع کنی.\n(برای خروج دکمه 'لغو چت' رو بزن)", chatKeyboard);
                    } else {
                        // کسی پیدا نشد، کاربر را در صف انتظار (SEARCHING) قرار می‌دهیم
                        await pool.query('UPDATE users SET step = $1 WHERE id = $2', ['SEARCHING', user.id]);
                        const cancelKeyboard = { keyboard: [[{ text: "❌ انصراف از جستجو" }]], resize_keyboard: true };
                        await sendMessage(platform, chatId, "⏳ در حال جستجوی یک فرد ناشناس...\nلطفاً کمی صبر کن.", cancelKeyboard);
                    }
                }
                else {
                    await sendMessage(platform, chatId, "لطفاً از دکمه‌های منو استفاده کن.");
                }
            }
            // === وضعیت: در حال جستجو ===
            else if (user.step === 'SEARCHING') {
                if (text === "❌ انصراف از جستجو" || text === '/start') {
                    await pool.query('UPDATE users SET step = $1 WHERE id = $2', ['REGISTERED', user.id]);
                    await sendMessage(platform, chatId, "🛑 جستجو لغو شد.");
                    await sendMainMenu(platform, chatId);
                } else {
                    await sendMessage(platform, chatId, "⏳ هنوز در حال جستجو هستیم... برای لغو، دکمه پایین را بزن.");
                }
            }
            // === وضعیت: در حال چت ===
            else if (user.step === 'CHATTING') {
                if (text === "❌ لغو چت" || text === '/start') {
                    // 1. کاربر فعلی را از چت خارج می‌کنیم
                    await pool.query('UPDATE users SET step = $1, partner_id = NULL WHERE id = $2', ['REGISTERED', user.id]);
                    await sendMessage(platform, chatId, "🔴 شما چت را ترک کردید.");
                    await sendMainMenu(platform, chatId);

                    // 2. طرف مقابل را از چت خارج می‌کنیم و به او اطلاع می‌دهیم
                    if (user.partner_id) {
                        let pRes = await pool.query('SELECT * FROM users WHERE id = $1', [user.partner_id]);
                        if (pRes.rows.length > 0) {
                            let partner = pRes.rows[0];
                            await pool.query('UPDATE users SET step = $1, partner_id = NULL WHERE id = $2', ['REGISTERED', partner.id]);
                            await sendMessage(partner.platform, partner.chat_id, "🔴 طرف مقابل چت را ترک کرد.");
                            await sendMainMenu(partner.platform, partner.chat_id);
                        }
                    }
                } else {
                    // ارسال پیام به طرف مقابل
                    if (user.partner_id) {
                        let pRes = await pool.query('SELECT * FROM users WHERE id = $1', [user.partner_id]);
                        if (pRes.rows.length > 0) {
                            let partner = pRes.rows[0];
                            await sendMessage(partner.platform, partner.chat_id, `💬 ناشناس:\n${text}`);
                        }
                    }
                }
            }
        }
        
        else if (body.callback_query) {
            // (بخش callback_query که مربوط به ثبت نام بود تغییری نکرده، در اینجا خلاصه شده است تا کد طولانی نشود. 
            // در کد بالا باید کدهای مربوط به gender و province را دقیقاً مثل مرحله قبل داشته باشید).
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
                    await pool.query('UPDATE users SET city = $1, step = $2 WHERE id = $3', [city, 'REGISTERED', user.id]);
                    await sendMessage(platform, chatId, `🎉 عالی! شهر ${city} هم ثبت شد.\nثبت‌نام به پایان رسید.`);
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

app.get('/', (req, res) => { res.send('Bot Server is Running! (Matchmaking Enabled)'); });
app.listen(PORT, () => { console.log(`Server is running on port ${PORT}`); });
