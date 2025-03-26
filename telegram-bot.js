const { Telegraf } = require('telegraf');

function botInstance(token) {
  if (!token) {
    throw new Error('Токен бота не указан');
  }

  const bot = new Telegraf(token);
  
  bot.catch((err, ctx) => {
    console.error('Telegram bot error:', err);
  });

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));

  bot.launch().catch(console.error);
  
  return bot;
}

async function sendNotification(bot, chatId, message) {
  if (!bot || !chatId) return false;
  
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

module.exports = {
  botInstance,
  sendNotification
};