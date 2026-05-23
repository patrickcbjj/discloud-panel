// Computa health score (0-100) e label a partir de stats da SLA (24h).
// As estatísticas vêm de window.api.db.slaStats() — agregadas no SQLite.
//
// Como combinamos:
//   base = uptime% nas últimas 24h
//   - restartPenalty: -3 por restart, cap em -25
//   - ramKilledPenalty: -15 se app está OOM agora (do meta atual, não histórico)
//   - highRamPenalty: -10 se RAM% média > 85
//   - highCpuVariance: -10 se stddev(CPU) > 35
// Floor em 0, ceiling em 100.

const MIN_SAMPLES = 10; // abaixo disso, dados insuficientes -> null

export function computeHealth(stats, app) {
  if (!stats || stats.samples == null || stats.samples < MIN_SAMPLES) {
    return { score: null, reason: 'insufficient-data', samples: stats?.samples || 0 };
  }

  const uptime = stats.uptimePct ?? 0;
  let score = uptime;
  const reasons = [];

  // Restarts (proxy de instabilidade)
  const restartPenalty = Math.min(25, (stats.restarts || 0) * 3);
  if (restartPenalty > 0) {
    score -= restartPenalty;
    reasons.push({ key: 'restarts', delta: -restartPenalty, n: stats.restarts });
  }

  // OOM agora
  if (app?.ramKilled) {
    score -= 15;
    reasons.push({ key: 'oom', delta: -15 });
  }

  // RAM sustentadamente alta
  if (typeof stats.avgRamPct === 'number' && stats.avgRamPct > 85) {
    score -= 10;
    reasons.push({ key: 'high-ram', delta: -10, value: stats.avgRamPct });
  }

  // CPU oscilante (variância alta = picos imprevisíveis)
  if (typeof stats.cpuStddev === 'number' && stats.cpuStddev > 35) {
    score -= 10;
    reasons.push({ key: 'cpu-variance', delta: -10, value: stats.cpuStddev });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score,
    label: healthLabel(score),
    reasons,
    samples: stats.samples,
    uptimePct: uptime,
    restarts: stats.restarts || 0,
    avgRamPct: stats.avgRamPct,
    cpuStddev: stats.cpuStddev
  };
}

export function healthLabel(score) {
  if (score == null) return 'unknown';
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 50) return 'fair';
  return 'poor';
}

// Classes Tailwind por label (cor consistente em todo o app)
export function healthClasses(label) {
  switch (label) {
    case 'excellent': return { bg: 'bg-success/15', text: 'text-success', border: 'border-success/30', dot: 'bg-success' };
    case 'good':      return { bg: 'bg-success/10', text: 'text-success', border: 'border-success/20', dot: 'bg-success' };
    case 'fair':      return { bg: 'bg-warn/15',    text: 'text-warn',    border: 'border-warn/30',    dot: 'bg-warn' };
    case 'poor':      return { bg: 'bg-danger/15',  text: 'text-danger',  border: 'border-danger/30',  dot: 'bg-danger' };
    default:          return { bg: 'bg-panel2',     text: 'text-mute',    border: 'border-border',     dot: 'bg-mute' };
  }
}

// Formata uptime com precisão adaptativa: 99.95% ou 87.2% ou 0%
export function fmtUptimePct(pct) {
  if (pct == null) return '—';
  if (pct >= 99) return pct.toFixed(2) + '%';
  if (pct >= 90) return pct.toFixed(1) + '%';
  return Math.round(pct) + '%';
}
