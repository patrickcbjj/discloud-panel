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

// Watchdog: se um tick não terminar nesse tempo, abortamos e emitimos erro.
// Cobre o caso da API hangar mesmo com o timeout individual de cada request
// (vários requests em sequência poderiam compor um tick longo).
const TICK_TIMEOUT_MS = 60_000;

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
    this._ticking = false;          // guard anti-overlap
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

      // /app/all não retorna `clusterName`. Pra preencher esse campo (e outros
      // exclusivos do single-app endpoint), buscamos /app/:id em paralelo pros
      // ids que ainda não têm cluster cacheado. Roda raramente (5min).
      await this._enrichWithSingleAppDetails(list.map((a) => String(a.id ?? a.appId ?? a._id)));
    } catch (err) {
      logger.error('[poller] catalog refresh failed:', err.message, 'status=', err.status);
    }
  }

  async _enrichWithSingleAppDetails(ids) {
    // Discloud move apps entre clusters em manutenção; revalidar a cada 1h.
    const REFRESH_AFTER_MS = 60 * 60 * 1000;
    const now = Date.now();
    const stale = ids.filter((id) => {
      const m = this.catalog.get(id);
      if (!m) return false;
      if (!m.clusterName) return true;
      if (!m._detailsFetchedAt) return true;
      return (now - m._detailsFetchedAt) > REFRESH_AFTER_MS;
    });
    if (!stale.length) return;
    // limita concorrência pra não tomar rate limit (3 por vez)
    const queue = [...stale];
    const workers = Array.from({ length: Math.min(3, queue.length) }, async () => {
      while (queue.length) {
        const id = queue.shift();
        try {
          const r = await this.client.app(id);
          const data = r?.apps || r?.data || r;
          if (!data) continue;
          const meta = this.catalog.get(id) || {};
          this.catalog.set(id, {
            ...meta,
            clusterName: data.clusterName ?? meta.clusterName,
            lang: data.lang ?? meta.lang,
            language: meta.language ?? data.lang,
            autoDeployGit: data.autoDeployGit ?? meta.autoDeployGit,
            syncGit: data.syncGit ?? meta.syncGit,
            ramKilled: data.ramKilled ?? meta.ramKilled,
            exitCode: data.exitCode ?? meta.exitCode,
            addedAtTimestamp: data.addedAtTimestamp ?? meta.addedAtTimestamp,
            mods: data.mods ?? meta.mods,
            apts: data.apts ?? meta.apts,
            _detailsFetchedAt: Date.now()
          });
        } catch (e) {
          logger.warn('[poller] /app/:id failed for', id, ':', e.message);
        }
      }
    });
    await Promise.all(workers);
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
      autoRestart: meta.autoRestart ?? statusApp.autoRestart,
      language: meta.language ?? meta.lang ?? statusApp.language ?? statusApp.lang,
      cluster: meta.clusterName ?? meta.cluster ?? statusApp.clusterName ?? statusApp.cluster,
      autoDeployGit: meta.autoDeployGit ?? statusApp.autoDeployGit,
      syncGit: meta.syncGit ?? statusApp.syncGit,
      ramKilled: meta.ramKilled ?? statusApp.ramKilled,
      exitCode: meta.exitCode ?? statusApp.exitCode,
      addedAtTimestamp: meta.addedAtTimestamp ?? statusApp.addedAtTimestamp,
      mods: meta.mods ?? statusApp.mods,
      apts: meta.apts ?? statusApp.apts
    };
  }

  // Wrapper: aplica watchdog de 60s + guard contra overlap. Se um tick
  // anterior ainda está rodando, pula este. Se passar do limite, emite
  // poll-error precocemente e marca esse gen como descartado — o tick órfão
  // continua rodando até falhar nos timeouts internos mas não emite mais nada.
  async tickNow() {
    if (!this.client) { logger.warn('[poller] tickNow without client'); return null; }
    if (this._ticking) {
      logger.warn('[poller] tick skipped — anterior ainda rodando');
      return null;
    }
    this._ticking = true;
    const gen = (this._tickGen = (this._tickGen || 0) + 1);
    const start = Date.now();
    let watchdog;

    try {
      await Promise.race([
        this._tickInternal(gen),
        new Promise((_, reject) => {
          watchdog = setTimeout(() => {
            reject(new Error(`Tick travado (>${Math.round(TICK_TIMEOUT_MS / 1000)}s). API Discloud parece pendurada.`));
          }, TICK_TIMEOUT_MS);
        })
      ]);
    } catch (err) {
      if (gen === this._tickGen && !err?._handled) {
        // Caso típico: watchdog disparou. _tickInternal não emitiu nada;
        // o wrapper é quem reporta o tick travado.
        logger.error(
          '[poller] tick aborted:', err?.message,
          'after', Date.now() - start, 'ms'
        );
        this.emit('poll-error', {
          message: err?.message || String(err),
          status: err?.status,
          ts: Date.now()
        });
      }
    } finally {
      if (watchdog) clearTimeout(watchdog);
      this._ticking = false;
    }
    return null;
  }

  // Helper pra _tickInternal saber se ainda é o tick atual antes de mutar
  // estado/emitir. Após watchdog disparar, o gen muda no próximo tickNow e
  // este retorna false — o órfão silenciosamente abandona.
  _isCurrent(gen) { return gen === this._tickGen; }

  async _tickInternal(gen) {
    logger.info('[poller] tick start (gen=', gen, ')');
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

      // Se o watchdog já deu o tick como morto, abandona silenciosamente
      // antes de mexer no DB ou emitir snapshot stale.
      if (!this._isCurrent(gen)) {
        logger.warn('[poller] tick gen=', gen, 'descartado (watchdog disparou antes)');
        return null;
      }

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

      logger.info('[poller] tick complete (gen=', gen, ')');
      return rows;
    } catch (err) {
      logger.error(
        '[poller] tick failed at phase=', phase,
        'name=', err?.name,
        'message=', err?.message,
        'stack=', err?.stack
      );
      // Só emite se ainda for o tick atual — senão o wrapper já cuidou
      if (this._isCurrent(gen)) {
        this.emit('poll-error', {
          message: err?.message || String(err),
          status: err?.status,
          ts: Date.now()
        });
      }
      // Repropaga pro wrapper (que vai ignorar se gen for stale, ou logar/emit
      // se for o atual). Mas como já emitimos, marca pro wrapper não duplicar.
      err._handled = true;
      throw err;
    }
  }
}

module.exports = { Poller };
