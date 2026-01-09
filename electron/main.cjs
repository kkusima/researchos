const { app, BrowserWindow, shell, ipcMain, Notification } = require('electron');
const path = require('path');

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    // Remove the default menu (optional, for a cleaner look)
    // win.setMenu(null);

    const isDev = !app.isPackaged;

    if (isDev) {
        // In development, load from the Vite dev server
        win.loadURL('http://localhost:3000');
        // Open DevTools automatically (optional)
        // win.webContents.openDevTools();
    } else {
        // In production, load the built index.html
        // '..' because main.js is in electron/ folder, need to go up to dist/
        win.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    // Handle external links: Open them in the default browser instead of Electron
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('https:') || url.startsWith('http:')) {
            shell.openExternal(url);
            return { action: 'deny' };
        }
        return { action: 'allow' };
    });
}

app.whenReady().then(() => {
    // Enable dock/taskbar badges on macOS/Windows for notifications
    app.setAppUserModelId('com.hypothesys.app');

    ipcMain.on('notify', (_, payload = {}) => {
        const { title = 'HypotheSys', body = '', badgeCount } = payload;
        if (Notification.isSupported()) {
            const notification = new Notification({ title, body });
            notification.show();
        }

        if (badgeCount !== undefined) {
            if (process.platform === 'darwin' && app.dock) {
                app.dock.setBadge(badgeCount > 0 ? String(badgeCount) : '');
            }
            if (process.platform === 'win32') {
                app.setBadgeCount(Number(badgeCount) || 0);
            }
        }
    });

    ipcMain.on('set-badge', (_, count = 0) => {
        if (process.platform === 'darwin' && app.dock) {
            app.dock.setBadge(count > 0 ? String(count) : '');
        }
        if (process.platform === 'win32') {
            app.setBadgeCount(Number(count) || 0);
        }
    });

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
