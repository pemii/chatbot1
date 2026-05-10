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
// نام کاربری ربات برای تولید لینک پیام ناشناس (در .env اضافه کنید)
const BOT_USERNAME = process.env.BOT_USERNAME || 'YOUR_BOT_USERNAME'; 

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const BALE_API = `https://tapi.bale.ai/bot${BALE_TOKEN}`;

// آیدی‌های کانال‌های عضویت
const CHANNEL_USERNAME = '@CROWCHAT_1';
const SECOND_CHANNEL_USERNAME = '@ADS_LINK2';

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

        // ستون‌های قبلی
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS partner_id INTEGER;`);
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS job VARCHAR(100);`);
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_id VARCHAR(255);`);
        
        // ستون‌های جدید برای تنظیمات پروفایل
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS receive_anon INTEGER DEFAULT 1;`);
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS gender_edit_count INTEGER DEFAULT 0;`);

        // جدول‌های جدید برای روابط کاربری
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

        console.log("Database Ready with New Features!");
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

// تابع جدید برای ارسال عکس
async function sendPhoto(platform, chatId, photoId, caption, replyMarkup = null) {
    const url = platform === 'telegram' ? TELEGRAM_API : BALE_API;
    const payload = { chat_id: chatId, photo: photoId, caption: caption };
    if (replyMarkup) { payload.reply_markup = replyMarkup; }
    try {
        await axios.post(`${url}/sendPhoto`, payload);
    } catch (error) {
        console.error(`Send Photo Error (${platform}):`, error.response?.data || error.message);
        // Fallback: اگر ارسال عکس خطا داد، حداقل متن را بفرستد
        await sendMessage(platform, chatId, caption, replyMarkup);
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
    const successText = `✅ عضویت شما تایید شد.\n\n🎉 شما 1000 توکن، 20 سکه و 20 امتیاز دریافت کردید!`;
    await sendMessage(platform, chatId, "✅ عضویت شما تایید شد.", { remove_keyboard: true });
    await sendMessage(platform, chatId, successText);
    await sendMainMenu(platform, chatId);
}

// تابع جدید برای نمایش پروفایل
async function showProfile(user, platform, chatId) {
    const anonStatus = user.receive_anon === 1 ? 'فعال ✅' : 'غیرفعال ❌';
    let caption = `👤 **پروفایل شما**\n\n`;
    caption += `📝 نام: ${user.username}\n`;
    caption += `⚧ جنسیت: ${user.gender}\n`;
    caption += `🎂 سن: ${user.age}\n`;
    caption += `📍 مکان: ${user.province} - ${user.city}\n`;
    caption += `💼 شغل: ${user.job || 'ثبت نشده'}\n\n`;
    caption += `🆔 شناسه کاربری: ${user.id}`;

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
                await pool.query('INSERT INTO users (chat_id, platform, step) VALUES ($1, $2, $3)', [chatId, platform, 'ASK_GENDER']);
                const keyboard = { inline_keyboard: [[{ text: "پسر هستم 👦", callback_data: "gender_boy" }, { text: "دختر هستم 👧", callback_data: "gender_girl" }]] };
                await sendMessage(platform, chatId, "سلام! به ربات چت ناشناس خوش اومدی.\nلطفاً جنسیت خودت رو انتخاب کن:", keyboard);
                return;
            }

            const user = userResult.rows[0];

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

            // --- هندل کردن حالت‌های ویرایش پروفایل ---
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

            else if (user.step === 'REGISTERED' && text) {
                if (text === '/start') {
                    await sendMainMenu(platform, chatId);
                }
                else if (text === "چت با ناشناس 👤") {
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
                        await sendMessage(platform, chatId, "⏳ در حال جستجوی یک فرد ناشناس...", { keyboard: [[{ text: "❌ انصراف از جستجو" }]], resize_keyboard: true });
                    }
                }
                // --- بخش پروفایل و جستجوی ویژه ---
                else if (text === "پروفایل ⚙️") {
                    await showProfile(user, platform, chatId);
                }
                else if (text === "جستجوی ویژه 🔍") {
                    const kb = {
                        inline_keyboard: [
                            [{ text: 'هم استانی ها 📍', callback_data: 'advsearch_province' }],
                            [{ text: 'همسن 🎂', callback_data: 'advsearch_age' }]
                        ]
                    };
                    await sendMessage(platform, chatId, "🔍 به چه کسی میخوای وصل بشی؟", kb);
                }
                else {
                    await sendMessage(platform, chatId, "این بخش به زودی فعال می‌شود...");
                }
            }
            else if (user.step === 'SEARCHING' && text) {
                if (text === "❌ انصراف از جستجو" || text === '/start') {
                    await pool.query('UPDATE users SET step = $1 WHERE id = $2', ['REGISTERED', user.id]);
                    await sendMessage(platform, chatId, "🛑 جستجو لغو شد.");
                    await sendMainMenu(platform, chatId);
                } else {
                    await sendMessage(platform, chatId, "⏳ هنوز در حال جستجو هستیم...");
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
                } else if (user.partner_id) {
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

                // --- هندل کردن دکمه‌های پروفایل ---
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
                else if (['prof_followers', 'prof_following', 'prof_likers'].includes(data)) {
                    await sendMessage(platform, chatId, "این لیست در حال آماده سازی است... (نیازمند کوئری دیتابیس)");
                }

                // --- هندل کردن Action های ویرایش ---
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
                else if (data === 'edit_location' || data === 'edit_photo') {
                     await sendMessage(platform, chatId, "این بخش از ویرایش به زودی پیاده سازی می‌شود...");
                }

                // --- هندل کردن لایه‌های جستجوی ویژه ---
                else if (data.startsWith('advsearch_')) {
                    const searchMode = data.split('_')[1];
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
                    const searchMode = parts[1]; // province یا age
                    const targetGender = parts[2]; // female, male, all
                    await sendMessage(platform, chatId, `🔍 در حال جستجوی کاربران (${searchMode}) با فیلتر جنسیت (${targetGender})...\n\n(کوئری‌های مربوطه در مرحله بعد نوشته می‌شود)`);
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
    res.send('Bot Server is Running! (Advanced Profile & Search Added)');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
