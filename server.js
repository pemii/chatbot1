//================================================================================================================
//===================================================[ CONFIG ]===================================================
//================================================================================================================

// import dependencies
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const db = require('./database');
const { getMbtiQuestion, getMbtiResult, questions: mbtiQuestions } = require('./mbti_test');
const pdfGenerator = require('./pdf_generator');

// environment variables
const {
    TELEGRAM_BOT_TOKEN,
    BALE_BOT_TOKEN,
    SERVER_URL,
    PORT,
    ADMIN_CHAT_ID
} = process.env;

// initialize express app
const app = express();
app.use(bodyParser.json());

// bot instances
const TelegramBot = require('node-telegram-bot-api');
const telegramBot = new TelegramBot(TELEGRAM_BOT_TOKEN);
telegramBot.setWebHook(`${SERVER_URL}/telegram/${TELEGRAM_BOT_TOKEN}`);

const BaleBot = require('bale-bot-api');
const baleBot = new BaleBot(BALE_BOT_TOKEN);
baleBot.setWebHook(`${SERVER_URL}/bale/${BALE_BOT_TOKEN}`);

// A simple in-memory store for transient data, like messages awaiting confirmation.
// In a production environment, you might want to use a more persistent store like Redis.
const tempDataStore = new Map();


//================================================================================================================
//===============================================[ BOT HELPERS ]==================================================
//================================================================================================================

/**
 * A wrapper to send a message to the correct platform (Telegram or Bale).
 * @param {string} platform - 'telegram' or 'bale'
 * @param {number|string} chatId - The chat ID to send the message to.
 * @param {string} text - The text of the message.
 * @param {object|null} keyboard - The keyboard markup.
 * @returns {Promise<object>} - The sent message object.
 */
async function sendMessage(platform, chatId, text, keyboard = null) {
    try {
        if (platform === 'telegram') {
            return await telegramBot.sendMessage(chatId, text, {
                reply_markup: keyboard,
                parse_mode: 'Markdown',
            });
        } else if (platform === 'bale') {
            // Bale requires a different structure for keyboards
            return await baleBot.sendMessage(chatId, text, {
                reply_markup: keyboard
            });
        }
    } catch (error) {
        console.error(`Error sending message on ${platform} to ${chatId}:`, error.message);
    }
}

/**
 * A wrapper to edit a message on the correct platform.
 * @param {string} platform - 'telegram' or 'bale'
 * @param {number|string} chatId - The chat ID of the message.
 * @param {number} messageId - The ID of the message to edit.
 * @param {string} text - The new text for the message.
 * @param {object|null} keyboard - The new keyboard markup.
 */
async function editMessage(platform, chatId, messageId, text, keyboard = null) {
    try {
        if (platform === 'telegram') {
            await telegramBot.editMessageText(text, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: keyboard,
                parse_mode: 'Markdown'
            });
        } else if (platform === 'bale') {
            await baleBot.editMessageText(chatId, messageId, text, {
                reply_markup: keyboard
            });
        }
    } catch (error) {
        // Ignore errors caused by trying to edit an identical message
        if (!error.message.includes('message is not modified')) {
            console.error(`Error editing message on ${platform}:`, error.message);
        }
    }
}


/**
 * A wrapper to send a document to the correct platform.
 * @param {string} platform - 'telegram' or 'bale'
 * @param {number|string} chatId - The chat ID to send the document to.
 * @param {string} filePath - The path to the document.
 * @param {object} options - Additional options (e.g., caption).
 */
async function sendDocument(platform, chatId, filePath, options = {}) {
    try {
        if (platform === 'telegram') {
            await telegramBot.sendDocument(chatId, filePath, options);
        } else if (platform === 'bale') {
            await baleBot.sendDocument(chatId, filePath, options);
        }
        // Optional: Delete the file after sending to save space
        fs.unlinkSync(filePath);
    } catch (error) {
        console.error(`Error sending document on ${platform}:`, error.message);
        await sendMessage(platform, chatId, 'خطایی در ارسال فایل رخ داد. لطفاً با پشتیبانی تماس بگیرید.');
    }
}


/**
 * A wrapper to answer a callback query on the correct platform.
 * @param {string} platform - 'telegram' or 'bale'
 * @param {string} callbackQueryId - The ID of the callback query.
 * @param {string|null} text - The text to show as a notification.
 */
async function answerCallback(platform, callbackQueryId, text = null) {
    try {
        const options = text ? { text } : {};
        if (platform === 'telegram') {
            await telegramBot.answerCallbackQuery(callbackQueryId, options);
        } else if (platform === 'bale') {
            await baleBot.answerCallbackQuery(callbackQueryId, options);
        }
    } catch (error) {
        console.error(`Error answering callback on ${platform}:`, error.message);
    }
}


//================================================================================================================
//==============================================[ CORE LOGIC ]====================================================
//================================================================================================================

/**
 * Handles the start of the MBTI test.
 */
async function startMbtiTest(platform, chatId, user) {
    if (user.mbti_result) {
        await sendMessage(platform, chatId, 'شما قبلاً در تست MBTI شرکت کرده‌اید. می‌توانید نتیجه خود را از پروفایل مشاهده کنید.');
        return;
    }
    await db.updateUserStep(chatId, "MBTI_TEST_IN_PROGRESS", { mbti_answers: "" });
    const firstQuestion = getMbtiQuestion(0);
    await sendMessage(platform, chatId, firstQuestion.text, firstQuestion.keyboard);
}

/**
 * Handles a user's answer to an MBTI question.
 * EDITS the existing message with the next question.
 */
async function handleMbtiAnswer(platform, chatId, user, data, messageId) {
    const answer = data.split('_')[2];
    const currentAnswers = user.mbti_answers || "";
    const updatedAnswers = currentAnswers + answer;

    await db.updateUser(chatId, { mbti_answers: updatedAnswers });

    const nextQuestionIndex = updatedAnswers.length;

    if (nextQuestionIndex < mbtiQuestions.length) {
        const nextQuestion = getMbtiQuestion(nextQuestionIndex);
        // Edit the message with the new question
        await editMessage(platform, chatId, messageId, nextQuestion.text, nextQuestion.keyboard);
    } else {
        // Test is finished
        const result = getMbtiResult(updatedAnswers);
        await db.updateUser(chatId, { mbti_result: result.type, mbti_answers: updatedAnswers });
        await db.updateUserStep(chatId, null);

        const resultText = `🎉 تست شما به پایان رسید! 🎉\n\nتیپ شخصیتی شما: *${result.type}*\n\nشما می‌توانید تحلیل کامل شخصیت خود را با خرید گزارش PDF دریافت کنید.`;
        const resultKeyboard = {
            inline_keyboard: [
                [{ text: "دریافت گزارش کامل (PDF) ⚡️", callback_data: "mbti_full_report" }],
                [{ text: "بازگشت به منوی اصلی  меню", callback_data: "main_menu" }]
            ]
        };
        await editMessage(platform, chatId, messageId, resultText, resultKeyboard);
    }
}

/**
 * Displays the main menu keyboard.
 */
async function sendMainMenu(platform, chatId) {
    const text = "خوش آمدید! لطفاً یک گزینه را انتخاب کنید:";
    const keyboard = {
        keyboard: [
            [{ text: "چت با ناشناس 🎲" }, { text: "جستجوی ویژه 🔍" }],
            [{ text: "پروفایل ⚙️" }, { text: "ارسال به مخاطب ✉️" }],
            [{ text: "تست شخصیتی 🧠" }, { text: "ایردراپ 💎" }],
            [{ text: "سکه بخر 💰" }, { text: "راهنما ❓" }]
        ],
        resize_keyboard: true
    };
    await sendMessage(platform, chatId, text, keyboard);
}


//================================================================================================================
//=======================================[ NEW: DIRECT MESSAGE FEATURE ]==========================================
//================================================================================================================

const DIRECT_MESSAGE_COST = 2;

/**
 * Starts the flow for sending a message to a specific user.
 */
async function startDirectMessageFlow(platform, chatId, user) {
    if (user.coins < DIRECT_MESSAGE_COST) {
        await sendMessage(platform, chatId, `❌ برای ارسال پیام به مخاطب، به ${DIRECT_MESSAGE_COST} سکه نیاز دارید. سکه‌های شما کافی نیست.`);
        return;
    }

    await db.updateUserStep(chatId, 'DIRECT_MESSAGE_AWAIT_USERNAME');
    await sendMessage(platform, chatId, 'لطفا آیدی (یوزرنیم) تلگرام یا بله کاربر مورد نظر را وارد کنید (مثال: @username).');
}

/**
 * Handles the username input from the user.
 */
async function handleDirectMessageUsername(platform, chatId, user, username) {
    const targetUsername = username.startsWith('@') ? username.substring(1) : username;
    const targetUser = await db.findUserByUsername(targetUsername);

    if (!targetUser) {
        await sendMessage(platform, chatId, 'کاربری با این آیدی در ربات عضو نیست. لطفاً دوباره تلاش کنید یا به منوی اصلی بازگردید.');
        await db.updateUserStep(chatId, null); // Reset step
        return;
    }

    if (targetUser.chat_id === chatId) {
        await sendMessage(platform, chatId, 'شما نمی‌توانید به خودتان پیام ارسال کنید!');
        await db.updateUserStep(chatId, null); // Reset step
        return;
    }

    // Store target user's chat_id in a temporary object within the user's data
    const tempData = { direct_message_target_id: targetUser.chat_id };
    await db.updateUserStep(chatId, 'DIRECT_MESSAGE_AWAIT_CONTENT', tempData);

    await sendMessage(platform, chatId, '✅ کاربر پیدا شد. اکنون پیام خود را جهت ارسال وارد کنید.');
}

/**
 * Handles the message content input from the user.
 */
async function handleDirectMessageContent(platform, chatId, user, messageText) {
    // Store message content temporarily
    const tempData = { ...user.temp_data, direct_message_content: messageText };
    await db.updateUser(chatId, { temp_data: tempData });

    const confirmationText = `
آیا از ارسال پیام زیر مطمئن هستید؟

---
${messageText}
---

هزینه ارسال: ${DIRECT_MESSAGE_COST} سکه
`;
    const keyboard = {
        inline_keyboard: [
            [{ text: "✅ بله، بفرست", callback_data: "direct_message_confirm_send" }],
            [{ text: "❌ نه، لغو کن", callback_data: "direct_message_confirm_cancel" }]
        ]
    };
    await sendMessage(platform, chatId, confirmationText, keyboard);
}

/**
 * Handles the final confirmation (send or cancel) from the user.
 */
async function handleDirectMessageConfirmation(platform, chatId, user, action) {
    await db.updateUserStep(chatId, null); // Reset step regardless of action

    if (action === 'cancel') {
        await sendMessage(platform, chatId, 'ارسال پیام لغو شد.');
        return;
    }

    if (action === 'send') {
        if (user.coins < DIRECT_MESSAGE_COST) {
            await sendMessage(platform, chatId, '❌ سکه‌های شما برای ارسال این پیام کافی نیست. عملیات لغو شد.');
            return;
        }

        const { direct_message_target_id, direct_message_content } = user.temp_data;
        if (!direct_message_target_id || !direct_message_content) {
            await sendMessage(platform, chatId, 'خطایی رخ داد. اطلاعات پیام یافت نشد. لطفاً دوباره تلاش کنید.');
            return;
        }

        // 1. Deduct coins
        await db.updateUserCoins(chatId, user.coins - DIRECT_MESSAGE_COST);

        // 2. Prepare and send the message to the target
        const messageToTarget = `📩 شما یک پیام ناشناس جدید دارید:\n\n"_${direct_message_content}_"`;
        const keyboardForTarget = {
            inline_keyboard: [
                // This callback data includes the original sender's chat ID
                [{ text: "✅ خواندم", callback_data: `notify_sender_read_${chatId}` }]
                // Here you can add a "Reply" button for future implementation
            ]
        };
        // We need to determine the target's platform. For simplicity, we assume it's the same.
        // In a multi-platform bot, you'd need to store the user's platform in the DB.
        await sendMessage(platform, direct_message_target_id, messageToTarget, keyboardForTarget);

        // 3. Confirm sending to the original sender
        await sendMessage(platform, chatId, `✅ پیام شما با موفقیت ارسال شد و ${DIRECT_MESSAGE_COST} سکه از حساب شما کسر گردید.`);
    }
}

/**
 * Notifies the sender that their message was read.
 */
async function notifySenderMessageRead(platform, originalSenderChatId, readerName) {
    const notificationText = `📜 کاربری که برایش پیام فرستاده بودید، پیام شما را مشاهده کرد.`;
    // Assuming the same platform for the sender.
    await sendMessage(platform, originalSenderChatId, notificationText);
}


//================================================================================================================
//=================================================[ WEBHOOKS ]===================================================
//================================================================================================================

async function handleUpdate(platform, update) {
    let chatId, user, message, query;

    try {
        if (update.message) {
            message = update.message;
            chatId = message.chat.id;
        } else if (update.callback_query) {
            query = update.callback_query;
            chatId = query.from.id;
        } else {
            return; // Not a message or callback query
        }

        user = await db.findOrCreateUser(chatId, update);
        
        // --- Callback Query Handler ---
        if (query) {
            const data = query.data;
            
            await answerCallback(platform, query.id); // Answer immediately

            if (data.startsWith("mbti_ans_")) {
                if (user.step !== "MBTI_TEST_IN_PROGRESS") {
                    await sendMessage(platform, chatId, 'لطفا ابتدا تست را با زدن دکمه "تست شخصیتی 🧠" شروع کنید.');
                } else {
                    await handleMbtiAnswer(platform, chatId, user, data, query.message.message_id);
                }
            } else if (data === 'mbti_download_pdf') {
                 const state = getMbtiResult(user.mbti_answers);
                 if (state && state.result) {
                    const pdfPath = await pdfGenerator.createPdfReport(state.result);
                    if (pdfPath) {
                        await sendDocument(platform, chatId, pdfPath, { caption: '✅ گزارش تحلیل شخصیت شما آماده شد.' });
                    } else {
                         await sendMessage(platform, chatId, '❌ خطایی در ساخت فایل PDF رخ داد.');
                    }
                } else {
                    await sendMessage(platform, chatId, '❌ نتیجه‌ای برای ساخت PDF پیدا نشد. لطفاً ابتدا تست را کامل کنید.');
                }
            } else if (data.startsWith("direct_message_confirm_")) {
                const action = data.split('_')[3]; // 'send' or 'cancel'
                await handleDirectMessageConfirmation(platform, chatId, user, action);
            } else if (data.startsWith("notify_sender_read_")) {
                const originalSenderChatId = data.split('_')[3];
                await notifySenderMessageRead(platform, originalSenderChatId, user.name);
                // Remove the button after it's clicked
                await editMessage(platform, chatId, query.message.message_id, query.message.text + "\n\n(خوانده شد)", null);
            } else if (data === 'advsearch_menu') {
                const advSearchText = "لطفا نوع جستجو را انتخاب کنید:";
                const advSearchKeyboard = {
                    inline_keyboard: [
                        [{ text: 'هم استانی ها (کسر 1 سکه)', callback_data: 'advsearch_province' }],
                        [{ text: 'همسن (کسر 1 سکه)', callback_data: 'advsearch_age' }],
                        [{ text: 'تیپ شخصیتی (کسر 4 سکه)', callback_data: 'advsearch_personality' }],
                        [{ text: 'بازگشت ⬅️', callback_data: 'main_menu' }]
                    ]
                };
                await sendMessage(platform, chatId, advSearchText, advSearchKeyboard);
            }
            // ... other callback handlers ...

        // --- Message Handler ---
        } else if (message) {
            const text = message.text;
            
            if (text === '/start') {
                await sendMainMenu(platform, chatId);
            } else if (user.step === 'DIRECT_MESSAGE_AWAIT_USERNAME') {
                await handleDirectMessageUsername(platform, chatId, user, text);
            } else if (user.step === 'DIRECT_MESSAGE_AWAIT_CONTENT') {
                await handleDirectMessageContent(platform, chatId, user, text);
            } else {
                // Main menu text commands
                switch (text) {
                    case 'تست شخصیتی 🧠':
                        await startMbtiTest(platform, chatId, user);
                        break;
                    case 'ارسال به مخاطب ✉️':
                        await startDirectMessageFlow(platform, chatId, user);
                        break;
                    case 'جستجوی ویژه 🔍':
                        // Trigger the inline keyboard via callback for consistency
                        const event = { callback_query: { id: 'fake_id', data: 'advsearch_menu', from: { id: chatId } } };
                        await handleUpdate(platform, event);
                        break;
                    // ... other menu commands
                    default:
                        // Handle other non-command messages (e.g., during a chat)
                        // ...
                        break;
                }
            }
        }

    } catch (error) {
        console.error('Error in handleUpdate:', error);
        if (chatId) {
            await sendMessage(platform, chatId, 'یک خطای غیرمنتظره رخ داد. در حال بررسی هستیم.');
        }
    }
}

// Telegram webhook endpoint
app.post(`/telegram/${TELEGRAM_BOT_TOKEN}`, async (req, res) => {
    handleUpdate('telegram', req.body);
    res.sendStatus(200);
});

// Bale webhook endpoint
app.post(`/bale/${BALE_BOT_TOKEN}`, async (req, res) => {
    handleUpdate('bale', req.body);
    res.sendStatus(200);
});

// Start the server
app.listen(PORT, async () => {
    console.log(`Server is running on port ${PORT}`);
    await db.init(); // Initialize database connection and tables
    console.log('Database initialized.');
});
