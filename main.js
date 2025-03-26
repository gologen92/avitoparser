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
            contextIsolation: true
        }
    });

    mainWindow.loadFile('index.html');
}

// Обработчики IPC
ipcMain.handle('parse-data', async (_, { keyword, price, city, limit = 50 }) => {
    try {
        const results = await require('./puppeteer-parser')(keyword, price, city, limit);
        
        if (telegramBot) {
            const chatId = localStorage.getItem('telegramChatId');
            await sendNotification(telegramBot, chatId, `Найдено ${results.length} объявлений`);
        }
        
        return results;
    } catch (error) {
        if (telegramBot) {
            const chatId = localStorage.getItem('telegramChatId');
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

ipcMain.handle('get-saved-ads', () => {
    return db.getSavedAds();
});

ipcMain.handle('init-telegram-bot', async (_, { token, chatId }) => {
    try {
        if (telegramBot) {
            telegramBot.stop();
        }
        
        telegramBot = botInstance(token);
        await telegramBot.telegram.getMe();
        
        // Сохраняем chatId в localStorage main процесса
        localStorage.setItem('telegramChatId', chatId);
        
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

// Запуск приложения
app.whenReady().then(() => {
    createWindow();
    
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

// Инициализация localStorage для main процесса
if (!global.localStorage) {
    global.localStorage = {
        store: {},
        getItem: function (key) {
            return this.store[key] || null;
        },
        setItem: function (key, value) {
            this.store[key] = value;
        },
        removeItem: function (key) {
            delete this.store[key];
        }
    };
}