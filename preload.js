const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  parseData: (data) => ipcRenderer.invoke('parse-data', data),
  saveAd: (ad) => ipcRenderer.invoke('save-ad', ad),
  deleteAd: (id) => ipcRenderer.invoke('delete-ad', id),
  getSavedAds: () => ipcRenderer.invoke('get-saved-ads'),
  initTelegramBot: (token, chatId) => ipcRenderer.invoke('init-telegram-bot', { token, chatId }),
  testTelegramBot: (token, chatId) => ipcRenderer.invoke('test-telegram-bot', { token, chatId }),
  onSavedAdsLoaded: (callback) => ipcRenderer.on('saved-ads-loaded', callback)
});

// Безопасная обработка ошибок
process.once('loaded', () => {
  window.addEventListener('error', (event) => {
    console.error('Ошибка в рендерере:', event.error);
  });
});