// AgriAqua 360 desktop: serves the Expo web export (./app) over a private app:// scheme.
const { app, BrowserWindow, protocol, net, session, shell } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const fs = require('fs');

const ROOT = path.join(__dirname, 'app');
const ORIGIN = 'app://agriaqua';
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);

app.whenReady().then(() => {
  // SPA routing: real files are served, every other path falls back to index.html. Paths can't escape ROOT.
  protocol.handle('app', (req) => {
    const rel = decodeURIComponent(new URL(req.url).pathname);
    const file = path.normalize(path.join(ROOT, rel));
    const ok = file.startsWith(ROOT) && fs.existsSync(file) && fs.statSync(file).isFile();
    return net.fetch(pathToFileURL(ok ? file : path.join(ROOT, 'index.html')).toString());
  });

  // Only the features the app uses, and only for the app itself.
  const ALLOWED = new Set(['media', 'geolocation', 'notifications']);
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb, details) => cb(ALLOWED.has(perm) && (details.requestingUrl || '').startsWith(ORIGIN)));
  session.defaultSession.setPermissionCheckHandler((wc, perm, origin) => ALLOWED.has(perm) && (origin || '').startsWith(ORIGIN));

  const win = new BrowserWindow({
    width: 460, height: 900, minWidth: 380, minHeight: 600, title: 'AgriAqua 360', backgroundColor: '#F2FBF5', autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  // Links (https, tel:, mailto:) open in the system browser / dialer, never inside the app window.
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^(https?|tel|mailto):/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(ORIGIN)) { e.preventDefault(); if (/^(https?|tel|mailto):/.test(url)) shell.openExternal(url); } });
  win.loadURL(`${ORIGIN}/`);
});

app.on('window-all-closed', () => app.quit());
