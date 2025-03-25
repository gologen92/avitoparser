const { Telegraf } = require('telegraf');

// Инициализация бота
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '7684090580:AAHVWxTUJ9gB5F9vOvoS6GZuRsm4cB5-cks');

// Функция для отправки уведомлений
async function sendNotification(chatId, message) {
  try {
    await bot.telegram.sendMessage(
      chatId, 
      message,
      { 
        parse_mode: 'HTML',
        disable_web_page_preview: true 
      }
    );
    return true;
  } catch (error) {
    console.error('Telegram send error:', error);
    return false;
  }
}

// Запуск бота в фоновом режиме
bot.launch()
  .then(() => console.log('Telegram bot connected'))
  .catch(err => console.error('Telegram bot error:', err));

module.exports = { sendNotification };
