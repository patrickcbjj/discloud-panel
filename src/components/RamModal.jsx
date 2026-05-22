import React, { useEffect, useState } from 'react';
import { X, MemoryStick, AlertTriangle, Info } from 'lucide-react';
import { fmtMB } from '../format.js';
import { useT } from '../i18n.js';

const MIN_RAM = 100;
const HARD_MAX = 8192;
const STEP = 100;

// Tenta extrair o total de RAM do plano de diferentes campos possíveis da /user
function detectPlanRam(user) {
  if (!user) return null;
  const u = user.user || user;
  const candidates = [
    u.ramQuantity, u.ramMB, u.ram, u.totalRamMb, u.totalRam,
    u.plan?.ramQuantity, u.plan?.ram, u.plan?.totalRam,
    user.ramQuantity, user.totalRamMb
  ];
  for (const c of candidates) {
    if (typeof c === 'number' && c > 0) return c;
    if (typeof c === 'string') {
      const m = /([\d.]+)\s*(MB|GB)?/i.exec(c);
      if (m) {
        const n = parseFloat(m[1]);
        return (m[2] && m[2].toUpperCase() === 'GB') ? n * 1024 : n;
      }
    }
  }
  return null;
}

export default function RamModal({ app, apps = [], user = null, onClose, onSaved }) {
  const t = useT();
  const current = app.memory_max || 512;
  const [value, setValue] = useState(current);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [planOverride, setPlanOverride] = useState(null);

  useEffect(() => {
    window.api.config.get('planTotalRam').then((v) => {
      if (v) setPlanOverride(Number(v));
    });
  }, []);

  // calcular alocação
  const detected = detectPlanRam(user);
  const planTotal = planOverride || detected || null;
  const allocatedTotal = apps.reduce(
    (sum, a) => sum + (a.memory_max || a.raw?.ram || 0),
    0
  );
  const otherAllocated = allocatedTotal - current;
  const available = planTotal ? Math.max(0, planTotal - otherAllocated) : null;
  const sliderMax = available != null ? Math.min(HARD_MAX, available) : HARD_MAX;

  // se o valor atual já passa do limite, ajusta
  useEffect(() => {
    if (available != null && value > sliderMax) setValue(sliderMax);
  }, [sliderMax]);

  const save = async () => {
    if (value === current) { onClose(); return; }
    setSaving(true); setErr(null);
    try {
      const fn = app.team ? window.api.discloud.teamSetRam : window.api.discloud.setRam;
      const res = await fn(app.id, value);
      onSaved?.(res?.message || t('ram.ramChanged', { v: value }));
      onClose();
      setTimeout(() => window.api.poller.tickNow(), 1500);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const saveOverride = async (mb) => {
    const n = Number(mb);
    if (n > 0) {
      await window.api.config.set('planTotalRam', n);
      setPlanOverride(n);
    } else {
      await window.api.config.set('planTotalRam', null);
      setPlanOverride(null);
    }
  };

  const delta = value - current;
  const memUsed = app.memory_mb || 0;
  const wouldExceedUsage = value < memUsed;
  const wouldExceedPlan = available != null && value > available;
  const blockSave = wouldExceedPlan;

  const pct = (n) => planTotal ? ((n / planTotal) * 100).toFixed(0) : '?';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-8">
      <div className="card w-full max-w-lg p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/15 text-accent flex items-center justify-center">
              <MemoryStick size={20} />
            </div>
            <div>
              <h2 className="font-semibold">{t('ram.title')}</h2>
              <p className="text-xs text-mute">{app.name}</p>
            </div>
          </div>
          <button className="btn !py-1 !px-2" onClick={onClose}><X size={13} /></button>
        </div>

        {/* alocação do plano */}
        {planTotal ? (
          <div className="bg-panel2 border border-border rounded-lg p-3 space-y-2">
            <div className="text-xs uppercase text-mute tracking-wider flex items-center justify-between">
              <span>{t('ram.planLabel')}</span>
              <span className="text-text font-semibold">{t('ram.totalLabel', { v: fmtMB(planTotal) })}</span>
            </div>
            <div className="h-3 bg-border rounded-full overflow-hidden flex">
              <div
                className="bg-accent2/70 h-full"
                style={{ width: `${(otherAllocated / planTotal) * 100}%` }}
                title={`${t('ram.othersAlloc')}: ${fmtMB(otherAllocated)}`}
              />
              <div
                className={`h-full ${wouldExceedPlan ? 'bg-danger' : 'bg-accent'}`}
                style={{ width: `${Math.min(100 - (otherAllocated / planTotal) * 100, (value / planTotal) * 100)}%` }}
                title={`${t('ram.thisApp')}: ${fmtMB(value)}`}
              />
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div>
                <div className="text-mute">{t('ram.othersAlloc')}</div>
                <div className="font-semibold">{fmtMB(otherAllocated)} <span className="text-mute font-normal">({pct(otherAllocated)}%)</span></div>
              </div>
              <div>
                <div className="text-mute">{t('ram.thisApp')}</div>
                <div className="font-semibold text-accent">{fmtMB(value)} <span className="text-mute font-normal">({pct(value)}%)</span></div>
              </div>
              <div>
                <div className="text-mute">{t('ram.available')}</div>
                <div className={`font-semibold ${wouldExceedPlan ? 'text-danger' : 'text-success'}`}>
                  {fmtMB(Math.max(0, planTotal - otherAllocated - value))}
                </div>
              </div>
            </div>
            {!detected && (
              <div className="flex items-start gap-1.5 text-[10px] text-mute pt-1">
                <Info size={10} className="shrink-0 mt-0.5" />
                {t('ram.manualLimit', { v: fmtMB(planOverride) })}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-warn/10 border border-warn/30 rounded-lg p-3 text-xs space-y-2">
            <div className="flex items-start gap-2 text-warn">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <div>
                {t('ram.detectFail')}
              </div>
            </div>
            <div className="flex gap-2 items-center pt-1">
              <span className="text-mute">{t('ram.planTotalLabel')}</span>
              <input
                type="number"
                placeholder={t('ram.planTotalPh')}
                onBlur={(e) => saveOverride(e.target.value)}
                className="selectable flex-1 bg-panel2 border border-border rounded px-2 py-1 text-xs focus:outline-none focus:border-accent"
              />
            </div>
            <div className="text-[10px] text-mute">
              {t('ram.alreadyAlloc')}: <span className="text-text font-semibold">{fmtMB(allocatedTotal)}</span>
            </div>
          </div>
        )}

        {/* slider */}
        <div>
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-xs text-mute uppercase tracking-wider">{t('ram.newAlloc')}</span>
            <div className="text-right">
              <div className="text-3xl font-semibold">{fmtMB(value)}</div>
              {delta !== 0 && (
                <div className={`text-xs ${delta > 0 ? 'text-warn' : 'text-success'}`}>
                  {delta > 0 ? '+' : ''}{delta} MB ({t('ram.currentLabel', { v: fmtMB(current) })})
                </div>
              )}
            </div>
          </div>

          <input
            type="range"
            min={MIN_RAM}
            max={sliderMax}
            step={STEP}
            value={Math.min(value, sliderMax)}
            onChange={(e) => setValue(Number(e.target.value))}
            className="w-full accent-accent"
          />
          <div className="flex justify-between text-[10px] text-mute mt-1">
            <span>{MIN_RAM} MB</span>
            <span>{t('ram.maxLabel', { v: fmtMB(sliderMax) })}</span>
          </div>
        </div>

        {/* presets - só os que cabem */}
        <div className="flex gap-2 flex-wrap">
          {[100, 256, 512, 1024, 2048, 4096].filter((v) => v <= sliderMax).map((v) => (
            <button
              key={v}
              onClick={() => setValue(v)}
              className={`btn !py-1 !px-2.5 !text-xs ${value === v ? 'bg-accent text-white border-accent' : ''}`}
            >
              {fmtMB(v)}
            </button>
          ))}
        </div>

        {/* preview de uso */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-mute">{t('ram.currentUsage', { v: fmtMB(memUsed) })}</span>
            <span className="text-mute">{t('ram.pctOfNew', { p: value ? ((memUsed / value) * 100).toFixed(0) : 0 })}</span>
          </div>
          <div className="h-2 bg-border rounded-full overflow-hidden">
            <div
              className={`h-full ${wouldExceedUsage ? 'bg-danger' : (memUsed / value) > 0.85 ? 'bg-warn' : 'bg-success'}`}
              style={{ width: Math.min(100, (memUsed / value) * 100) + '%' }}
            />
          </div>
        </div>

        {wouldExceedUsage && (
          <div className="flex items-start gap-2 p-3 bg-danger/10 border border-danger/30 rounded-lg text-xs text-danger">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <div>{t('ram.warnUsing', { v: fmtMB(memUsed) })}</div>
          </div>
        )}
        {wouldExceedPlan && (
          <div className="flex items-start gap-2 p-3 bg-danger/10 border border-danger/30 rounded-lg text-xs text-danger">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <div>{t('ram.warnExceedPlan', { v: fmtMB(Math.max(0, planTotal - otherAllocated)) })}</div>
          </div>
        )}

        {err && <div className="text-danger text-xs">{err}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <button className="btn" onClick={onClose} disabled={saving}>{t('ram.cancel')}</button>
          <button className="btn-primary" onClick={save} disabled={saving || value === current || blockSave}>
            {saving ? t('ram.saving') : t('ram.apply')}
          </button>
        </div>
      </div>
    </div>
  );
}
