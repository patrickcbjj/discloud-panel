// SQLite via sql.js (WASM, sem deps nativas).
// Persistência: lemos o .db do disco no startup e gravamos de volta com debounce.
const fs = require('node:fs');
const path = require('node:path');
const initSqlJs = require('sql.js');

class Database {
  constructor(file) {
    this.file = file;
    this.dirty = false;
    this.saveTimer = null;
  }

  async init() {
    // sql.js wasm está em node_modules/sql.js/dist/. Em build empacotado,
    // asarUnpack coloca em app.asar.unpacked/node_modules/sql.js/dist/ e
    // o fs do Electron redireciona automaticamente.
    const wasmDir = path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist');
    const SQL = await initSqlJs({
      locateFile: (f) => path.join(wasmDir, f)
    });

    if (fs.existsSync(this.file)) {
      const buf = fs.readFileSync(this.file);
      this.db = new SQL.Database(new Uint8Array(buf));
    } else {
      this.db = new SQL.Database();
    }

    this.db.run(`
      CREATE TABLE IF NOT EXISTS snapshots (
        app_id      TEXT NOT NULL,
        ts          INTEGER NOT NULL,
        running     INTEGER,
        cpu         REAL,
        memory_mb   REAL,
        memory_max  REAL,
        ssd_mb      REAL,
        net_down    REAL,
        net_up      REAL,
        uptime_ms   INTEGER,
        last_restart TEXT,
        raw         TEXT,
        PRIMARY KEY (app_id, ts)
      );
      CREATE INDEX IF NOT EXISTS idx_snapshots_ts ON snapshots(ts);

      CREATE TABLE IF NOT EXISTS restarts (
        app_id        TEXT NOT NULL,
        ts            INTEGER NOT NULL,
        started_at    TEXT,
        prev_started_at TEXT,
        PRIMARY KEY (app_id, ts)
      );
      CREATE INDEX IF NOT EXISTS idx_restarts_app_ts ON restarts(app_id, ts);

      CREATE TABLE IF NOT EXISTS deploys (
        app_id    TEXT NOT NULL,
        ts        INTEGER NOT NULL,
        file_name TEXT,
        file_size INTEGER,
        success   INTEGER,
        message   TEXT,
        PRIMARY KEY (app_id, ts)
      );
      CREATE INDEX IF NOT EXISTS idx_deploys_app_ts ON deploys(app_id, ts);
    `);

    // Migrations idempotentes: ALTER TABLE com coluna nova. sql.js erra se a
    // coluna já existe, então faz try/catch silencioso.
    try { this.db.run(`ALTER TABLE deploys ADD COLUMN build_log TEXT`); }
    catch { /* coluna já existe */ }

    // Não mantemos prepared statements como propriedades porque
    // db.export() do sql.js fecha TODOS os statements abertos.
  }

  insertRestart(appId, ts, startedAt, prevStartedAt) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO restarts (app_id, ts, started_at, prev_started_at)
      VALUES (?, ?, ?, ?)
    `);
    try { stmt.run([appId, ts, startedAt, prevStartedAt]); }
    finally { stmt.free(); }
    this._markDirty();
  }

  restarts(appId, sinceMs) {
    const stmt = this.db.prepare(
      `SELECT * FROM restarts WHERE app_id = ? AND ts >= ? ORDER BY ts ASC`
    );
    stmt.bind([appId, sinceMs]);
    const out = [];
    while (stmt.step()) out.push(stmt.getAsObject());
    stmt.free();
    return out;
  }

  _markDirty() {
    this.dirty = true;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this._flush(), 2000);
  }

  _flush() {
    if (!this.dirty) return;
    try {
      const data = this.db.export();
      fs.writeFileSync(this.file, Buffer.from(data));
      this.dirty = false;
    } catch (err) {
      console.error('[db] flush error:', err);
    }
  }

  insertSnapshot(row) {
    this.insertMany([row]);
  }

  insertMany(rows) {
    this.db.run('BEGIN');
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO snapshots
      (app_id, ts, running, cpu, memory_mb, memory_max, ssd_mb, net_down, net_up, uptime_ms, last_restart, raw)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    try {
      for (const r of rows) {
        stmt.run([
          r.app_id, r.ts, r.running, r.cpu, r.memory_mb, r.memory_max,
          r.ssd_mb, r.net_down, r.net_up, r.uptime_ms, r.last_restart, r.raw
        ]);
      }
      this.db.run('COMMIT');
      this._markDirty();
    } catch (err) {
      try { this.db.run('ROLLBACK'); } catch {}
      throw err;
    } finally {
      try { stmt.free(); } catch {}
    }
  }

  history(appId, sinceMs) {
    const stmt = this.db.prepare(
      `SELECT * FROM snapshots WHERE app_id = ? AND ts >= ? ORDER BY ts ASC`
    );
    stmt.bind([appId, sinceMs]);
    const out = [];
    while (stmt.step()) out.push(stmt.getAsObject());
    stmt.free();
    return out;
  }

  latest(appId) {
    const stmt = this.db.prepare(
      `SELECT * FROM snapshots WHERE app_id = ? ORDER BY ts DESC LIMIT 1`
    );
    stmt.bind([appId]);
    const row = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return row;
  }

  insertDeploy(appId, info) {
    // Build logs podem ser grandes (Docker imprime muita coisa). Cap em ~500KB
    // por deploy mantendo o final (que é o que importa pra debug). Mantém só
    // os deploys mais recentes — purga em separado quando lista crescer.
    let buildLog = info.buildLog || null;
    if (typeof buildLog === 'string' && buildLog.length > 500_000) {
      const head = `[…log truncado, ${buildLog.length} caracteres, mantendo final…]\n`;
      buildLog = head + buildLog.slice(-(500_000 - head.length));
    }

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO deploys (app_id, ts, file_name, file_size, success, message, build_log)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    try {
      stmt.run([
        appId,
        info.ts || Date.now(),
        info.fileName || null,
        info.fileSize || null,
        info.success ? 1 : 0,
        info.message || null,
        buildLog
      ]);
    } finally { stmt.free(); }
    this._markDirty();
  }

  // Lista de deploys sem o build_log (que pode ser grande). UI usa esta
  // pra renderizar o histórico — o log é carregado on-demand.
  deploys(appId, limit = 20) {
    const stmt = this.db.prepare(
      `SELECT app_id, ts, file_name, file_size, success, message,
              CASE WHEN build_log IS NULL OR build_log = '' THEN 0 ELSE 1 END AS has_log,
              LENGTH(build_log) AS log_size
       FROM deploys WHERE app_id = ? ORDER BY ts DESC LIMIT ?`
    );
    stmt.bind([appId, limit]);
    const out = [];
    while (stmt.step()) out.push(stmt.getAsObject());
    stmt.free();
    return out;
  }

  // Carrega o build log de um deploy específico (sob demanda).
  deployBuildLog(appId, ts) {
    const stmt = this.db.prepare(
      `SELECT build_log FROM deploys WHERE app_id = ? AND ts = ? LIMIT 1`
    );
    stmt.bind([appId, ts]);
    const log = stmt.step() ? (stmt.getAsObject().build_log || '') : '';
    stmt.free();
    return log;
  }

  historyRange(sinceMs, appId) {
    const sql = appId
      ? `SELECT * FROM snapshots WHERE ts >= ? AND app_id = ? ORDER BY ts ASC`
      : `SELECT * FROM snapshots WHERE ts >= ? ORDER BY app_id ASC, ts ASC`;
    const stmt = this.db.prepare(sql);
    stmt.bind(appId ? [sinceMs, appId] : [sinceMs]);
    const out = [];
    while (stmt.step()) out.push(stmt.getAsObject());
    stmt.free();
    return out;
  }

  // ------------------------------------------------------------
  // SLA / saúde: agrega snapshots numa janela pra calcular uptime %,
  // CPU/RAM médios, variância de CPU e nº de restarts. Tudo numa varredura
  // só por tabela. Resultado: `{ appId → { samples, up, avgRamPct, avgCpu,
  // cpuStddev, firstTs, lastTs, restarts } }`. Restarts vêm da tabela
  // `restarts` (já populada pelo poller). Para um único app, passar appId.
  slaStatsAll(sinceMs, appId = null) {
    const out = {};

    const sql = appId
      ? `SELECT app_id,
                COUNT(*) AS samples,
                SUM(CASE WHEN running=1 THEN 1 ELSE 0 END) AS up,
                AVG(CASE WHEN memory_max > 0 THEN (memory_mb * 100.0 / memory_max) ELSE NULL END) AS avg_ram_pct,
                AVG(cpu) AS avg_cpu,
                AVG(cpu * cpu) AS avg_cpu_sq,
                MIN(ts) AS first_ts,
                MAX(ts) AS last_ts
         FROM snapshots WHERE ts >= ? AND app_id = ? GROUP BY app_id`
      : `SELECT app_id,
                COUNT(*) AS samples,
                SUM(CASE WHEN running=1 THEN 1 ELSE 0 END) AS up,
                AVG(CASE WHEN memory_max > 0 THEN (memory_mb * 100.0 / memory_max) ELSE NULL END) AS avg_ram_pct,
                AVG(cpu) AS avg_cpu,
                AVG(cpu * cpu) AS avg_cpu_sq,
                MIN(ts) AS first_ts,
                MAX(ts) AS last_ts
         FROM snapshots WHERE ts >= ? GROUP BY app_id`;

    const stmt = this.db.prepare(sql);
    stmt.bind(appId ? [sinceMs, appId] : [sinceMs]);
    while (stmt.step()) {
      const r = stmt.getAsObject();
      const avgCpu = r.avg_cpu || 0;
      const avgCpuSq = r.avg_cpu_sq || 0;
      // variância = E[X²] - E[X]² (clamp ≥0 pra evitar -ε numérico)
      const variance = Math.max(0, avgCpuSq - avgCpu * avgCpu);
      out[r.app_id] = {
        samples: r.samples || 0,
        up: r.up || 0,
        uptimePct: r.samples > 0 ? (r.up / r.samples) * 100 : null,
        avgRamPct: r.avg_ram_pct,
        avgCpu,
        cpuStddev: Math.sqrt(variance),
        firstTs: r.first_ts,
        lastTs: r.last_ts,
        restarts: 0
      };
    }
    stmt.free();

    // Adiciona contagem de restarts no mesmo período
    const sqlR = appId
      ? `SELECT app_id, COUNT(*) AS n FROM restarts WHERE ts >= ? AND app_id = ? GROUP BY app_id`
      : `SELECT app_id, COUNT(*) AS n FROM restarts WHERE ts >= ? GROUP BY app_id`;
    const stmtR = this.db.prepare(sqlR);
    stmtR.bind(appId ? [sinceMs, appId] : [sinceMs]);
    while (stmtR.step()) {
      const r = stmtR.getAsObject();
      if (!out[r.app_id]) out[r.app_id] = { samples: 0, up: 0, uptimePct: null, restarts: 0 };
      out[r.app_id].restarts = r.n || 0;
    }
    stmtR.free();

    return out;
  }

  purgeOlderThan(ms) {
    const stmt = this.db.prepare(`SELECT COUNT(*) AS n FROM snapshots WHERE ts < ?`);
    stmt.bind([ms]);
    stmt.step();
    const n = stmt.getAsObject().n;
    stmt.free();
    this.db.run(`DELETE FROM snapshots WHERE ts < ?`, [ms]);
    this._markDirty();
    return n;
  }

  close() {
    this._flush();
    try { this.db.close(); } catch {}
  }
}

module.exports = { Database };
