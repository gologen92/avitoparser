const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { sendNotification } = require('./telegram-bot');
const db = require('./database');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });

  mainWindow.loadFile('index.html');
}

// Обработчики IPC
ipcMain.handle('parse-data', async (_, { keyword, price, city, limit = 50 }) => {
  try {
    const results = await require('./puppeteer-parser')(keyword, price, city, limit);
    await sendNotification('465097550', `Найдено ${results.length} объявлений`);
    return results;
  } catch (error) {
    await sendNotification('465097550', `❌ Ошибка парсинга: ${error.message}`);
    throw error;
  }
});

ipcMain.handle('save-ad', (_, ad) => {
  return db.saveAd(ad);
});

ipcMain.handle('delete-ad', (_, id) => {
  return db.deleteAd(id);
});

ipcMain.handle('get-saved-ads', () => {
  return db.getSavedAds();
});

// Запуск приложения
app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});