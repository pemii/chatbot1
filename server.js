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
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS partner_id INTEGER;`);
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS job VARCHAR(100);`);
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_id VARCHAR(255);`);
        console.log("Database Ready!");
    } catch (error) {
        console.error("DB Error:", error.message);
    }
}
initDB();

// تابع تبدیل اعداد فارسی به انگلیسی
function toEnglishDigits(str) {
    const persianNumbers = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return str.split('').map(c => {
        let index = persianNumbers.indexOf(c);
        return index !== -1 ? index : c;
    }).join('');
}

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

// آپدیت شده: پشتیبانی از تعداد ستون‌های دلخواه (پیش‌فرض 3 برای استان‌ها)
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

async function handleUpdate(platform, req, res) {
    res.sendStatus(200); 
    
    try {
        const body = req.body;
        const msg = body.message;

        // بررسی پیام متنی یا تصویری
        if (msg) {
            const chatId = msg.chat.id.toString();
            const text = msg.text;
            const photo = msg.photo; // آرایه عکس‌ها در صورت ارسال تصویر

            // قابلیت ریست کردن ربات (حذف کامل از دیتابیس)
            if (text && (text.toUpperCase() === '/RESET')) {
                await pool.query('DELETE FROM users WHERE chat_id = $1 AND platform = $2', [chatId, platform]);
                await sendMessage(platform, chatId, "♻️ اطلاعات شما با موفقیت از سیستم حذف شد. برای شروع مجدد /start را بفرستید.", { remove_keyboard: true });
                return;
            }

            let userResult = await pool.query('SELECT * FROM users WHERE chat_id = $1 AND platform = $2', [chatId, platform]);
            
            // اگر کاربر جدید است
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

            if (user.step === 'ASK_USERNAME' && text) {
                const persianRegex = /^[\u0600-\u06FF\s]+$/;
                if (!persianRegex.test(text)) {
                    await sendMessage(platform, chatId, "❌ فقط حروف فارسی مجاز است. لطفاً دوباره نام کاربری خود را بنویسید:");
                    return;
                }
                await pool.query('UPDATE users SET username = $1, step = $2 WHERE id = $3', [text, 'ASK_AGE', user.id]);
                await sendMessage(platform, chatId, `✅ نام کاربری "${text}" ثبت شد.\nحالا سن خودت رو وارد کن (حداقل 15 - حداکثر 80):`);
            }
            else if (user.step === 'ASK_AGE' && text) {
                const englishAgeText = toEnglishDigits(text);
                const age = parseInt(englishAgeText);
                if (isNaN(age) || age < 15 || age > 80) {
                    await sendMessage(platform, chatId, "❌ لطفاً یک سن معتبر بین ۱۵ تا ۸۰ وارد کن:");
                    return;
                }
                await pool.query('UPDATE users SET age = $1, step = $2 WHERE id = $3', [age, 'ASK_PROVINCE', user.id]);
                const provinces = Object.keys(locations);
                await sendMessage(platform, chatId, `✅ سن شما (${age}) ثبت شد.\nلطفاً استان خودت رو انتخاب کن:`, createInlineKeyboard(provinces, 'prv_', 3));
            }
            else if (user.step === 'ASK_JOB' && text) {
                let jobStr = text === "رد کردن ⏭" ? "ثبت نشده" : text;
                await pool.query('UPDATE users SET job = $1, step = $2 WHERE id = $3', [jobStr, 'ASK_PHOTO', user.id]);
                await sendMessage(platform, chatId, "📸 در صورت تمایل یک عکس برای پروفایل خود ارسال کن:", skipKeyboard);
            }
            else if (user.step === 'ASK_PHOTO') {
                let photoId = "بدون عکس";
                if (photo && photo.length > 0) {
                    // گرفتن بزرگترین سایز عکس
                    photoId = photo[photo.length - 1].file_id; 
                }
                
                await pool.query('UPDATE users SET photo_id = $1, step = $2 WHERE id = $3', [photoId, 'CHECK_JOIN', user.id]);
                
                // پیام عضویت در کانال
                const joinKeyboard = {
                    inline_keyboard: [
                        [{ text: "📢 عضویت در کانال اطلاع‌رسانی", url: "https://t.me/YourChannelID" }],
                        [{ text: "🤖 عضویت در ربات زاپاس", url: "https://t.me/YourBackupBotID" }],
                        [{ text: "✅ بررسی عضویت", callback_data: "check_join" }]
                    ]
                };
                await sendMessage(platform, chatId, "⚠️ برای استفاده از ربات، لطفاً در کانال اطلاع‌رسانی و ربات زاپاس ما عضو شوید و سپس دکمه بررسی را بزنید:", joinKeyboard);
            }
            
            // وضعیت ثبت‌نام کامل شده (منوی اصلی)
            else if (user.step === 'REGISTERED' && text) {
                if (text === '/start') {
                    await sendMainMenu(platform, chatId);
                } 
                else if (text === "چت با ناشناس 👤") {
                    // منطق فعلی مچ‌میکینگ که قبلاً نوشتیم
                    let partnerResult = await pool.query('SELECT * FROM users WHERE step = $1 AND id != $2 LIMIT 1', ['SEARCHING', user.id]);
                    if (partnerResult.rows.length > 0) {
                        let partner = partnerResult.rows[0];
                        await pool.query('UPDATE users SET step = $1, partner_id = $2 WHERE id = $3', ['CHATTING', partner.id, user.id]);
                        await pool.query('UPDATE users SET step = $1, partner_id = $2 WHERE id = $3', ['CHATTING', user.id, partner.id]);
                        const chatKeyboard = { keyboard: [[{ text: "❌ لغو چت" }]], resize_keyboard: true };
                        await sendMessage(platform, chatId, "🎉 یک نفر پیدا شد! می‌تونی چت رو شروع کنی.", chatKeyboard);
                        await sendMessage(partner.platform, partner.chat_id, "🎉 یک نفر پیدا شد! می‌تونی چت رو شروع کنی.", chatKeyboard);
                    } else {
                        await pool.query('UPDATE users SET step = $1 WHERE id = $2', ['SEARCHING', user.id]);
                        const cancelKeyboard = { keyboard: [[{ text: "❌ انصراف از جستجو" }]], resize_keyboard: true };
                        await sendMessage(platform, chatId, "⏳ در حال جستجوی یک فرد ناشناس...", cancelKeyboard);
                    }
                }
                else {
                    // فعلاً بقیه دکمه‌ها منطق ندارند
                    await sendMessage(platform, chatId, "این بخش به زودی در فازهای بعدی فعال می‌شود...");
                }
            }
            else if (user.step === 'SEARCHING' && text) {
                if (text === "❌ انصراف از جستجو" || text === '/start') {
                    await pool.query('UPDATE users SET step = $1 WHERE id = $2', ['REGISTERED', user.id]);
                    await sendMessage(platform, chatId, "🛑 جستجو لغو شد.");
                    await sendMainMenu(platform, chatId);
                } else {
                    await sendMessage(platform, chatId, "⏳ هنوز در حال جستجو هستیم... برای لغو، دکمه پایین را بزن.");
                }
            }
            else if (user.step === 'CHATTING' && text) {
                if (text === "❌ لغو چت" || text === '/start') {
                    await pool.query('UPDATE users SET step = $1, partner_id = NULL WHERE id = $2', ['REGISTERED', user.id]);
                    await sendMessage(platform, chatId, "🔴 شما چت را ترک کردید.");
                    await sendMainMenu(platform, chatId);

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
        
        // پردازش دکمه‌های شیشه‌ای
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
                    await sendMessage(platform, chatId, `✅ استان ${province} ثبت شد.\nشهر خودت رو انتخاب کن:`, createInlineKeyboard(cities, 'cty_', 3));
                }
                else if (user.step === 'ASK_CITY' && data.startsWith('cty_')) {
                    const city = data.replace('cty_', '');
                    await pool.query('UPDATE users SET city = $1, step = $2 WHERE id = $3', [city, 'ASK_JOB', user.id]);
                    await sendMessage(platform, chatId, `🎉 عالی! شهر ${city} هم ثبت شد.\n💼 حالا شغل خودت رو تایپ کن (یا از دکمه رد کردن استفاده کن):`, skipKeyboard);
                }
                else if (user.step === 'CHECK_JOIN' && data === 'check_join') {
                    // فعلا به صورت آزمایشی عضویت تایید می‌شود. (در آینده به API تلگرام وصل می‌شود)
                    await pool.query('UPDATE users SET step = $1 WHERE id = $2', ['REGISTERED', user.id]);
                    
                    const successText = `🎉 شما 1000 توکن، 20 سکه و 20 امتیاز دریافت کردید!\n\n` +
                                        `🔸 با رسیدن توکن به حداقل برداشت، میتوانید درخواست برداشت بدهید.\n` +
                                        `🔸 با استفاده از سکه‌ها، میتوانید با کاربران دیگر صحبت کنید.\n` +
                                        `🔸 با جمع آوری امتیاز، جزو 100 نفر برتر در 100 روز شوید و جایزه بگیرید.`;
                    
                    // حذف کیبوردهای قبلی و نمایش پیام موفقیت
                    await sendMessage(platform, chatId, "✅ عضویت شما تایید شد.", { remove_keyboard: true });
                    await sendMessage(platform, chatId, successText);
                    
                    // نمایش منوی اصلی
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

app.get('/', (req, res) => { res.send('Bot Server is Running! (Advanced Registration)'); });
app.listen(PORT, () => { console.log(`Server is running on port ${PORT}`); });
