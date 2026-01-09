const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopBridge', {
    notify: ({ title, body, badgeCount } = {}) => ipcRenderer.send('notify', { title, body, badgeCount }),
    setBadge: (count = 0) => ipcRenderer.send('set-badge', count),
});
