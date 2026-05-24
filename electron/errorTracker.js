// Captura de erros locais (sem upload pra terceiros). Grava em
// userData/errors.log como NDJSON, cap em 200 entradas mais recentes.
// Cobre: uncaughtException, unhandledRejection, render-process-gone,
// child-process-gone, e erros do renderer via IPC `errors:report`.

const fs = require('node:fs');
const path = require('node:path');
const { app, crashReporter } = require('electron');
const logger = require('./logger');

const MAX_ENTRIES = 200;
let filePath = null;

function init() {
  try {
    const dir = app.getPath('userData');
    fs.mkdirSync(dir, { recursive: true });
    filePath = path.join(dir, 'errors.log');

    // Crashes nativos (C++): grava minidumps em userData/Crashpad
    // uploadToServer:false → só local, sem mandar pra ninguém
    try {
      crashReporter.start({
        productName: 'Discloud Panel',
        companyName: 'patrickcbjj',
        submitURL: '',
        uploadToServer: false,
        ignoreSystemCrashHandler: false
      });
    } catch (e) {
      logger.warn('[errorTracker] crashReporter failed:', e?.message);
    }

    process.on('uncaughtException', (err) => {
      record({ type: 'uncaughtException', source: 'main', message: err?.message, stack: err?.stack });
    });
    process.on('unhandledRejection', (reason) => {
      const err = reason instanceof Error ? reason : new Error(String(reason));
      record({ type: 'unhandledRejection', source: 'main', message: err.message, stack: err.stack });
    });

    logger.info('[errorTracker] initialized at', filePath);
  } catch (e) {
    logger.error('[errorTracker] init failed:', e?.message);
  }
}

function attachWindow(win) {
  if (!win || win.isDestroyed()) return;
  win.webContents.on('render-process-gone', (_e, details) => {
    record({
      type: 'render-process-gone',
      source: 'renderer',
      message: `reason=${details.reason} exitCode=${details.exitCode}`,
      stack: ''
    });
  });
}

function attachApp() {
  app.on('child-process-gone', (_e, details) => {
    record({
      type: 'child-process-gone',
      source: details.type || 'child',
      message: `reason=${details.reason} exitCode=${details.exitCode} name=${details.name || ''}`,
      stack: ''
    });
  });
}

function record(entry) {
  const e = {
    ts: Date.now(),
    type: entry.type || 'error',
    source: entry.source || 'unknown',
    message: String(entry.message || '').slice(0, 2000),
    stack: String(entry.stack || '').slice(0, 8000),
    url: entry.url || null,
    line: entry.line ?? null,
    col: entry.col ?? null
  };
  try {
    if (!filePath) return;
    fs.appendFileSync(filePath, JSON.stringify(e) + '\n');
    trim();
    logger.error(`[errorTracker] ${e.source}/${e.type}: ${e.message}`);
  } catch (err) {
    logger.warn('[errorTracker] record failed:', err?.message);
  }
}

function trim() {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const lines = raw.split('\n').filter(Boolean);
    if (lines.length > MAX_ENTRIES) {
      const keep = lines.slice(-MAX_ENTRIES).join('\n') + '\n';
      fs.writeFileSync(filePath, keep);
    }
  } catch {}
}

function list() {
  try {
    if (!filePath || !fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf8');
    const lines = raw.split('\n').filter(Boolean);
    const out = [];
    for (const ln of lines) {
      try { out.push(JSON.parse(ln)); } catch {}
    }
    return out.reverse();
  } catch (e) {
    logger.warn('[errorTracker] list failed:', e?.message);
    return [];
  }
}

function clear() {
  try {
    if (filePath) fs.writeFileSync(filePath, '');
    return true;
  } catch (e) {
    logger.warn('[errorTracker] clear failed:', e?.message);
    return false;
  }
}

function getPath() { return filePath; }

module.exports = { init, attachWindow, attachApp, record, list, clear, getPath };
