// Faz polling periódico de /app/all/status e grava snapshot por app no SQLite.
// Normaliza unidades pra MB / % / bytes pra ficar consistente nos gráficos.

function parseMB(v) {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const m = String(v).match(/([\d.]+)\s*(KB|MB|GB|TB)?/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const unit = (m[2] || 'MB').toUpperCase();
  switch (unit) {
    case 'KB': return n / 1024;
    case 'MB': return n;
    case 'GB': return n * 1024;
    case 'TB': return n * 1024 * 1024;
    default: return n;
  }
}

function parsePercent(v) {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const m = String(v).match(/([\d.]+)/);
  return m ? parseFloat(m[1]) : null;
}

function parseBytes(v) {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const m = String(v).match(/([\d.]+)\s*(B|KB|MB|GB|TB)?/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const unit = (m[2] || 'B').toUpperCase();
  const mult = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 }[unit] ?? 1;
  return n * mult;
}

// "0d, 0h 5m" -> ms
function parseUptime(v) {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const s = String(v);
  const d = /(\d+)\s*d/.exec(s); const h = /(\d+)\s*h/.exec(s);
  const m = /(\d+)\s*m/.exec(s); const sec = /(\d+)\s*s/.exec(s);
  const days = d ? parseInt(d[1], 10) : 0;
  const hrs  = h ? parseInt(h[1], 10) : 0;
  const min  = m ? parseInt(m[1], 10) : 0;
  const ss   = sec ? parseInt(sec[1], 10) : 0;
  return ((days * 24 + hrs) * 60 + min) * 60_000 + ss * 1000;
}

function normalize(raw, ts) {
  // /app/all/status retorna campos como strings ("100MB/512MB", "10.5%", "200MB").
  // Suporta tanto string "usado/total" quanto objeto {usage, total}.
  let memUsed = null, memMax = null;
  if (raw.memory && typeof raw.memory === 'string') {
    const parts = raw.memory.split('/').map((s) => s.trim());
    memUsed = parseMB(parts[0]);
    memMax  = parts[1] != null ? parseMB(parts[1]) : null;
  } else if (raw.memory && typeof raw.memory === 'object') {
    memUsed = parseMB(raw.memory.usage ?? raw.memory.used);
    memMax  = parseMB(raw.memory.total ?? raw.memory.max);
  } else {
    memUsed = parseMB(raw.memoryUsage ?? raw.ramUsage);
    memMax  = parseMB(raw.memoryTotal ?? raw.ram);
  }

  const cpu = parsePercent(raw.cpu ?? raw.cpuUsage);
  const ssd = parseMB(raw.ssd ?? raw.disk ?? raw.storage);

  const net = raw.netIO || raw.network || {};
  const netDown = parseBytes(net.down ?? raw.netDown);
  const netUp   = parseBytes(net.up ?? raw.netUp);

  let uptimeMs = null;
  if (raw.startedAt) {
    const t = Date.parse(raw.startedAt);
    if (!Number.isNaN(t)) uptimeMs = ts - t;
  } else if (raw.uptime) {
    uptimeMs = parseUptime(raw.uptime);
  }

  const running =
    raw.online === true ? 1 :
    raw.online === false ? 0 :
    (raw.container && /online|running/i.test(raw.container)) ? 1 :
    (raw.status && /online|running/i.test(raw.status)) ? 1 : 0;

  return {
    app_id: String(raw.id ?? raw.appId ?? raw._id),
    ts,
    running,
    cpu,
    memory_mb: memUsed,
    memory_max: memMax,
    ssd_mb: ssd,
    net_down: netDown,
    net_up: netUp,
    uptime_ms: uptimeMs,
    last_restart: raw.last_restart || raw.lastRestart || null,
    raw: JSON.stringify(raw)
  };
}

let logger;
try { logger = require('./logger'); } catch { logger = { info: () => {}, warn: () => {}, error: () => {} }; }

function extractList(res) {
  return Array.isArray(res?.apps) ? res.apps
       : Array.isArray(res?.data) ? res.data
       : Array.isArray(res) ? res : [];
}

class Poller {
  constructor(client, db, emit) {
    this.client = client;
    this.db = db;
    this.emit = emit;
    this.timer = null;
    this.catalogTimer = null;
    this.intervalMs = 30_000;
    this.catalogIntervalMs = 5 * 60_000; // metadata refresh menos frequente
    this.catalog = new Map();
    this.lastSnapshot = [];
    this.lastStartedAt = new Map(); // app_id -> startedAt string
  }

  start(intervalMs) {
    this.intervalMs = intervalMs || this.intervalMs;
    this.stop();
    logger.info('[poller] start, intervalMs=', this.intervalMs);
    this._refreshCatalog().finally(() => this.tickNow());
    this.timer = setInterval(() => this.tickNow(), this.intervalMs);
    this.catalogTimer = setInterval(() => this._refreshCatalog(), this.catalogIntervalMs);
  }

  restart(intervalMs) { this.start(intervalMs); }

  stop() {
    if (this.timer) clearInterval(this.timer);
    if (this.catalogTimer) clearInterval(this.catalogTimer);
    this.timer = null;
    this.catalogTimer = null;
  }

  async _refreshCatalog() {
    if (!this.client) return;
    try {
      const res = await this.client.allApps();
      const list = extractList(res);
      const next = new Map();
      for (const app of list) {
        const id = String(app.id ?? app.appId ?? app._id);
        next.set(id, app);
      }
      this.catalog = next;
    } catch (err) {
      logger.error('[poller] catalog refresh failed:', err.message, 'status=', err.status);
    }
  }

  _mergeCatalog(statusApp) {
    const id = String(statusApp.id ?? statusApp.appId ?? statusApp._id);
    const meta = this.catalog.get(id);
    if (!meta) return statusApp;
    return {
      ...statusApp,
      name: meta.name ?? meta.appName ?? statusApp.name,
      avatarURL: meta.avatarURL ?? meta.avatar ?? statusApp.avatarURL,
      type: meta.type ?? statusApp.type,
      mainFile: meta.mainFile ?? statusApp.mainFile,
      ram: meta.ram ?? statusApp.ram,
      autoRestart: meta.autoRestart ?? statusApp.autoRestart
    };
  }

  async tickNow() {
    if (!this.client) { logger.warn('[poller] tickNow without client'); return null; }
    logger.info('[poller] tick start');
    this.emit('tick-start', { ts: Date.now() });
    let phase = 'init';
    try {
      phase = 'allStatus';
      const res = await this.client.allStatus();
      const list = extractList(res);
      logger.info('[poller] allStatus ok, apps=', list.length);

      phase = 'team';
      let teamList = [];
      try {
        const teamRes = await this.client.team();
        teamList = extractList(teamRes).map((raw) => {
          const perms = raw.perms || raw.mods || raw.permissions || [];
          return { ...raw, team: true, mods: perms };
        });
        if (!this._loggedTeamOk || this._lastTeamCount !== teamList.length) {
          logger.info('[poller] team ok, apps=', teamList.length);
          this._loggedTeamOk = true;
          this._lastTeamCount = teamList.length;
        }
      } catch (e) {
        // 403 "sem equipes" é esperado pra usuários que não são mods — loga uma vez só
        const isNoTeam = e?.status === 403;
        if (!this._loggedTeamErr || !isNoTeam) {
          logger[isNoTeam ? 'info' : 'warn'](
            '[poller] team fetch:', e?.message, 'status=', e?.status
          );
          this._loggedTeamErr = true;
        }
      }

      phase = 'merge';
      const ts = Date.now();
      const merged = [
        ...list.map((raw) => this._mergeCatalog(raw)),
        ...teamList
      ];

      phase = 'normalize';
      const rows = merged.map((raw) => normalize(raw, ts));

      phase = 'db.insertMany';
      if (rows.length) this.db.insertMany(rows);

      phase = 'restart-detect';
      for (const raw of merged) {
        const id = String(raw.id ?? raw.appId ?? raw._id);
        const cur = raw.startedAt;
        if (!cur) continue;
        const prev = this.lastStartedAt.get(id);
        if (prev && prev !== cur) {
          try { this.db.insertRestart(id, ts, cur, prev); }
          catch (e) { logger.error('[poller] insertRestart failed:', e.message, e.stack); }
        }
        this.lastStartedAt.set(id, cur);
      }

      this.lastSnapshot = rows;

      phase = 'emit-snapshot';
      this.emit('snapshot', { ts, rows, apps: merged });

      logger.info('[poller] tick complete');
      return rows;
    } catch (err) {
      logger.error(
        '[poller] tick failed at phase=', phase,
        'name=', err?.name,
        'message=', err?.message,
        'stack=', err?.stack
      );
      this.emit('poll-error', { message: err?.message || String(err), status: err?.status, ts: Date.now() });
      return null;
    }
  }
}

module.exports = { Poller };
