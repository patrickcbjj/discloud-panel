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
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO deploys (app_id, ts, file_name, file_size, success, message)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    try {
      stmt.run([
        appId,
        info.ts || Date.now(),
        info.fileName || null,
        info.fileSize || null,
        info.success ? 1 : 0,
        info.message || null
      ]);
    } finally { stmt.free(); }
    this._markDirty();
  }

  deploys(appId, limit = 20) {
    const stmt = this.db.prepare(
      `SELECT * FROM deploys WHERE app_id = ? ORDER BY ts DESC LIMIT ?`
    );
    stmt.bind([appId, limit]);
    const out = [];
    while (stmt.step()) out.push(stmt.getAsObject());
    stmt.free();
    return out;
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
