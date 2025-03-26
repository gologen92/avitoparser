const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  parseData: (data) => ipcRenderer.invoke('parse-data', data),
  saveAd: (ad) => ipcRenderer.invoke('save-ad', ad),
  deleteAd: (id) => ipcRenderer.invoke('delete-ad', id),
  getSavedAds: () => ipcRenderer.invoke('get-saved-ads'),
  initTelegramBot: (token, chatId) => ipcRenderer.invoke('init-telegram-bot', { token, chatId }),
  testTelegramBot: (token, chatId) => ipcRenderer.invoke('test-telegram-bot', { token, chatId })
});