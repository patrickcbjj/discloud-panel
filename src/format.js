// Todo container Discloud que escuta numa porta ganha <id>.discloud.app —
// inclusive bots Node/Python que rodam servidor HTTP além da função principal.
// Por isso a URL é mostrada pra qualquer tipo; se o app não escuta na porta,
// o subdomínio retorna 502 e o usuário descobre clicando.
export function appSiteUrl(app) {
  if (!app) return null;
  const raw = app.raw || app;
  if (raw.url) return String(raw.url).startsWith('http') ? raw.url : `https://${raw.url}`;
  const sub = raw.subDomain || raw.subdomain || raw.domain;
  if (sub) {
    const host = String(sub).includes('.') ? sub : `${sub}.discloud.app`;
    return `https://${host}`;
  }
  const id = app.id || raw.id;
  if (!id) return null;
  return `https://${String(id).toLowerCase()}.discloud.app`;
}

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

// "há X dias / meses / anos" — para datas no passado
export function fmtRelativePast(ms, locale = 'pt') {
  if (!ms) return null;
  const diff = Math.max(0, Date.now() - ms);
  const s = Math.floor(diff / 1000);
  const PT = { day: 'dia', days: 'dias', month: 'mês', months: 'meses', year: 'ano', years: 'anos', hour: 'hora', hours: 'horas', min: 'minuto', mins: 'minutos' };
  const EN = { day: 'day', days: 'days', month: 'month', months: 'months', year: 'year', years: 'years', hour: 'hour', hours: 'hours', min: 'minute', mins: 'minutes' };
  const L = locale === 'en' ? EN : PT;
  if (s < 60) return locale === 'en' ? 'just now' : 'agora há pouco';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} ${m === 1 ? L.min : L.mins}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ${h === 1 ? L.hour : L.hours}`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} ${d === 1 ? L.day : L.days}`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo} ${mo === 1 ? L.month : L.months}`;
  const y = Math.floor(d / 365);
  return `${y} ${y === 1 ? L.year : L.years}`;
}

// Descreve um exit code retornado pela Discloud
export function describeExitCode(code, t) {
  if (code == null) return null;
  if (code === 0) return { label: t('appDetail.exitCodeOk'), tone: 'ok' };
  if (code === 137) return { label: t('appDetail.exitCodeOom'), tone: 'oom' };
  if (code >= 128 && code < 165) return { label: t('appDetail.exitCodeSig', { n: code - 128 }), tone: 'bad' };
  return { label: t('appDetail.exitCodeErr', { n: code }), tone: 'bad' };
}
