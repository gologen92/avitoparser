const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { botInstance, sendNotification } = require('./telegram-bot');
const db = require('./database');

let mainWindow;
let telegramBot = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true
    }
  });

  mainWindow.loadFile('index.html');

  // Открытие DevTools (только для разработки)
  // mainWindow.webContents.openDevTools();
}

// Обработчики IPC
ipcMain.handle('parse-data', async (_, { keyword, price, city, limit = 50 }) => {
  try {
    const results = await require('./puppeteer-parser')(keyword, price, city, limit);
    
    if (telegramBot) {
      const chatId = process.env.TELEGRAM_CHAT_ID;
      await sendNotification(telegramBot, chatId, `Найдено ${results.length} объявлений`);
    }
    
    return results;
  } catch (error) {
    if (telegramBot) {
      const chatId = process.env.TELEGRAM_CHAT_ID;
      await sendNotification(telegramBot, chatId, `❌ Ошибка парсинга: ${error.message}`);
    }
    throw error;
  }
});

ipcMain.handle('save-ad', (_, ad) => {
  return db.saveAd(ad);
});

ipcMain.handle('delete-ad', (_, id) => {
  return db.deleteAd(id);
});

ipcMain.handle('get-saved-ads', async () => {
  try {
      const ads = await db.getSavedAds();
      console.log(`Загружено ${ads.length} сохраненных объявлений`);
      return ads;
  } catch (error) {
      console.error('Ошибка при загрузке объявлений:', error);
      return [];
  }
});

ipcMain.handle('init-telegram-bot', async (_, { token, chatId }) => {
  try {
    if (telegramBot) {
      telegramBot.stop();
    }
    
    telegramBot = botInstance(token);
    await telegramBot.telegram.getMe();
    process.env.TELEGRAM_CHAT_ID = chatId;
    
    return 'Бот успешно инициализирован';
  } catch (error) {
    console.error('Ошибка инициализации Telegram бота:', error);
    throw error;
  }
});

ipcMain.handle('test-telegram-bot', async (_, { token, chatId }) => {
  try {
    const testBot = botInstance(token);
    await testBot.telegram.getMe();
    await sendNotification(testBot, chatId, 'Тестовое уведомление от Avito Parser');
    testBot.stop();
    
    return 'Тестовое сообщение успешно отправлено';
  } catch (error) {
    console.error('Ошибка теста Telegram бота:', error);
    throw error;
  }
});

ipcMain.handle('export-to-excel', async (_, filePath) => {
  return db.exportToExcel(filePath);
});

// Запуск приложения
app.whenReady().then(() => {
  createWindow();
  // Загружаем сохранённые объявления сразу после создания окна
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('saved-ads-loaded', db.getSavedAds());
  });
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (telegramBot) {
    telegramBot.stop();
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});