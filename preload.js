const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  parseData: (data) => ipcRenderer.invoke('parse-data', data),
  saveAd: (ad) => ipcRenderer.invoke('save-ad', ad),
  deleteAd: (id) => ipcRenderer.invoke('delete-ad', id),
  getSavedAds: () => ipcRenderer.invoke('get-saved-ads')
});