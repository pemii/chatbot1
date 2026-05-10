require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const BALE_TOKEN = process.env.BALE_TOKEN;

// آدرس‌های API تلگرام و بله
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const BALE_API = `https://tapi.bale.ai/bot${BALE_TOKEN}`;

// سنسور دریافت پیام از تلگرام
app.post('/webhook/telegram', async (req, res) => {
    try {
        const message = req.body.message;
        if (message && message.text === '/start') {
            const chatId = message.chat.id;
            await axios.post(`${TELEGRAM_API}/sendMessage`, {
                chat_id: chatId,
                text: "سلام! ارتباط سرور تلگرام با رندر با موفقیت برقرار شد. منتظر تکمیل ربات باشید."
            });
        }
    } catch (error) {
        console.error("Error in Telegram:", error.message);
    }
    res.sendStatus(200);
});

// سنسور دریافت پیام از بله
app.post('/webhook/bale', async (req, res) => {
    try {
        const message = req.body.message;
        if (message && message.text === '/start') {
            const chatId = message.chat.id;
            await axios.post(`${BALE_API}/sendMessage`, {
                chat_id: chatId,
                text: "سلام! ارتباط سرور بله با رندر با موفقیت برقرار شد. منتظر تکمیل ربات باشید."
            });
        }
    } catch (error) {
        console.error("Error in Bale:", error.message);
    }
    res.sendStatus(200);
});

// صفحه اصلی برای تست روشن بودن سرور
app.get('/', (req, res) => {
    res.send('Bot Server is Running!');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
