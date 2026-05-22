// Monitora se a API da Discloud está respondendo.
// Faz uma requisição leve a cada PROBE_INTERVAL_MS; resposta HTTP válida = ONLINE,
// timeout/erro de rede = OFFLINE.

const PROBE_INTERVAL_MS = 30_000;
const PROBE_TIMEOUT_MS = 8_000;
const TARGET = 'https://api.discloud.app/v2/locale';

class DiscloudStatusMonitor {
  constructor({ onChange } = {}) {
    this.onChange = onChange || (() => {});
    this.state = { status: 'unknown', latencyMs: null, checkedAt: null };
    this.timer = null;
  }

  start() {
    if (this.timer) return;
    this.probe();
    this.timer = setInterval(() => this.probe(), PROBE_INTERVAL_MS);
  }

  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  current() { return this.state; }

  async probe() {
    const t0 = Date.now();
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), PROBE_TIMEOUT_MS);
    let next;
    try {
      const res = await fetch(TARGET, {
        method: 'GET',
        signal: ctl.signal,
        headers: { 'User-Agent': 'discloud-panel/0.1 (status-probe)' }
      });
      // Qualquer resposta HTTP válida (incl. 401/404) = API no ar.
      // 5xx por mais que seja "no ar" é claramente degradado.
      const ok = res.status < 500;
      next = {
        status: ok ? 'online' : 'offline',
        latencyMs: Date.now() - t0,
        checkedAt: Date.now(),
        httpStatus: res.status
      };
    } catch (e) {
      next = {
        status: 'offline',
        latencyMs: null,
        checkedAt: Date.now(),
        error: e.name === 'AbortError' ? 'timeout' : (e.message || 'network')
      };
    } finally {
      clearTimeout(to);
    }

    const changed = next.status !== this.state.status;
    this.state = next;
    if (changed) this.onChange(next);
  }
}

module.exports = { DiscloudStatusMonitor };
