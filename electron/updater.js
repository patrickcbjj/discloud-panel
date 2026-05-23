// Auto-update via GitHub Releases (electron-updater).
// Procura `latest.yml` no GitHub Releases public, baixa o .exe e fica
// pronto pra reiniciar. Eventos são repassados pro renderer pra UI mostrar
// progresso/banner; também usa Notification do SO quando update fica pronto.

const { app, autoUpdater: nativeAutoUpdater, Notification } = require('electron');

let updater = null;
try {
  ({ autoUpdater: updater } = require('electron-updater'));
} catch (e) {
  updater = null;
}

const logger = require('./logger');

class UpdateManager {
  constructor({ getWindow, iconPath }) {
    this.getWindow = getWindow;
    this.iconPath = iconPath;
    this.state = {
      status: 'idle', // idle | checking | available | not-available | downloading | downloaded | error
      currentVersion: app.getVersion(),
      version: null,
      progress: null, // { percent, transferred, total, bytesPerSecond }
      error: null
    };
    this._notifiedDownloaded = false;
  }

  enabled() {
    return !!updater && app.isPackaged;
  }

  init() {
    if (!this.enabled()) {
      logger.info('[updater] desabilitado (dev ou módulo ausente)');
      return;
    }
    // Auto-download desligado: usuário precisa confirmar via modal. Patrick não
    // quer que o app baixe nada sem permissão.
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = true;
    updater.logger = {
      info: (m) => logger.info('[updater]', m),
      warn: (m) => logger.warn('[updater]', m),
      error: (m) => logger.error('[updater]', m),
      debug: () => {}
    };

    updater.on('checking-for-update', () => {
      this._set({ status: 'checking', error: null });
    });
    updater.on('update-available', (info) => {
      this._set({ status: 'available', version: info?.version || null, error: null });
    });
    updater.on('update-not-available', (info) => {
      this._set({ status: 'not-available', version: info?.version || null });
    });
    updater.on('download-progress', (p) => {
      this._set({
        status: 'downloading',
        progress: {
          percent: p.percent || 0,
          transferred: p.transferred || 0,
          total: p.total || 0,
          bytesPerSecond: p.bytesPerSecond || 0
        }
      });
    });
    updater.on('update-downloaded', (info) => {
      this._set({ status: 'downloaded', version: info?.version || this.state.version, progress: null });
      if (!this._notifiedDownloaded) {
        this._notifiedDownloaded = true;
        try {
          new Notification({
            title: 'Discloud Panel — atualização pronta',
            body: `Versão ${info?.version || ''} baixada. Reinicie para aplicar.`,
            icon: this.iconPath,
            silent: true
          }).show();
        } catch {}
      }
    });
    updater.on('error', (err) => {
      this._set({ status: 'error', error: err?.message || String(err) });
    });

    // Primeira checagem 10s depois do start pra não competir com o poller inicial.
    // Depois, recheca a cada 6h.
    setTimeout(() => this.check(), 10_000);
    setInterval(() => this.check(), 6 * 3600 * 1000);
  }

  async check() {
    if (!this.enabled()) return;
    try {
      await updater.checkForUpdates();
    } catch (e) {
      logger.warn('[updater] check falhou:', e?.message);
    }
  }

  async download() {
    if (!this.enabled()) return;
    try {
      await updater.downloadUpdate();
    } catch (e) {
      logger.error('[updater] download falhou:', e?.message);
    }
  }

  quitAndInstall() {
    if (!this.enabled()) return;
    try {
      updater.quitAndInstall(false, true);
    } catch (e) {
      logger.error('[updater] quitAndInstall falhou:', e?.message);
    }
  }

  current() { return this.state; }

  _set(patch) {
    this.state = { ...this.state, ...patch };
    const win = this.getWindow?.();
    if (win && !win.isDestroyed()) {
      win.webContents.send('updater-event', this.state);
    }
  }
}

module.exports = { UpdateManager };
