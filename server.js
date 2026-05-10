require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { Pool } = require('pg');
const fs = require('fs'); // اضافه شده برای مدیریت فایل
const FormData = require('form-data'); // اضافه شده برای ارسال فایل به تلگرام/بله
const locations = require('./locations');

// --- ایمپورت فایل‌های جدید تست ---
const mbti = require('./mbti_test'); 
const pdfGenerator = require('./pdf_generator'); 
// ---------------------------------

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const BALE_TOKEN = process.env.BALE_TOKEN;
const BOT_USERNAME = process.env.BOT_USERNAME || 'YOUR_BOT_USERNAME'; 
const MBTI_TEST_COIN_COST = parseInt(process.env.MBTI_TEST_COIN_COST) || 5; 

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const BALE_API = `https://tapi.bale.ai/bot${BALE_TOKEN}`;

const CHANNEL_USERNAME = '@CROWCHAT_1';
const SECOND_CHANNEL_USERNAME = '@ADS_LINK2';

const mbtiPairs = {
    'INTJ': 'ENFP', 'ENFP': 'INTJ', 'INFJ': 'ENTP', 'ENTP': 'INFJ',
    'INFP': 'ENFJ', 'ENFJ': 'INFP', 'INTP': 'ENTJ', 'ENTJ': 'INTP',
    'ISFJ': 'ESTP', 'ESTP': 'ISFJ', 'ISTJ': 'ESFP', 'ESFP': 'ISTJ',
    'ISFP': 'ESFJ', 'ESFJ': 'ISFP', 'ISTP': 'ESTJ', 'ESTJ': 'ISTP'
};

const MBTI_BUY_TEXT = `تست شخصیت‌شناسی بر پایه مدل MBTI 🧠

این تست به شما کمک می‌کند تیپ شخصیتی خود را بشناسید و بفهمید در ارتباطات، کار، تصمیم‌گیری و رشد فردی چه الگوهایی دارید.

💰 هزینه انجام تست: ${MBTI_TEST_COIN_COST} سکه (از موجودی شما کسر می‌شود)
⏱ زمان تقریبی: ۱۰ تا ۱۵ دقیقه

آیا برای شروع تست آماده‌اید؟`;

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
                partner_id INTEGER,
                job VARCHAR(100),
                photo_id VARCHAR(255),
                receive_anon INTEGER DEFAULT 1,
                gender_edit_count INTEGER DEFAULT 0,
                personality_type VARCHAR(20),
                internal_username VARCHAR(20),
                mbti_step INTEGER DEFAULT 0,
                mbti_answers TEXT DEFAULT '{}',
                mbti_ties TEXT DEFAULT '[]',
                UNIQUE(chat_id, platform)
            );
        `);
        await pool.query(`UPDATE users SET internal_username = 'USER_' || id || 'X' WHERE internal_username IS NULL;`);
        console.log("Database Ready with Coin Payment MBTI Module!");
    } catch (error) {
        console.error("DB Error:", error.message);
    }
}
initDB();

function toEnglishDigits(str) {
    const persianNumbers = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return str.split('').map(c => {
        let index = persianNumbers.indexOf(c); return index !== -1 ? index : c;
    }).join('');
}

function generateInternalUsername() {
    return 'USER_' + Math.random().toString(36).substring(2, 9).toUpperCase();
}

async function sendMessage(platform, chatId, text, replyMarkup = null) {
    const url = platform === 'telegram' ? TELEGRAM_API : BALE_API;
    const payload = { chat_id: chatId, text: text };
    if (replyMarkup) { payload.reply_markup = replyMarkup; }
    try { await axios.post(`${url}/sendMessage`, payload); } 
    catch (error) { console.error(`Send Message Error:`, error.response?.data || error.message); }
}

async function editMessageText(platform, chatId, messageId, text, replyMarkup = null) {
    const url = platform === 'telegram' ? TELEGRAM_API : BALE_API;
    const payload = { chat_id: chatId, message_id: messageId, text: text };
    if (replyMarkup) { payload.reply_markup = replyMarkup; }
    try { await axios.post(`${url}/editMessageText`, payload); } 
    catch (error) { console.error(`Edit Message Error:`, error.response?.data || error.message); }
}

// --- تابع جدید برای ارسال فایل PDF به کاربر ---
async function sendDocument(platform, chatId, filePath) {
    const url = platform === 'telegram' ? TELEGRAM_API : BALE_API;
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('document', fs.createReadStream(filePath));
    try {
        await axios.post(`${url}/sendDocument`, form, {
            headers: form.getHeaders()
        });
    } catch (error) {
        console.error(`Send Document Error:`, error.response?.data || error.message);
    }
}
// ----------------------------------------------

function createInlineKeyboard(items, prefix, columns = 3) {
    let keyboard = [], row = [];
    for (let i = 0; i < items.length; i++) {
        row.push({ text: items[i], callback_data: prefix + items[i] });
        if (row.length === columns || i === items.length - 1) { keyboard.push(row); row = []; }
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

const skipKeyboard = { keyboard: [[{ text: "رد کردن ⏭" }]], resize_keyboard: true, one_time_keyboard: true };

function getJoinKeyboard(platform) {
    const usernameToUrl = (u) => platform === 'telegram' ? `https://t.me/${u.replace('@', '')}` : `https://ble.ir/${u.replace('@', '')}`;
    return {
        inline_keyboard: [
            [{ text: "📢 کانال اطلاع‌رسانی", url: usernameToUrl(CHANNEL_USERNAME) }],
            [{ text: "📢 کانال دوم", url: usernameToUrl(SECOND_CHANNEL_USERNAME) }],
            [{ text: "✅ بررسی عضویت", callback_data: "check_join" }]
        ]
    };
}

async function showProfile(user, platform, chatId) { 
    let caption = `👤 **پروفایل شما**\n\n📝 نام: ${user.username}\n⚧ جنسیت: ${user.gender}\n🎂 سن: ${user.age}\n📍 مکان: ${user.province} - ${user.city}\n💼 شغل: ${user.job || 'ثبت نشده'}\n🧠 تیپ شخصیتی: ${user.personality_type || 'نامشخص'}\n\n🔑 یوزرنیم داخلی: /${user.internal_username}`;
    const kb = {
        inline_keyboard: [
            [{ text: 'ویرایش پروفایل ✏️', callback_data: 'prof_edit_menu' }],
            [{ text: 'موجودی من 💰', callback_data: 'prof_balance' }]
        ]
    };
    await sendMessage(platform, chatId, caption, kb);
}

async function sendTestQuestion(platform, chatId, messageId, questionObj, step) {
    const text = `📝 سوال ${step} از ۶۰\n\n${questionObj.q}`;
    const kb = {
        inline_keyboard: [
            [{ text: `الف) ${questionObj.a}`, callback_data: `mbtians_${step}_A` }],
            [{ text: `ب) ${questionObj.b}`, callback_data: `mbtians_${step}_B` }],
            [{ text: "❌ انصراف از تست", callback_data: "mbti_cancel_test" }]
        ]
    };
    if (messageId) {
        await editMessageText(platform, chatId, messageId, text, kb);
    } else {
        await sendMessage(platform, chatId, text, kb);
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

            if (text && text.toUpperCase() === '/RESET') {
                await pool.query('DELETE FROM users WHERE chat_id = $1 AND platform = $2', [chatId, platform]);
                return await sendMessage(platform, chatId, "♻️ ریست شد.", { remove_keyboard: true });
            }

            let userResult = await pool.query('SELECT * FROM users WHERE chat_id = $1 AND platform = $2', [chatId, platform]);
            if (userResult.rows.length === 0) {
                const intUsername = generateInternalUsername();
                await pool.query('INSERT INTO users (chat_id, platform, step, internal_username) VALUES ($1, $2, $3, $4)', [chatId, platform, 'ASK_GENDER', intUsername]);
                const kb = { inline_keyboard: [[{ text: "پسر 👦", callback_data: "gender_boy" }, { text: "دختر 👧", callback_data: "gender_girl" }]] };
                return await sendMessage(platform, chatId, "لطفاً جنسیت خود را انتخاب کنید:", kb);
            }

            const user = userResult.rows[0];

            if (user.step === 'REGISTERED' && text) {
                if (text === '/start') {
                    await sendMainMenu(platform, chatId);
                } else if (text === "تست شخصیتی 🧠") {
                    const kb = {
                        inline_keyboard: [
                            [{ text: "توضیحات تیپ شخصیتی 📖", callback_data: "mbti_info" }],
                            [{ text: "انتخاب دستی تیپ شخصیتی 🎯", callback_data: "mbti_select_menu" }],
                            [{ text: "شروع تست با پرداخت سکه 🛒", callback_data: "mbti_buy_test" }]
                        ]
                    };
                    await sendMessage(platform, chatId, "بخش شخصیت‌شناسی MBTI:\nیک گزینه را انتخاب کنید:", kb);
                }
            }
        }
        else if (body.callback_query) {
            const query = body.callback_query;
            const chatId = query.message.chat.id.toString();
            const msgId = query.message.message_id;
            const data = query.data;

            let userResult = await pool.query('SELECT * FROM users WHERE chat_id = $1 AND platform = $2', [chatId, platform]);
            if (userResult.rows.length > 0) {
                const user = userResult.rows[0];

                if (data === 'mbti_buy_test') {
                    if (user.coins >= MBTI_TEST_COIN_COST) {
                        const kb = {
                            inline_keyboard: [
                                [{ text: `تایید پرداخت (${MBTI_TEST_COIN_COST} سکه) و شروع 💳`, callback_data: "mbti_start_test" }],
                                [{ text: "انصراف ❌", callback_data: "mbti_cancel_test" }]
                            ]
                        };
                        await editMessageText(platform, chatId, msgId, MBTI_BUY_TEXT, kb);
                    } else {
                        await editMessageText(platform, chatId, msgId, `❌ موجودی سکه شما کافی نیست.\n\nهزینه تست: ${MBTI_TEST_COIN_COST} سکه\nموجودی شما: ${user.coins} سکه\n\nبرای شارژ حساب از منوی اصلی روی گزینه "سکه 🪙" کلیک کنید.`);
                    }
                }
                
                else if (data === 'mbti_start_test') {
                    if (user.coins >= MBTI_TEST_COIN_COST) {
                        await pool.query('UPDATE users SET coins = coins - $1, mbti_step = 1, mbti_answers = $2, mbti_ties = $3 WHERE id = $4', [MBTI_TEST_COIN_COST, '{}', '[]', user.id]);
                        await sendTestQuestion(platform, chatId, msgId, mbti.questions[0], 1);
                    } else {
                        await editMessageText(platform, chatId, msgId, "❌ موجودی کافی نیست.");
                    }
                }

                else if (data === 'mbti_cancel_test') {
                    await pool.query('UPDATE users SET mbti_step = 0, mbti_answers = $1, mbti_ties = $2 WHERE id = $3', ['{}', '[]', user.id]);
                    await editMessageText(platform, chatId, msgId, "🛑 تست لغو شد.");
                }

                else if (data.startsWith('mbtians_')) {
                    const parts = data.split('_');
                    const qId = parseInt(parts[1]);
                    const ans = parts[2];

                    if (user.mbti_step === qId) {
                        let answers = JSON.parse(user.mbti_answers || '{}');
                        answers[qId] = ans;
                        let nextStep = qId + 1;

                        await pool.query('UPDATE users SET mbti_step = $1, mbti_answers = $2 WHERE id = $3', [nextStep, JSON.stringify(answers), user.id]);

                        if (nextStep <= 60) {
                            await sendTestQuestion(platform, chatId, msgId, mbti.questions[nextStep - 1], nextStep);
                        } else {
                            let result = mbti.calculateResult(answers);
                            if (result.hasTies) {
                                await pool.query('UPDATE users SET mbti_ties = $1 WHERE id = $2', [JSON.stringify(result.ties), user.id]);
                                let tieDim = result.ties[0];
                                let tq = mbti.tieBreakers[tieDim];
                                let text = `⚖️ نتایج شما در بُعد (${tieDim}) مساوی شده است. برای تشخیص دقیق‌تر، لطفاً به سوال تکمیلی پاسخ دهید:\n\n${tq.q}`;
                                let kb = {
                                    inline_keyboard: [
                                        [{ text: `الف) ${tq.a}`, callback_data: `mbtitie_${tieDim}_A` }],
                                        [{ text: `ب) ${tq.b}`, callback_data: `mbtitie_${tieDim}_B` }]
                                    ]
                                };
                                await editMessageText(platform, chatId, msgId, text, kb);
                            } else {
                                await pool.query('UPDATE users SET personality_type = $1, mbti_step = 0 WHERE id = $2', [result.finalType, user.id]);
                                
                                // --- تغییرات در نمایش خروجی نهایی 60 سوال ---
                                let outText = mbti.formatShortResult(result);
                                let kb = {
                                    inline_keyboard: [
                                        [{ text: "گزارش کامل تیپ 📄", callback_data: "mbti_full_report" }],
                                        [{ text: "دانلود فایل PDF 📥", callback_data: "mbti_pdf" }]
                                    ]
                                };
                                await editMessageText(platform, chatId, msgId, outText, kb);
                                // --------------------------------------------
                            }
                        }
                    }
                }

                else if (data.startsWith('mbtitie_')) {
                    const parts = data.split('_');
                    const dim = parts[1];
                    const ans = parts[2];

                    let answers = JSON.parse(user.mbti_answers || '{}');
                    let ties = JSON.parse(user.mbti_ties || '[]');
                    answers['tie_' + dim] = ans;

                    let currentTieIndex = ties.indexOf(dim);
                    let nextTieIndex = currentTieIndex + 1;

                    await pool.query('UPDATE users SET mbti_answers = $1 WHERE id = $2', [JSON.stringify(answers), user.id]);

                    if (nextTieIndex < ties.length) {
                        let nextDim = ties[nextTieIndex];
                        let tq = mbti.tieBreakers[nextDim];
                        let text = `⚖️ بُعد بعدی که مساوی شده است (${nextDim}). لطفاً پاسخ دهید:\n\n${tq.q}`;
                        let kb = {
                            inline_keyboard: [
                                [{ text: `الف) ${tq.a}`, callback_data: `mbtitie_${nextDim}_A` }],
                                [{ text: `ب) ${tq.b}`, callback_data: `mbtitie_${nextDim}_B` }]
                            ]
                        };
                        await editMessageText(platform, chatId, msgId, text, kb);
                    } else {
                        let result = mbti.calculateResult(answers);
                        await pool.query('UPDATE users SET personality_type = $1, mbti_step = 0 WHERE id = $2', [result.finalType, user.id]);
                        
                        // --- تغییرات در نمایش خروجی نهایی Tie-Breaker ---
                        let outText = `🎉 با بررسی سوالات تکمیلی نتیجه شما آماده شد:\n\n` + mbti.formatShortResult(result);
                        let kb = {
                            inline_keyboard: [
                                [{ text: "گزارش کامل تیپ 📄", callback_data: "mbti_full_report" }],
                                [{ text: "دانلود فایل PDF 📥", callback_data: "mbti_pdf" }]
                            ]
                        };
                        await editMessageText(platform, chatId, msgId, outText, kb);
                        // --------------------------------------------
                    }
                }

                // === اکشن‌های جدید برای گزارش کامل و تولید PDF ===
                else if (data === 'mbti_full_report') {
                    let answers = JSON.parse(user.mbti_answers || '{}');
                    let result = mbti.calculateResult(answers);
                    let fullText = mbti.formatFullReport(result);
                    await sendMessage(platform, chatId, fullText);
                }
                
                else if (data === 'mbti_pdf') {
                    await sendMessage(platform, chatId, "⏳ در حال آماده‌سازی فایل PDF گزارش شما، لطفاً چند لحظه صبر کنید...");
                    try {
                        let answers = JSON.parse(user.mbti_answers || '{}');
                        let result = mbti.calculateResult(answers);
                        
                        // ساخت فایل PDF
                        let pdfPath = await pdfGenerator.createPdfReport(chatId, result);
                        
                        // ارسال فایل
                        await sendDocument(platform, chatId, pdfPath);
                        
                        // (اختیاری) پاک کردن فایل پس از ارسال برای خالی شدن فضای سرور
                        fs.unlink(pdfPath, (err) => {
                            if (err) console.error("Error deleting PDF:", err);
                        });
                    } catch (err) {
                        console.error("PDF Generation Error:", err);
                        await sendMessage(platform, chatId, "❌ متاسفانه خطایی در تولید PDF رخ داد.");
                    }
                }
                // =================================================

            }
        }
    } catch (error) {
        console.error("Handler Error:", error.message);
    }
}

app.post('/webhook/telegram', (req, res) => handleUpdate('telegram', req, res));
app.post('/webhook/bale', (req, res) => handleUpdate('bale', req, res));

app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
