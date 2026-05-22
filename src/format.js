// Discloud retorna `type` como número (1 = bot, 0 = site) ou às vezes string.
export function appTypeLabel(t) {
  if (t == null || t === '') return null;
  if (typeof t === 'number') {
    if (t === 1) return 'bot';
    if (t === 0) return 'site';
    return String(t);
  }
  const s = String(t).toLowerCase().trim();
  if (s === '1' || s === 'bot') return 'bot';
  if (s === '0' || s === 'site') return 'site';
  return s;
}

export const fmtMB = (n) => {
  if (n == null || Number.isNaN(n)) return '—';
  if (n >= 1024) return (n / 1024).toFixed(2) + ' GB';
  return n.toFixed(0) + ' MB';
};

export const fmtBytes = (n) => {
  if (n == null || Number.isNaN(n)) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0; let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return v.toFixed(v >= 100 || i === 0 ? 0 : 2) + ' ' + units[i];
};

export const fmtPct = (n) => (n == null ? '—' : n.toFixed(1) + '%');

export const fmtUptime = (ms) => {
  if (ms == null || ms < 0) return '—';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d}d ${h}h ${m}m`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
};

export const fmtTime = (ms) => {
  const d = new Date(ms);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};
