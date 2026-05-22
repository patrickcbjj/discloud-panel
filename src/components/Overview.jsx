import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';
import {
  Boxes, Cpu, MemoryStick, HardDrive, ArrowDownUp, Activity, Trophy
} from 'lucide-react';
import Avatar from './Avatar.jsx';
import { fmtMB, fmtPct, fmtBytes } from '../format.js';
import { useThemeColors } from '../theme.js';
import { useT } from '../i18n.js';

function detectPlanRam(user, override) {
  if (override) return Number(override);
  if (!user) return null;
  const u = user.user || user;
  const candidates = [
    u.ramQuantity, u.ramMB, u.ram, u.totalRamMb, u.totalRam,
    u.plan?.ramQuantity, u.plan?.ram, u.plan?.totalRam
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

function KPI({ icon: Icon, label, value, sub, accent = 'accent' }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-mute text-xs">
        <Icon size={14} className={`text-${accent}`} />
        <span className="uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {sub && <div className="text-xs text-mute mt-1">{sub}</div>}
    </div>
  );
}

function fmtAxisTime(ts) {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function Overview({ apps: allApps, user, onSelectApp }) {
  const apps = useMemo(() => allApps.filter((a) => !a.team), [allApps]);
  const c = useThemeColors();
  const t = useT();
  const tooltipStyle = {
    backgroundColor: c.panel2,
    border: `1px solid ${c.border}`,
    borderRadius: 8,
    fontSize: 12,
    color: c.text
  };
  const [planOverride, setPlanOverride] = useState(null);
  const [aggregateHistory, setAggregateHistory] = useState([]);
  const [windowMs, setWindowMs] = useState(6 * 3600 * 1000);

  useEffect(() => {
    window.api.config.get('planTotalRam').then((v) => v && setPlanOverride(Number(v)));
  }, []);

  // agregar histórico de todos os apps (RAM total e CPU média ao longo do tempo)
  useEffect(() => {
    let dead = false;
    (async () => {
      const since = Date.now() - windowMs;
      const allRows = await Promise.all(
        apps.map((a) => window.api.db.history(a.id, since))
      );
      if (dead) return;

      // bucketize por timestamp (resolução: a cada 60s)
      const bucketMs = Math.max(60_000, Math.floor(windowMs / 200));
      const buckets = new Map(); // bucketTs -> {memSum, cpuSum, cpuCount, count}

      for (const rows of allRows) {
        for (const r of rows) {
          const b = Math.floor(r.ts / bucketMs) * bucketMs;
          if (!buckets.has(b)) buckets.set(b, { memSum: 0, cpuSum: 0, cpuCount: 0, count: 0 });
          const obj = buckets.get(b);
          if (r.memory_mb != null) obj.memSum += r.memory_mb;
          if (r.cpu != null) { obj.cpuSum += r.cpu; obj.cpuCount++; }
          obj.count++;
        }
      }

      const series = Array.from(buckets.entries())
        .sort(([a], [b]) => a - b)
        .map(([ts, v]) => ({
          ts,
          memTotal: v.memSum,
          cpuAvg: v.cpuCount ? v.cpuSum / v.cpuCount : null
        }));

      setAggregateHistory(series);
    })();
    return () => { dead = true; };
  }, [apps, windowMs]);

  const stats = useMemo(() => {
    const total = apps.length;
    const online = apps.filter((a) => a.running).length;
    const offline = total - online;
    const ramAllocated = apps.reduce((s, a) => s + (a.memory_max || 0), 0);
    const ramUsed = apps.reduce((s, a) => s + (a.memory_mb || 0), 0);
    const cpuTotal = apps.reduce((s, a) => s + (a.cpu || 0), 0);
    const cpuAvg = total ? cpuTotal / total : 0;
    const ssdTotal = apps.reduce((s, a) => s + (a.ssd_mb || 0), 0);
    const netDown = apps.reduce((s, a) => s + (a.net_down || 0), 0);
    const netUp = apps.reduce((s, a) => s + (a.net_up || 0), 0);
    return { total, online, offline, ramAllocated, ramUsed, cpuTotal, cpuAvg, ssdTotal, netDown, netUp };
  }, [apps]);

  const planTotal = detectPlanRam(user, planOverride);

  const topRam = [...apps]
    .sort((a, b) => (b.memory_mb || 0) - (a.memory_mb || 0))
    .slice(0, 5);
  const topCpu = [...apps]
    .filter((a) => (a.cpu || 0) > 0)
    .sort((a, b) => (b.cpu || 0) - (a.cpu || 0))
    .slice(0, 5);
  const topTraffic = [...apps]
    .map((a) => ({ ...a, _net: (a.net_down || 0) + (a.net_up || 0) }))
    .sort((a, b) => b._net - a._net)
    .slice(0, 5);

  // alocação de RAM por app (pra barras horizontais)
  const ramAllocation = [...apps]
    .filter((a) => a.memory_max)
    .sort((a, b) => (b.memory_max || 0) - (a.memory_max || 0));

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">{t('overview.title')}</h1>
        <p className="text-xs text-mute mt-1">{t('overview.subtitle')}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        <KPI
          icon={Boxes} label={t('overview.kpiApps')} accent="accent"
          value={`${stats.online} / ${stats.total}`}
          sub={stats.offline ? t('overview.offlineCount', { n: stats.offline }) : t('overview.allOnline')}
        />
        <KPI
          icon={MemoryStick} label={t('overview.kpiRam')} accent="accent2"
          value={fmtMB(stats.ramUsed)}
          sub={t('overview.allocOf', { v: fmtMB(stats.ramAllocated) })}
        />
        <KPI
          icon={Cpu} label={t('overview.kpiCpu')} accent="warn"
          value={fmtPct(stats.cpuAvg)}
          sub={t('overview.totalSum', { v: fmtPct(stats.cpuTotal) })}
        />
        <KPI
          icon={HardDrive} label={t('overview.kpiSsd')} accent="success"
          value={fmtMB(stats.ssdTotal)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <KPI
          icon={ArrowDownUp} label={t('overview.kpiTraffic')} accent="success"
          value={fmtBytes(stats.netDown + stats.netUp)}
          sub={`↓ ${fmtBytes(stats.netDown)} · ↑ ${fmtBytes(stats.netUp)}`}
        />
        <KPI
          icon={Activity} label={t('overview.kpiPlanAlloc')} accent="accent"
          value={planTotal ? `${((stats.ramAllocated / planTotal) * 100).toFixed(0)}%` : '—'}
          sub={planTotal
            ? `${fmtMB(stats.ramAllocated)} / ${fmtMB(planTotal)} (${t('overview.freeRam', { v: fmtMB(planTotal - stats.ramAllocated) })})`
            : t('overview.definePlan')}
        />
      </div>

      {/* Gráfico agregado */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">{t('overview.ramOverTime')}</h2>
          <div className="flex gap-1">
            {[
              [1 * 3600 * 1000, '1h'],
              [6 * 3600 * 1000, '6h'],
              [24 * 3600 * 1000, '24h'],
              [7 * 24 * 3600 * 1000, '7d']
            ].map(([ms, label]) => (
              <button
                key={label}
                onClick={() => setWindowMs(ms)}
                className={`px-2 py-1 rounded text-xs ${
                  windowMs === ms ? 'bg-accent text-white' : 'bg-panel2 text-mute hover:text-text'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={aggregateHistory}>
            <defs>
              <linearGradient id="memTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c.accent2} stopOpacity={0.4} />
                <stop offset="100%" stopColor={c.accent2} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={c.border} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="ts" tickFormatter={fmtAxisTime} stroke={c.mute} fontSize={10} />
            <YAxis stroke={c.mute} fontSize={10} tickFormatter={(v) => `${(v / 1024).toFixed(1)}G`} />
            <Tooltip
              contentStyle={tooltipStyle}
              labelFormatter={fmtAxisTime}
              formatter={(v) => (v == null ? '—' : `${Math.round(v)} MB`)}
            />
            <Area type="monotone" dataKey="memTotal" stroke={c.accent2} fill="url(#memTotal)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
        {aggregateHistory.length < 2 && (
          <div className="text-xs text-mute text-center mt-2">
            {t('overview.collecting')}
          </div>
        )}
      </div>

      {/* Alocação de RAM por app (barras horizontais) */}
      <div className="card p-4">
        <h2 className="text-sm font-semibold mb-3">{t('overview.ramByApp')}</h2>
        <div className="space-y-2">
          {ramAllocation.map((a) => {
            const pct = planTotal ? (a.memory_max / planTotal) * 100 : 0;
            const usePct = a.memory_max ? (a.memory_mb / a.memory_max) * 100 : 0;
            return (
              <button
                key={a.id}
                onClick={() => onSelectApp?.(a.id)}
                className="w-full flex items-center gap-3 text-left hover:bg-panel2 rounded-lg p-2 transition-colors"
              >
                <Avatar name={a.name} url={a.avatarURL} size={24} />
                <div className="w-32 truncate text-sm">{a.name}</div>
                <div className="flex-1 h-5 bg-border rounded overflow-hidden relative">
                  <div
                    className="h-full bg-accent/30"
                    style={{ width: planTotal ? `${pct}%` : '100%' }}
                    title={`alocado: ${fmtMB(a.memory_max)}`}
                  />
                  <div
                    className={`h-full absolute top-0 left-0 ${usePct > 85 ? 'bg-danger' : usePct > 60 ? 'bg-warn' : 'bg-success'}`}
                    style={{
                      width: planTotal
                        ? `${(a.memory_mb / planTotal) * 100}%`
                        : `${usePct}%`
                    }}
                    title={`em uso: ${fmtMB(a.memory_mb)}`}
                  />
                </div>
                <div className="w-32 text-right text-xs text-mute font-mono">
                  {fmtMB(a.memory_mb)} / {fmtMB(a.memory_max)}
                </div>
              </button>
            );
          })}
          {ramAllocation.length === 0 && (
            <div className="text-xs text-mute text-center py-4">{t('overview.noAllocData')}</div>
          )}
        </div>
        {planTotal && (
          <div className="text-[10px] text-mute mt-3 flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-2 bg-accent/30 rounded" /> alocado
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-2 bg-success rounded" /> em uso
            </span>
            <span className="ml-auto">total do plano: {fmtMB(planTotal)}</span>
          </div>
        )}
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-3 gap-3">
        <RankingCard title={t('overview.topRam')} icon={MemoryStick} apps={topRam}
          getValue={(a) => fmtMB(a.memory_mb)}
          getSub={(a) => a.memory_max ? fmtPct((a.memory_mb / a.memory_max) * 100) : ''}
          onSelectApp={onSelectApp} />
        <RankingCard title={t('overview.topCpu')} icon={Cpu} apps={topCpu}
          getValue={(a) => fmtPct(a.cpu)}
          onSelectApp={onSelectApp} />
        <RankingCard title={t('overview.topTraffic')} icon={ArrowDownUp} apps={topTraffic}
          getValue={(a) => fmtBytes(a._net)}
          getSub={(a) => `↓${fmtBytes(a.net_down)} · ↑${fmtBytes(a.net_up)}`}
          onSelectApp={onSelectApp} />
      </div>
    </div>
  );
}

function RankingCard({ title, icon: Icon, apps, getValue, getSub, onSelectApp }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Trophy size={14} className="text-warn" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-mute">{title}</h3>
      </div>
      <div className="space-y-2">
        {apps.length === 0 && (
          <div className="text-xs text-mute text-center py-4">Sem dados</div>
        )}
        {apps.map((a, i) => (
          <button
            key={a.id}
            onClick={() => onSelectApp?.(a.id)}
            className="w-full flex items-center gap-2 hover:bg-panel2 rounded-lg p-1.5 -mx-1.5 transition-colors text-left"
          >
            <span className="text-mute font-mono text-xs w-4">{i + 1}</span>
            <Avatar name={a.name} url={a.avatarURL} size={22} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm">{a.name}</div>
              {getSub && <div className="text-[10px] text-mute">{getSub(a)}</div>}
            </div>
            <div className="text-sm font-semibold shrink-0">{getValue(a)}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
