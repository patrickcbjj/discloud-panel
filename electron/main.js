const { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage, safeStorage, globalShortcut } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { DiscloudClient } = require('./discloud');
const { Database } = require('./db');
const { Poller } = require('./poller');
const { AlertEngine } = require('./alerts');
const { BackupScheduler } = require('./backupScheduler');
const { GithubScheduler } = require('./githubScheduler');
const { DiscloudStatusMonitor } = require('./discloudStatus');
const github = require('./github');
const { UpdateManager } = require('./updater');
const logger = require('./logger');
const errorTracker = require('./errorTracker');

const isDev = !app.isPackaged;

// Mini JSON store (substitui electron-store que virou ESM-only)
class JsonStore {
  constructor(file) {
    this.file = file;
    try { this.data = JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch { this.data = {}; }
  }
  get(key, def) { return this.data[key] ?? def; }
  set(key, value) {
    this.data[key] = value;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
  }
}const store = new JsonStore(path.join(app.getPath('userData'), 'config.json'));

// Tokens guardados no config.json são criptografados via Electron safeStorage
// (DPAPI no Windows, Keychain no macOS, libsecret no Linux). Mantém leitura
// transparente: o resto do código segue chamando store.get('apiToken') etc.
const SECRET_KEYS = new Set(['apiToken', 'githubToken']);

function installSecretEncryption() {
  const origGet = store.get.bind(store);
  const origSet = store.set.bind(store);
  const canEncrypt = (() => {
    try { return safeStorage.isEncryptionAvailable(); } catch { return false; }
  })();

  store.get = (key, def) => {
    const raw = origGet(key, undefined);
    if (raw === undefined) return def;
    if (SECRET_KEYS.has(key) && raw && typeof raw === 'object' && raw.__enc) {
      if (!canEncrypt) return def;
      try {
        return safeStorage.decryptString(Buffer.from(raw.v, 'base64'));
      } catch (e) {
        logger.warn(`[secrets] falha ao decifrar ${key}:`, e?.message);
        return def;
      }
    }
    return raw;
  };

  store.set = (key, value) => {
    if (SECRET_KEYS.has(key) && canEncrypt && typeof value === 'string' && value.length > 0) {
      const enc = safeStorage.encryptString(value).toString('base64');
      return origSet(key, { __enc: true, v: enc });
    }
    return origSet(key, value);
  };

  if (!canEncrypt) {
    logger.warn('[secrets] safeStorage indisponível neste sistema — tokens ficarão em plain text');
    return;
  }

  // Migra tokens legados que estavam em plain text
  for (const key of SECRET_KEYS) {
    const raw = origGet(key, undefined);
    if (typeof raw === 'string' && raw.length > 0) {
      try {
        const enc = safeStorage.encryptString(raw).toString('base64');
        origSet(key, { __enc: true, v: enc });
        logger.info(`[secrets] ${key} migrado para armazenamento criptografado`);
      } catch (e) {
        logger.warn(`[secrets] falha ao migrar ${key}:`, e?.message);
      }
    }
  }
}

// Limpa caches do Chromium quando detecta que a versão mudou desde o último
// start. Resolve o "tela preta após auto-update" — o cache do bundle JS fica
// apontando pra hashes velhas que não existem mais no asar novo. Roda síncrono
// antes de qualquer BrowserWindow ser criado.
//
// NÃO limpa Local Storage, Session Storage, IndexedDB nem o config.json —
// só os 3 caches que o Electron reconstrói sozinho na próxima carga.
function clearStaleCachesIfUpdated() {
  try {
    const userData = app.getPath('userData');
    const lastVersionFile = path.join(userData, '.last-version');
    const current = app.getVersion();
    let lastVersion = null;
    try { lastVersion = fs.readFileSync(lastVersionFile, 'utf8').trim(); } catch {}

    if (lastVersion && lastVersion !== current) {
      const dirs = ['Cache', 'Code Cache', 'GPUCache', 'DawnGraphiteCache', 'DawnWebGPUCache'];
      for (const d of dirs) {
        try { fs.rmSync(path.join(userData, d), { recursive: true, force: true }); }
        catch {}
      }
      try {
        logger.info(`[cache] versão mudou ${lastVersion} -> ${current}, caches limpos`);
      } catch {}
    }
    try {
      fs.mkdirSync(userData, { recursive: true });
      fs.writeFileSync(lastVersionFile, current);
    } catch {}
  } catch {}
}

// instância única (evita 2 processos)
if (!app.requestSingleInstanceLock()) {
  app.quit();
  return;
}

let win;
let tray;
let db;
let client;
let poller;
let alerts;
let backup;
let githubSched;
let statusMon;
let updater;
let isQuitting = false;
let lastStats = { online: 0, total: 0 };

function focusApp(appId) {
  showWindow();
  if (win && !win.isDestroyed()) {
    win.webContents.send('focus-app', appId);
  }
}

function getClient() {
  const token = store.get('apiToken');
  if (!token) return null;
  if (!client || client.token !== token) {
    client = new DiscloudClient(token);
  }
  return client;
}

function ensurePoller() {
  const c = getClient();
  if (!c) return;
  if (!poller) {
    poller = new Poller(c, db, (event, payload) => {
      if (event === 'snapshot') {
        const rows = payload.rows || [];
        const apps = payload.apps || [];
        lastStats = {
          online: rows.filter((r) => r.running).length,
          total: rows.length
        };
        updateTray();
        if (alerts) alerts.processSnapshot(rows, apps);
      }
      if (event === 'poll-error' && alerts) {
        alerts.processError(payload);
      }
      if (win && !win.isDestroyed()) win.webContents.send(event, payload);
    });
    poller.start(Number(store.get('pollInterval', 30)) * 1000);
  } else {
    poller.client = c;
  }
}

function iconPath() {
  // Em dev: build/icon.png. Em produção: extra resource ou asar.
  const candidates = [
    path.join(__dirname, '..', 'build', 'icon.png'),       // dev
    path.join(process.resourcesPath || '', 'icon.png')     // packaged (extraResources)
  ];
  for (const p of candidates) if (fs.existsSync(p)) return p;
  return candidates[0];
}

function showWindow() {
  if (!win || win.isDestroyed()) {
    createWindow();
    return;
  }
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function updateTray() {
  if (!tray || tray.isDestroyed?.()) return;
  const { online, total } = lastStats;
  const allGood = total > 0 && online === total;
  const tooltip = total === 0
    ? 'Discloud Panel — sem dados'
    : `Discloud Panel — ${online}/${total} online${allGood ? ' ✓' : ' ⚠'}`;
  tray.setToolTip(tooltip);
}

function createTray() {
  const img = nativeImage.createFromPath(iconPath());
  // ícone pequeno pra bandeja (16x16 fica nítido no Windows)
  const trayImg = img.resize({ width: 16, height: 16, quality: 'best' });
  tray = new Tray(trayImg);

  const menu = Menu.buildFromTemplate([
    { label: 'Abrir Discloud Panel', click: () => showWindow() },
    { type: 'separator' },
    {
      label: 'Atualizar agora',
      click: () => { if (poller) poller.tickNow(); }
    },
    {
      label: 'Iniciar com Windows',
      type: 'checkbox',
      checked: !!store.get('autoStart'),
      click: (item) => {
        store.set('autoStart', item.checked);
        app.setLoginItemSettings({
          openAtLogin: item.checked,
          openAsHidden: !!store.get('startMinimized'),
          path: process.execPath
        });
      }
    },
    {
      label: 'Iniciar minimizado',
      type: 'checkbox',
      checked: !!store.get('startMinimized'),
      click: (item) => {
        store.set('startMinimized', item.checked);
        if (store.get('autoStart')) {
          app.setLoginItemSettings({
            openAtLogin: true,
            openAsHidden: item.checked,
            path: process.execPath
          });
        }
      }
    },
    { type: 'separator' },
    {
      label: `Sobre o Discloud Panel (v${app.getVersion()})`,
      click: () => {
        showWindow();
        if (win && !win.isDestroyed()) win.webContents.send('open-about');
      }
    },
    {
      label: 'Sair',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(menu);
  tray.on('click', () => {
    if (win && win.isVisible() && !win.isMinimized()) {
      win.hide();
    } else {
      showWindow();
    }
  });
  tray.on('double-click', () => showWindow());
  updateTray();
}

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1080,
    minHeight: 680,
    backgroundColor: '#0a0b0f',
    icon: iconPath(),
    show: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0a0b0f', symbolColor: '#cdd5e1', height: 36 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // mostra quando pronto (a não ser que o app deva iniciar minimizado)
  const startHidden = process.argv.includes('--hidden') || (store.get('autoStart') && store.get('startMinimized'));
  win.once('ready-to-show', () => {
    if (!startHidden) win.show();
  });

  win.on('close', (e) => {
    // X minimiza pra tray ao invés de sair, exceto se o usuário desativou
    if (!isQuitting && store.get('minimizeToTray', true)) {
      e.preventDefault();
      win.hide();
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // atalho pra abrir DevTools mesmo em build empacotado (Ctrl+Shift+I)
  win.webContents.on('before-input-event', (_e, input) => {
    if (input.control && input.shift && (input.key === 'I' || input.key === 'i')) {
      win.webContents.toggleDevTools();
    }
    if (input.key === 'F12') {
      win.webContents.toggleDevTools();
    }
  });
}

function buildAppMenu() {
  const repoUrl = 'https://github.com/patrickcbjj/discloud-panel';
  return Menu.buildFromTemplate([
    {
      label: 'Arquivo',
      submenu: [
        {
          label: 'Atualizar dados',
          accelerator: 'F5',
          click: () => { if (poller) poller.tickNow(); }
        },
        {
          label: 'Configurações',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            showWindow();
            if (win && !win.isDestroyed()) win.webContents.send('open-settings');
          }
        },
        {
          label: 'Verificar atualizações…',
          click: () => { try { updater?.check?.(); } catch {} }
        },
        { type: 'separator' },
        {
          label: 'Esconder na bandeja',
          accelerator: 'CmdOrCtrl+W',
          click: () => { if (win && !win.isDestroyed()) win.hide(); }
        },
        {
          label: 'Sair',
          accelerator: 'CmdOrCtrl+Q',
          click: () => { isQuitting = true; app.quit(); }
        }
      ]
    },
    {
      label: 'Editar',
      submenu: [
        { label: 'Desfazer', role: 'undo' },
        { label: 'Refazer', role: 'redo' },
        { type: 'separator' },
        { label: 'Recortar', role: 'cut' },
        { label: 'Copiar', role: 'copy' },
        { label: 'Colar', role: 'paste' },
        { label: 'Selecionar tudo', role: 'selectAll' }
      ]
    },
    {
      label: 'Visualizar',
      submenu: [
        {
          label: 'Recarregar janela',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => { if (win && !win.isDestroyed()) win.webContents.reloadIgnoringCache(); }
        },
        {
          label: 'Ferramentas de desenvolvedor',
          accelerator: 'F12',
          click: () => { if (win && !win.isDestroyed()) win.webContents.toggleDevTools(); }
        },
        { type: 'separator' },
        { label: 'Aumentar zoom', role: 'zoomIn' },
        { label: 'Diminuir zoom', role: 'zoomOut' },
        { label: 'Zoom padrão', role: 'resetZoom' },
        { type: 'separator' },
        { label: 'Tela cheia', role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Janela',
      submenu: [
        { label: 'Minimizar', role: 'minimize' },
        { label: 'Fechar', role: 'close' }
      ]
    },
    {
      label: 'Ajuda',
      submenu: [
        {
          label: 'Repositório no GitHub',
          click: () => shell.openExternal(repoUrl)
        },
        {
          label: 'Reportar um problema',
          click: () => shell.openExternal(`${repoUrl}/issues/new`)
        },
        {
          label: 'Licença MIT',
          click: () => shell.openExternal(`${repoUrl}/blob/main/LICENSE`)
        },
        { type: 'separator' },
        {
          label: `Sobre o Discloud Panel (v${app.getVersion()})`,
          click: () => {
            showWindow();
            if (win && !win.isDestroyed()) win.webContents.send('open-about');
          }
        }
      ]
    }
  ]);
}

// segundo launch → traz pro foco
app.on('second-instance', () => showWindow());

app.whenReady().then(async () => {
  logger.init(app.getPath('userData'));
  logger.info('userData:', app.getPath('userData'));
  errorTracker.init();
  errorTracker.attachApp();
  clearStaleCachesIfUpdated();
  installSecretEncryption();
  logger.info('isDev:', isDev, 'token set:', !!store.get('apiToken'));

  const dataDir = path.join(app.getPath('userData'), 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  db = new Database(path.join(dataDir, 'snapshots.db'));
  await db.init();
  logger.info('db initialized');
  alerts = new AlertEngine(store, iconPath(), (appId) => focusApp(appId));

  const defaultBackupFolder = path.join(app.getPath('userData'), 'backups');
  backup = new BackupScheduler({
    store,
    getClient,
    defaultFolder: defaultBackupFolder,
    onNotify: ({ title, body, success }) => {
      try {
        const n = new (require('electron').Notification)({
          title, body, icon: iconPath(), silent: !success ? false : true
        });
        n.on('click', () => showWindow());
        n.show();
      } catch (e) { logger.warn('[backup] notify failed:', e?.message); }
      if (win && !win.isDestroyed()) {
        win.webContents.send('backup-finished', { title, body, success });
      }
    }
  });
  backup.start();

  githubSched = new GithubScheduler({
    store,
    getClient,
    onNotify: ({ title, body, success, appId }) => {
      try {
        const n = new (require('electron').Notification)({
          title, body, icon: iconPath(), silent: success
        });
        n.on('click', () => { if (appId) focusApp(appId); else showWindow(); });
        n.show();
      } catch (e) { logger.warn('[github] notify failed:', e?.message); }
      if (win && !win.isDestroyed()) {
        win.webContents.send('github-deploy', { title, body, success, appId });
      }
    },
    onDeployed: (info) => {
      if (db && info.appId) {
        try {
          db.insertDeploy(info.appId, {
            ts: Date.now(),
            fileName: info.fileName || `github:${info.repo}@${(info.sha || '').slice(0, 7)}`,
            fileSize: info.fileSize || null,
            success: info.success,
            message: info.message || (info.triggeredBy === 'auto' ? 'auto-deploy' : 'deploy manual'),
            buildLog: info.buildLog || ''
          });
        } catch (e) { logger.warn('[github] insertDeploy failed:', e?.message); }
      }
      if (win && !win.isDestroyed()) win.webContents.send('github-link-changed');
      if (poller && info.success) setTimeout(() => poller.tickNow(), 2000);
    }
  });
  githubSched.start();

  statusMon = new DiscloudStatusMonitor({
    onChange: (s) => {
      if (win && !win.isDestroyed()) win.webContents.send('discloud-status', s);
    }
  });
  statusMon.start();

  updater = new UpdateManager({
    getWindow: () => win,
    iconPath: iconPath()
  });
  updater.init();

  ensurePoller();
  createTray();
  Menu.setApplicationMenu(buildAppMenu());
  createWindow();
  errorTracker.attachWindow(win);

  // Atalho global: traz o painel pra frente de qualquer lugar do Windows
  try {
    const ok = globalShortcut.register('CommandOrControl+Shift+D', () => {
      if (!win || win.isDestroyed()) return;
      if (win.isVisible() && win.isFocused()) {
        win.hide();
      } else {
        showWindow();
      }
    });
    if (!ok) logger.warn('[shortcut] globalShortcut Ctrl+Shift+D já estava registrado');
  } catch (e) {
    logger.warn('[shortcut] registrar global falhou:', e?.message);
  }

  // Ajusta nome do app pra notificações no Windows
  app.setAppUserModelId('dev.patrick.discloud-panel');

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => { isQuitting = true; });
app.on('will-quit', () => { try { globalShortcut.unregisterAll(); } catch {} });

app.on('window-all-closed', (e) => {
  // não sai automaticamente — fica vivo na tray
  if (process.platform === 'darwin') return;
  if (!isQuitting && store.get('minimizeToTray', true)) {
    e?.preventDefault?.();
    return;
  }
  if (poller) poller.stop();
  if (db) db.close();
  app.quit();
});

// ---------- IPC ----------
ipcMain.handle('config:get', (_e, key) => store.get(key));
ipcMain.handle('config:set', (_e, key, value) => {
  store.set(key, value);
  if (key === 'apiToken') {
    client = null;
    ensurePoller();
  }
  if (key === 'pollInterval' && poller) {
    poller.restart(Number(value) * 1000);
  }
  if (key === 'autoStart' || key === 'startMinimized') {
    app.setLoginItemSettings({
      openAtLogin: !!store.get('autoStart'),
      openAsHidden: !!store.get('startMinimized'),
      path: process.execPath
    });
  }
  return true;
});
ipcMain.handle('config:hasToken', () => Boolean(store.get('apiToken')));

ipcMain.handle('errors:list', () => errorTracker.list());
ipcMain.handle('errors:clear', () => errorTracker.clear());
ipcMain.handle('errors:openFolder', () => {
  const p = errorTracker.getPath();
  if (p) shell.showItemInFolder(p);
});
ipcMain.handle('errors:report', (_e, payload) => {
  errorTracker.record({
    type: payload?.type || 'rendererError',
    source: 'renderer',
    message: payload?.message,
    stack: payload?.stack,
    url: payload?.url,
    line: payload?.line,
    col: payload?.col
  });
});

ipcMain.handle('menu:popup', (e) => {
  const menu = Menu.getApplicationMenu();
  if (!menu) return;
  const w = BrowserWindow.fromWebContents(e.sender);
  if (w) menu.popup({ window: w });
});
ipcMain.handle('config:getLoginItemSettings', () => app.getLoginItemSettings());

ipcMain.handle('discloud:serviceStatus', () => statusMon?.current() ?? { status: 'unknown' });
ipcMain.handle('discloud:probeNow', async () => { await statusMon?.probe(); return statusMon?.current(); });

ipcMain.handle('api:user', async () => (await getClient()?.user()) ?? null);
ipcMain.handle('api:allStatus', async () => (await getClient()?.allStatus()) ?? null);
ipcMain.handle('api:app', async (_e, id) => (await getClient()?.app(id)) ?? null);
ipcMain.handle('api:status', async (_e, id) => (await getClient()?.status(id)) ?? null);
ipcMain.handle('api:logs', async (_e, id) => (await getClient()?.logs(id)) ?? null);
ipcMain.handle('api:start', async (_e, id) => (await getClient()?.start(id)) ?? null);
ipcMain.handle('api:stop', async (_e, id) => (await getClient()?.stop(id)) ?? null);
ipcMain.handle('api:restart', async (_e, id) => (await getClient()?.restart(id)) ?? null);
ipcMain.handle('api:backup', async (_e, id) => (await getClient()?.backup(id)) ?? null);
ipcMain.handle('api:setRam', async (_e, id, ram) => (await getClient()?.setRam(id, ram)) ?? null);

// Team
ipcMain.handle('api:team', async () => (await getClient()?.team()) ?? null);
ipcMain.handle('api:teamStatus', async (_e, id) => (await getClient()?.teamStatus(id)) ?? null);
ipcMain.handle('api:teamLogs', async (_e, id) => (await getClient()?.teamLogs(id)) ?? null);
ipcMain.handle('api:teamStart', async (_e, id) => (await getClient()?.teamStart(id)) ?? null);
ipcMain.handle('api:teamStop', async (_e, id) => (await getClient()?.teamStop(id)) ?? null);
ipcMain.handle('api:teamRestart', async (_e, id) => (await getClient()?.teamRestart(id)) ?? null);
ipcMain.handle('api:teamBackup', async (_e, id) => (await getClient()?.teamBackup(id)) ?? null);
ipcMain.handle('api:teamSetRam', async (_e, id, ram) => (await getClient()?.teamSetRam(id, ram)) ?? null);

// Explorer + exec
ipcMain.handle('api:explorer', async (_e, id, team, cPath) => {
  const c = getClient(); if (!c) return null;
  return team ? c.teamExplorer(id, cPath) : c.explorer(id, cPath);
});
ipcMain.handle('api:explorerOpen', async (_e, id, team, cPath) => {
  const c = getClient(); if (!c) return null;
  return team ? c.teamExplorerOpen(id, cPath) : c.explorerOpen(id, cPath);
});
ipcMain.handle('api:explorerCreate', async (_e, id, team, cPath, typeFile) => {
  const c = getClient(); if (!c) return null;
  return team ? c.teamExplorerCreate(id, cPath, typeFile) : c.explorerCreate(id, cPath, typeFile);
});
ipcMain.handle('api:explorerEdit', async (_e, id, team, cPath, content) => {
  const c = getClient(); if (!c) return null;
  return team ? c.teamExplorerEdit(id, cPath, content) : c.explorerEdit(id, cPath, content);
});
ipcMain.handle('api:exec', async (_e, id, team, cmd) => {
  const c = getClient(); if (!c) return null;
  return team ? c.teamExec(id, cmd) : c.exec(id, cmd);
});
async function doCommit(commitFn, id, filePath) {
  let lastProg = 0;
  const onProgress = (p) => {
    const now = Date.now();
    if (now - lastProg < 33 && p.uploaded < p.total) return;
    lastProg = now;
    if (win && !win.isDestroyed()) win.webContents.send('commit-progress', { id, ...p });
  };
  let lastBuild = 0;
  const onBuildOutput = (text) => {
    const now = Date.now();
    if (now - lastBuild < 80) return;
    lastBuild = now;
    if (win && !win.isDestroyed()) win.webContents.send('commit-build-output', { id, text });
  };
  try {
    const res = await commitFn(id, filePath, { onProgress, onBuildOutput });
    if (res?._buildOutput && win && !win.isDestroyed()) {
      win.webContents.send('commit-build-output', { id, text: res._buildOutput });
    }
    return res;
  } catch (err) {
    if (err.buildOutput && win && !win.isDestroyed()) {
      win.webContents.send('commit-build-output', { id, text: err.buildOutput });
    }
    throw err;
  }
}

ipcMain.handle('api:teamCommit', async (_e, id, filePath) => {
  const c = getClient();
  if (!c) return null;
  return doCommit(c.teamCommit.bind(c), id, filePath);
});

ipcMain.handle('api:commit', async (_e, id, filePath) => {
  const c = getClient();
  if (!c) return null;
  return doCommit(c.commit.bind(c), id, filePath);
});

ipcMain.handle('dialog:openZip', async () => {
  const { dialog } = require('electron');
  const result = await dialog.showOpenDialog(win, {
    title: 'Selecione o .zip do app',
    properties: ['openFile'],
    filters: [{ name: 'Arquivos zip', extensions: ['zip'] }]
  });
  if (result.canceled || !result.filePaths?.length) return null;
  const filePath = result.filePaths[0];
  const fs = require('node:fs');
  const path = require('node:path');
  const stat = await fs.promises.stat(filePath);
  return { path: filePath, name: path.basename(filePath), size: stat.size };
});

ipcMain.handle('fs:statFile', async (_e, filePath) => {
  const fs = require('node:fs');
  const path = require('node:path');
  try {
    const stat = await fs.promises.stat(filePath);
    return { path: filePath, name: path.basename(filePath), size: stat.size };
  } catch (err) {
    return null;
  }
});

ipcMain.handle('db:history', (_e, id, sinceMs) =>
  db.history(id, sinceMs ?? Date.now() - 6 * 3600 * 1000)
);
ipcMain.handle('db:latest', (_e, id) => db.latest(id));
ipcMain.handle('db:restarts', (_e, id, sinceMs) =>
  db.restarts(id, sinceMs ?? Date.now() - 6 * 3600 * 1000)
);
ipcMain.handle('db:purgeOlderThan', (_e, ms) => db.purgeOlderThan(ms));
ipcMain.handle('db:insertDeploy', (_e, appId, info) => { db.insertDeploy(appId, info); return true; });
ipcMain.handle('db:deploys', (_e, appId, limit) => db.deploys(appId, limit));
ipcMain.handle('db:deployBuildLog', (_e, appId, ts) => db.deployBuildLog(appId, ts));
ipcMain.handle('db:slaStats', (_e, sinceMs, appId) => db.slaStatsAll(sinceMs, appId || null));

ipcMain.handle('poller:tickNow', async () => {
  if (poller) return poller.tickNow();
  return null;
});

ipcMain.handle('window:hide', () => { if (win) win.hide(); });
ipcMain.handle('window:minimize', () => { if (win) win.minimize(); });
ipcMain.handle('window:setTheme', (_e, theme) => {
  if (!win || win.isDestroyed()) return;
  const isLight = theme === 'light';
  const bg = isLight ? '#ffffff' : '#0a0b0f';
  const sym = isLight ? '#2a2f3a' : '#cdd5e1';
  win.setBackgroundColor(bg);
  try { win.setTitleBarOverlay?.({ color: bg, symbolColor: sym, height: 36 }); } catch {}
});
ipcMain.handle('app:quit', () => {
  isQuitting = true;
  app.quit();
});
ipcMain.handle('app:info', () => ({
  version: app.getVersion(),
  name: app.getName(),
  electron: process.versions.electron,
  chrome: process.versions.chrome,
  node: process.versions.node,
  platform: process.platform,
  arch: process.arch
}));

ipcMain.handle('shell:openExternal', (_e, url) => shell.openExternal(url));

// ---------- Auto-update ----------
ipcMain.handle('updater:state', () => updater ? updater.current() : { status: 'idle', currentVersion: app.getVersion() });
ipcMain.handle('updater:checkNow', async () => {
  if (!updater) return { ok: false, error: 'updater indisponível' };
  await updater.check();
  return { ok: true, state: updater.current() };
});
ipcMain.handle('updater:download', async () => {
  if (!updater) return { ok: false, error: 'updater indisponível' };
  await updater.download();
  return { ok: true, state: updater.current() };
});
ipcMain.handle('updater:quitAndInstall', () => {
  isQuitting = true;
  updater?.quitAndInstall();
});
ipcMain.handle('updater:clearCache', async () => {
  const userData = app.getPath('userData');
  const dirs = ['Cache', 'Code Cache', 'GPUCache', 'DawnGraphiteCache', 'DawnWebGPUCache'];
  let removed = 0;
  for (const d of dirs) {
    try {
      await fs.promises.rm(path.join(userData, d), { recursive: true, force: true });
      removed++;
    } catch {}
  }
  // Limpa também o cache da sessão atual (HTTP cache em uso)
  try { await require('electron').session.defaultSession.clearCache(); } catch {}
  logger.info('[cache] limpeza manual concluída,', removed, 'diretórios removidos');
  return { ok: true, removed };
});

// ---------- GitHub ----------
ipcMain.handle('github:getLinks', () => store.get('githubLinks') || {});
ipcMain.handle('github:setLink', (_e, appId, data) => {
  const all = store.get('githubLinks') || {};
  if (data == null) delete all[appId];
  else {
    const prev = all[appId] || {};
    all[appId] = {
      ...prev,
      repo: data.repo,
      branch: data.branch || 'main',
      autoDeploy: !!data.autoDeploy,
      team: !!data.team
    };
  }
  store.set('githubLinks', all);
  if (win && !win.isDestroyed()) win.webContents.send('github-link-changed');
  return all;
});
ipcMain.handle('github:checkRepo', async (_e, repo, branch) => {
  try {
    const info = await github.branchInfo(repo, branch || 'main', store.get('githubToken'));
    return { ok: true, info };
  } catch (e) {
    return { ok: false, status: e.status || null, error: e.message || String(e) };
  }
});
ipcMain.handle('github:deployNow', async (_e, appId) => {
  try {
    const res = await githubSched.deployNow(appId, { triggeredBy: 'manual' });
    return { ok: true, ...res };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
});
ipcMain.handle('github:isRunning', (_e, appId) => githubSched ? githubSched.isRunning(appId) : false);

// ---------- Notas/labels por app ----------
ipcMain.handle('notes:getAll', () => store.get('appNotes') || {});
ipcMain.handle('notes:set', (_e, appId, data) => {
  const all = store.get('appNotes') || {};
  if (data == null || (!data.label && !data.note)) {
    delete all[appId];
  } else {
    all[appId] = { label: data.label || '', note: data.note || '' };
  }
  store.set('appNotes', all);
  if (win && !win.isDestroyed()) win.webContents.send('notes-changed', all);
  return all;
});

// ---------- Backup automático ----------
ipcMain.handle('backup:runNow', async () => backup ? backup.runOnce({ trigger: 'manual', targetTs: Date.now() }) : null);
ipcMain.handle('backup:history', () => backup ? backup.history() : []);
ipcMain.handle('backup:isRunning', () => !!(backup && backup.isRunning()));
ipcMain.handle('backup:getFolder', () => backup ? backup.folder() : null);
ipcMain.handle('backup:openFolder', async () => {
  if (!backup) return false;
  const dir = backup.folder();
  try { await fs.promises.mkdir(dir, { recursive: true }); } catch {}
  await shell.openPath(dir);
  return true;
});
// ---------- Export histórico ----------
function rowToCsvField(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

ipcMain.handle('export:run', async (_e, opts) => {
  const { format, sinceMs, appId, appNameById } = opts || {};
  if (!db) return { error: 'banco não inicializado' };
  const rows = db.historyRange(Number(sinceMs) || 0, appId || null);

  const { dialog } = require('electron');
  const defaultName = `discloud-history_${new Date().toISOString().slice(0, 10)}.${format}`;
  const res = await dialog.showSaveDialog(win, {
    title: 'Exportar histórico',
    defaultPath: defaultName,
    filters: format === 'csv'
      ? [{ name: 'CSV', extensions: ['csv'] }]
      : [{ name: 'JSON', extensions: ['json'] }]
  });
  if (res.canceled || !res.filePath) return { canceled: true };

  // 'raw' é JSON serializado — pesado e ruidoso pro export, dropa
  const lean = rows.map((r) => ({
    app_id: r.app_id,
    app_name: appNameById?.[r.app_id] || null,
    ts: r.ts,
    iso: new Date(r.ts).toISOString(),
    running: r.running,
    cpu_pct: r.cpu,
    memory_mb: r.memory_mb,
    memory_max_mb: r.memory_max,
    ssd_mb: r.ssd_mb,
    net_down_bytes: r.net_down,
    net_up_bytes: r.net_up,
    uptime_ms: r.uptime_ms
  }));

  let payload;
  if (format === 'csv') {
    const cols = Object.keys(lean[0] || {
      app_id: 0, app_name: 0, ts: 0, iso: 0, running: 0, cpu_pct: 0,
      memory_mb: 0, memory_max_mb: 0, ssd_mb: 0,
      net_down_bytes: 0, net_up_bytes: 0, uptime_ms: 0
    });
    const lines = [cols.join(',')];
    for (const r of lean) lines.push(cols.map((c) => rowToCsvField(r[c])).join(','));
    payload = lines.join('\r\n');
  } else {
    payload = JSON.stringify(lean, null, 2);
  }

  await fs.promises.writeFile(res.filePath, payload, 'utf8');
  return { filePath: res.filePath, rows: lean.length };
});

ipcMain.handle('backup:chooseFolder', async () => {
  const { dialog } = require('electron');
  const res = await dialog.showOpenDialog(win, {
    title: 'Pasta para salvar backups',
    properties: ['openDirectory', 'createDirectory']
  });
  if (res.canceled || !res.filePaths?.length) return null;
  const folder = res.filePaths[0];
  store.set('backupFolder', folder);
  return folder;
});
