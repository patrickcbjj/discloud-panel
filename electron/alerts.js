// Detecta mudanças de estado entre snapshots e dispara notificações Windows.
const { Notification } = require('electron');

const DEFAULT_SETTINGS = {
  alertOffline: true,
  alertRestart: true,
  alertOom: true,
  alertHighRam: true,
  alertHighCpu: true,
  alertApiError: true,
  alertAnomaly: true,
  ramThreshold: 90,     // %
  cpuThreshold: 80,     // %
  cpuSustainTicks: 3,   // ticks consecutivos
  anomalyZ: 3,          // múltiplos de desvio-padrão para considerar anomalia
  anomalyWindow: 30,    // tamanho da janela móvel (em ticks) usada como baseline
  anomalyMinSamples: 15 // mínimo de samples antes de começar a alertar
};

function meanStddev(arr) {
  if (!arr.length) return { mean: 0, std: 0 };
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
  return { mean, std: Math.sqrt(variance) };
}

class AlertEngine {
  constructor(store, iconPath, onClickApp) {
    this.store = store;
    this.iconPath = iconPath;
    this.onClickApp = onClickApp; // (appId) => void
    this.prev = new Map();        // app_id -> previous row
    this.cpuStreak = new Map();   // app_id -> consecutive high-cpu count
    this.lastFired = new Map();   // key -> ts (cooldown)
    this.cooldownMs = 5 * 60_000;
    this.ramWindow = new Map();   // app_id -> array de memory_mb (janela móvel)
    this.cpuWindow = new Map();   // app_id -> array de cpu
    this.prevOom = new Map();     // app_id -> ramKilled boolean anterior
    this.apiErrorStreak = 0;      // erros consecutivos da API (reset em snapshot ok)
    this.apiErrorThreshold = 2;   // só notifica a partir do 2º erro seguido
  }

  _settings() {
    const s = {};
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
      const stored = this.store.get(k);
      s[k] = stored === undefined ? v : stored;
    }
    return s;
  }

  _canFire(key) {
    const last = this.lastFired.get(key) || 0;
    if (Date.now() - last < this.cooldownMs) return false;
    this.lastFired.set(key, Date.now());
    return true;
  }

  _notify({ title, body, appId, key }) {
    if (!Notification.isSupported()) return;
    if (key && !this._canFire(key)) return;
    const n = new Notification({
      title,
      body,
      icon: this.iconPath,
      silent: false
    });
    if (appId && this.onClickApp) {
      n.on('click', () => this.onClickApp(appId));
    }
    n.show();
  }

  processSnapshot(rows, appsMeta) {
    const s = this._settings();
    // Tick bem-sucedido limpa o streak de erros da API (glitches isolados não
    // disparam notificação porque exigem 2+ falhas consecutivas).
    this.apiErrorStreak = 0;
    const nameOf = (id) => {
      const m = appsMeta.find((a) => String(a.id ?? a.appId ?? a._id) === id);
      return m?.name || id;
    };

    for (const row of rows) {
      const id = row.app_id;
      const prev = this.prev.get(id);
      const name = nameOf(id);

      // Offline: estava on, ficou off
      if (s.alertOffline && prev && prev.running === 1 && row.running === 0) {
        this._notify({
          title: `🔴 ${name} ficou offline`,
          body: `O app ${name} estava online e agora está fora do ar.`,
          appId: id,
          key: `offline:${id}`
        });
      }

      // Restart inesperado: uptime caiu
      if (s.alertRestart && prev && prev.uptime_ms != null && row.uptime_ms != null) {
        if (row.uptime_ms < prev.uptime_ms - 30_000 && row.running) {
          this._notify({
            title: `🔄 ${name} foi reiniciado`,
            body: `Uptime caiu de ${formatMs(prev.uptime_ms)} para ${formatMs(row.uptime_ms)}.`,
            appId: id,
            key: `restart:${id}`
          });
        }
      }

      // OOM kill detectado (transição false → true em ramKilled)
      const meta = appsMeta.find((a) => String(a.id ?? a.appId ?? a._id) === id);
      const ramKilled = meta?.ramKilled === true;
      const prevRamKilled = this.prevOom.get(id) === true;
      if (s.alertOom && ramKilled && !prevRamKilled) {
        this._notify({
          title: `💀 ${name} morreu por OOM`,
          body: `Container foi morto por estouro de RAM. Considere aumentar a RAM alocada.`,
          appId: id,
          key: `oom:${id}`
        });
      }
      this.prevOom.set(id, ramKilled);

      // RAM > threshold
      if (s.alertHighRam && row.memory_mb != null && row.memory_max) {
        const pct = (row.memory_mb / row.memory_max) * 100;
        if (pct >= s.ramThreshold) {
          this._notify({
            title: `⚠️ ${name} com RAM alta`,
            body: `${pct.toFixed(0)}% (${Math.round(row.memory_mb)} MB de ${Math.round(row.memory_max)} MB).`,
            appId: id,
            key: `ram:${id}`
          });
        }
      }

      // CPU sustentado > threshold
      if (s.alertHighCpu && row.cpu != null) {
        if (row.cpu >= s.cpuThreshold) {
          const streak = (this.cpuStreak.get(id) || 0) + 1;
          this.cpuStreak.set(id, streak);
          if (streak === s.cpuSustainTicks) {
            this._notify({
              title: `🔥 ${name} com CPU alta`,
              body: `CPU em ${row.cpu.toFixed(1)}% por ${streak} ticks seguidos.`,
              appId: id,
              key: `cpu:${id}`
            });
          }
        } else {
          this.cpuStreak.set(id, 0);
        }
      }

      // Detecção de anomalia (Z-score sobre janela móvel)
      if (s.alertAnomaly && row.running) {
        const checkAnomaly = (metric, value, fmt) => {
          if (value == null) return;
          const map = metric === 'ram' ? this.ramWindow : this.cpuWindow;
          const arr = map.get(id) || [];
          arr.push(value);
          while (arr.length > s.anomalyWindow) arr.shift();
          map.set(id, arr);
          if (arr.length < s.anomalyMinSamples) return;
          // baseline exclui o sample atual para evitar enviesar
          const baseline = arr.slice(0, -1);
          const { mean, std } = meanStddev(baseline);
          if (std < 1) return; // série estável demais — qualquer pico falso positivo
          const dev = (value - mean) / std;
          if (Math.abs(dev) >= s.anomalyZ) {
            this._notify({
              title: `📈 ${name}: anomalia de ${metric.toUpperCase()}`,
              body: `${fmt(value)} (esperado ~${fmt(mean)}, ${dev > 0 ? '+' : ''}${dev.toFixed(1)}σ).`,
              appId: id,
              key: `anomaly-${metric}:${id}`
            });
          }
        };
        checkAnomaly('ram', row.memory_mb, (v) => `${Math.round(v)} MB`);
        checkAnomaly('cpu', row.cpu, (v) => `${v.toFixed(1)}%`);
      }

      this.prev.set(id, row);
    }
  }

  processError(err) {
    const s = this._settings();
    if (!s.alertApiError) return;
    this.apiErrorStreak += 1;
    if (this.apiErrorStreak < this.apiErrorThreshold) return;
    this._notify({
      title: '❌ Erro na API da Discloud',
      body: err.message || 'Falha ao consultar status dos apps.',
      key: `apierror:${err.status || 'unknown'}`
    });
  }
}

function formatMs(ms) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}

module.exports = { AlertEngine, DEFAULT_SETTINGS };
