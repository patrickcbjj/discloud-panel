// Agendador de backup automático.
// Verifica a cada 60s se chegou no dia/hora marcados; baixa backup de todos
// os apps próprios + apps de equipe com permissão backup_app.

const fs = require('node:fs');
const path = require('node:path');
const logger = require('./logger');

const DEFAULTS = {
  backupEnabled: false,
  backupDay: 2,        // 0=domingo … 6=sábado (2=terça)
  backupHour: 3,
  backupMinute: 0,
  backupRetention: 4,
  backupCatchupHours: 24
};

const BACKUP_PERM_ALIASES = ['backup_app', 'backup'];

function extractList(res) {
  return Array.isArray(res?.apps) ? res.apps
       : Array.isArray(res?.data) ? res.data
       : Array.isArray(res) ? res : [];
}

function sanitize(name) {
  return String(name || 'app').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 80);
}

function pad(n) { return String(n).padStart(2, '0'); }

function sessionFolder(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
}

async function downloadToFile(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ao baixar ${url}`);
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  const tmp = dest + '.part';
  const handle = await fs.promises.open(tmp, 'w');
  try {
    const reader = res.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await handle.write(value);
    }
  } finally {
    await handle.close();
  }
  await fs.promises.rename(tmp, dest);
  const stat = await fs.promises.stat(dest);
  return stat.size;
}

class BackupScheduler {
  constructor({ store, getClient, defaultFolder, onNotify }) {
    this.store = store;
    this.getClient = getClient;
    this.defaultFolder = defaultFolder;
    this.onNotify = onNotify || (() => {});
    this.timer = null;
    this.running = false;
    this.lastChecked = 0;
  }

  cfg(key) {
    const v = this.store.get(key);
    return v === undefined || v === null ? DEFAULTS[key] : v;
  }

  folder() {
    return this.store.get('backupFolder') || this.defaultFolder;
  }

  start() {
    this.stop();
    logger.info('[backup] scheduler started');
    this.timer = setInterval(() => this._tick().catch((e) => logger.error('[backup] tick error', e?.message)), 60_000);
    // primeira verificação após 5s (dá tempo do app inicializar)
    setTimeout(() => this._tick().catch(() => {}), 5_000);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async _tick() {
    if (!this.cfg('backupEnabled')) return;
    if (this.running) return;

    const now = new Date();
    const target = new Date(now);
    target.setHours(this.cfg('backupHour'), this.cfg('backupMinute'), 0, 0);

    // ajusta target pra o dia da semana marcado mais próximo no passado/presente
    const dow = this.cfg('backupDay');
    const diffDays = (now.getDay() - dow + 7) % 7;
    target.setDate(target.getDate() - diffDays);
    if (target > now) target.setDate(target.getDate() - 7);

    const targetTs = target.getTime();
    const lastRun = Number(this.store.get('backupLastRun') || 0);
    if (lastRun >= targetTs) return; // já rodou pra esse target

    // janela de catch-up: só roda se estiver dentro de N horas após o target
    const catchupMs = this.cfg('backupCatchupHours') * 3600_000;
    if (now.getTime() - targetTs > catchupMs) {
      // perdeu a janela; marca como "rodado" pra não tentar de novo até o próximo agendamento
      this.store.set('backupLastRun', targetTs);
      logger.warn('[backup] missed window for target=', target.toISOString(), '— skipping until next');
      return;
    }

    logger.info('[backup] auto-trigger for target=', target.toISOString());
    await this.runOnce({ trigger: 'auto', targetTs });
  }

  async runOnce({ trigger = 'manual', targetTs = Date.now() } = {}) {
    if (this.running) return { error: 'já está rodando' };
    this.running = true;
    const startTs = Date.now();
    const session = sessionFolder(startTs);
    const dir = path.join(this.folder(), session);
    const result = { ts: startTs, trigger, folder: dir, items: [], ok: 0, fail: 0 };

    try {
      const client = this.getClient();
      if (!client) throw new Error('cliente Discloud não disponível (token não configurado?)');

      // own apps
      let ownApps = [];
      try {
        const r = await client.allApps();
        ownApps = extractList(r).map((a) => ({ id: String(a.id ?? a.appId ?? a._id), name: a.name, team: false }));
      } catch (e) { logger.warn('[backup] allApps failed:', e?.message); }

      // team apps (só os com permissão backup_app)
      let teamApps = [];
      try {
        const r = await client.team();
        teamApps = extractList(r)
          .filter((a) => {
            const perms = a.perms || a.mods || a.permissions || [];
            return perms.length === 0 || perms.some((p) => BACKUP_PERM_ALIASES.includes(p));
          })
          .map((a) => ({ id: String(a.id ?? a.appId ?? a._id), name: a.name, team: true }));
      } catch (e) {
        if (e?.status !== 403) logger.warn('[backup] team list failed:', e?.message);
      }

      const all = [...ownApps, ...teamApps];
      logger.info('[backup] starting', all.length, 'apps (own=', ownApps.length, 'team=', teamApps.length, ')');

      await fs.promises.mkdir(dir, { recursive: true });

      for (const app of all) {
        const item = { id: app.id, name: app.name, team: app.team, ok: false };
        try {
          const res = app.team ? await client.teamBackup(app.id) : await client.backup(app.id);
          const url = res?.backups?.url || res?.url || res?.apps?.url;
          if (!url) throw new Error('sem URL no retorno da API');
          const dest = path.join(dir, `${sanitize(app.name || app.id)}_${app.id}.zip`);
          const size = await downloadToFile(url, dest);
          item.ok = true;
          item.path = dest;
          item.size = size;
          result.ok++;
        } catch (e) {
          item.error = e?.message || String(e);
          result.fail++;
          logger.warn('[backup] failed', app.id, item.error);
        }
        result.items.push(item);
      }

      // retenção: lista pastas de sessão (ordenadas por nome desc = mais recente primeiro)
      try {
        const keep = Math.max(1, Number(this.cfg('backupRetention')));
        const entries = await fs.promises.readdir(this.folder(), { withFileTypes: true });
        const sessions = entries
          .filter((e) => e.isDirectory() && /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}$/.test(e.name))
          .map((e) => e.name)
          .sort()
          .reverse();
        const toDelete = sessions.slice(keep);
        for (const name of toDelete) {
          const p = path.join(this.folder(), name);
          await fs.promises.rm(p, { recursive: true, force: true });
          logger.info('[backup] retention: removed', p);
        }
        result.removed = toDelete.length;
      } catch (e) {
        logger.warn('[backup] retention failed:', e?.message);
      }

      result.durationMs = Date.now() - startTs;
      this._appendHistory(result);

      if (trigger === 'auto') this.store.set('backupLastRun', targetTs);

      const summary = `${result.ok} OK, ${result.fail} falhas`;
      this.onNotify({
        title: result.fail === 0 ? 'Backup concluído' : 'Backup concluído com falhas',
        body: `${summary} · pasta: ${session}`,
        success: result.fail === 0
      });

      return result;
    } catch (e) {
      logger.error('[backup] runOnce failed:', e?.message, e?.stack);
      result.error = e?.message || String(e);
      result.durationMs = Date.now() - startTs;
      this._appendHistory(result);
      this.onNotify({ title: 'Backup falhou', body: result.error, success: false });
      return result;
    } finally {
      this.running = false;
    }
  }

  _appendHistory(entry) {
    const trimmed = {
      ts: entry.ts,
      trigger: entry.trigger,
      folder: entry.folder,
      ok: entry.ok || 0,
      fail: entry.fail || 0,
      removed: entry.removed || 0,
      durationMs: entry.durationMs || 0,
      error: entry.error || null,
      items: (entry.items || []).map((i) => ({
        id: i.id, name: i.name, team: !!i.team, ok: !!i.ok, size: i.size || null, error: i.error || null
      }))
    };
    const hist = this.store.get('backupHistory') || [];
    hist.unshift(trimmed);
    if (hist.length > 50) hist.length = 50;
    this.store.set('backupHistory', hist);
  }

  history() {
    return this.store.get('backupHistory') || [];
  }

  isRunning() {
    return this.running;
  }
}

module.exports = { BackupScheduler };
