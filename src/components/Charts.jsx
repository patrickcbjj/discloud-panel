import React, { useMemo } from 'react';
import {
  ResponsiveContainer, LineChart, Line, AreaChart, Area, XAxis, YAxis,
  Tooltip, CartesianGrid, ReferenceLine
} from 'recharts';
import { useThemeColors } from '../theme.js';

function fmtAxisTime(ts) {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function restartLines(restarts, danger) {
  if (!restarts?.length) return null;
  return restarts.map((r) => (
    <ReferenceLine
      key={r.ts}
      x={r.ts}
      stroke={danger}
      strokeDasharray="3 3"
      strokeWidth={1.5}
      ifOverflow="extendDomain"
      label={{ value: '↻', position: 'top', fill: danger, fontSize: 11 }}
    />
  ));
}

export default function Charts({ history, restarts = [] }) {
  const c = useThemeColors();
  const tooltipStyle = {
    backgroundColor: c.panel2,
    border: `1px solid ${c.border}`,
    borderRadius: 8,
    fontSize: 12,
    color: c.text
  };

  const data = useMemo(() => {
    return history.map((row, i) => {
      const prev = history[i - 1];
      let downRate = null, upRate = null;
      if (prev) {
        const dt = (row.ts - prev.ts) / 1000;
        if (dt > 0) {
          if (row.net_down != null && prev.net_down != null && row.net_down >= prev.net_down) {
            downRate = (row.net_down - prev.net_down) / dt;
          }
          if (row.net_up != null && prev.net_up != null && row.net_up >= prev.net_up) {
            upRate = (row.net_up - prev.net_up) / dt;
          }
        }
      }
      return {
        ts: row.ts,
        cpu: row.cpu,
        mem: row.memory_mb,
        memMax: row.memory_max,
        downRate: downRate != null ? downRate / 1024 : null,
        upRate: upRate != null ? upRate / 1024 : null
      };
    });
  }, [history]);

  return (
    <div className="grid grid-cols-2 gap-3">
      <ChartCard title="CPU (%)" color={c.accent}>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="cpu" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c.accent} stopOpacity={0.4} />
                <stop offset="100%" stopColor={c.accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={c.border} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="ts" tickFormatter={fmtAxisTime} stroke={c.mute} fontSize={10} />
            <YAxis stroke={c.mute} fontSize={10} domain={[0, (max) => Math.max(10, max)]} />
            <Tooltip contentStyle={tooltipStyle} labelFormatter={fmtAxisTime}
              formatter={(v) => (v == null ? '—' : v.toFixed(1) + '%')} />
            <Area type="monotone" dataKey="cpu" stroke={c.accent} fill="url(#cpu)" strokeWidth={2} />
            {restartLines(restarts, c.danger)}
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Memória (MB)" color={c.accent2}>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="mem" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c.accent2} stopOpacity={0.4} />
                <stop offset="100%" stopColor={c.accent2} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={c.border} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="ts" tickFormatter={fmtAxisTime} stroke={c.mute} fontSize={10} />
            <YAxis stroke={c.mute} fontSize={10} />
            <Tooltip contentStyle={tooltipStyle} labelFormatter={fmtAxisTime}
              formatter={(v) => (v == null ? '—' : v.toFixed(0) + ' MB')} />
            <Area type="monotone" dataKey="mem" stroke={c.accent2} fill="url(#mem)" strokeWidth={2} />
            {restartLines(restarts, c.danger)}
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Rede ↓ (KB/s)" color={c.success}>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data}>
            <CartesianGrid stroke={c.border} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="ts" tickFormatter={fmtAxisTime} stroke={c.mute} fontSize={10} />
            <YAxis stroke={c.mute} fontSize={10} />
            <Tooltip contentStyle={tooltipStyle} labelFormatter={fmtAxisTime}
              formatter={(v) => (v == null ? '—' : v.toFixed(2) + ' KB/s')} />
            <Line type="monotone" dataKey="downRate" stroke={c.success} strokeWidth={2} dot={false} />
            {restartLines(restarts, c.danger)}
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Rede ↑ (KB/s)" color={c.warn}>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data}>
            <CartesianGrid stroke={c.border} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="ts" tickFormatter={fmtAxisTime} stroke={c.mute} fontSize={10} />
            <YAxis stroke={c.mute} fontSize={10} />
            <Tooltip contentStyle={tooltipStyle} labelFormatter={fmtAxisTime}
              formatter={(v) => (v == null ? '—' : v.toFixed(2) + ' KB/s')} />
            <Line type="monotone" dataKey="upRate" stroke={c.warn} strokeWidth={2} dot={false} />
            {restartLines(restarts, c.danger)}
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, color, children }) {
  return (
    <div className="bg-panel2 border border-border rounded-lg p-3">
      <div className="text-xs text-mute mb-1 flex items-center gap-2">
        <span className="dot" style={{ background: color }} />
        {title}
      </div>
      {children}
    </div>
  );
}
