import React from 'react';
import { Heart, HelpCircle } from 'lucide-react';
import { healthClasses } from '../health.js';
import { useT } from '../i18n.js';

const LABEL_KEY = {
  excellent: 'settings.healthExcellent',
  good: 'settings.healthGood',
  fair: 'settings.healthFair',
  poor: 'settings.healthPoor',
  unknown: 'settings.healthUnknown'
};

// Chip compacto que mostra o health score. Variantes:
//   - tiny: só a bolinha colorida + número (pra sidebar)
//   - normal: bolinha + número + label (pra header do AppDetail)
//   - full: tudo + tooltip detalhado com as razões
export default function HealthChip({ health, variant = 'normal', className = '' }) {
  const t = useT();
  const label = health?.label || 'unknown';
  const cls = healthClasses(label);
  const score = health?.score;

  // Monta tooltip com as razões
  let tooltip = '';
  if (health) {
    const lines = [];
    if (score != null) {
      lines.push(`${t('settings.healthScore')}: ${score}/100`);
      lines.push(t(`${LABEL_KEY[label]}`));
    }
    if (health.reasons?.length) {
      lines.push('');
      for (const r of health.reasons) {
        let msg = '';
        if (r.key === 'restarts')    msg = t('settings.healthReasonRestarts', { n: r.n });
        if (r.key === 'oom')         msg = t('settings.healthReasonOom');
        if (r.key === 'high-ram')    msg = t('settings.healthReasonHighRam', { n: Math.round(r.value) });
        if (r.key === 'cpu-variance')msg = t('settings.healthReasonCpuVariance');
        lines.push(`${r.delta > 0 ? '+' : ''}${r.delta}: ${msg}`);
      }
    }
    if (typeof health.samples === 'number' && health.samples > 0) {
      lines.push('');
      lines.push(t('settings.slaSamples', { n: health.samples.toLocaleString() }));
    }
    tooltip = lines.join('\n');
  }

  if (variant === 'tiny') {
    return (
      <span
        className={`inline-flex items-center gap-1 ${className}`}
        title={tooltip}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${cls.dot}`} />
        <span className={`text-[10px] font-mono font-semibold ${cls.text}`}>
          {score != null ? score : '—'}
        </span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium ${cls.bg} ${cls.text} ${cls.border} ${className}`}
      title={tooltip}
    >
      {score == null
        ? <HelpCircle size={12} />
        : <Heart size={12} fill="currentColor" />}
      <span className="font-mono font-semibold">
        {score != null ? `${score}` : '—'}
      </span>
      <span className="text-[10px] uppercase tracking-wider opacity-80">
        {t(LABEL_KEY[label])}
      </span>
    </span>
  );
}
