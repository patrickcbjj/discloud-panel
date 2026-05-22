import React, { useEffect, useState } from 'react';
import { RefreshCw, Settings as SettingsIcon, Cloud, AlertTriangle, Gem } from 'lucide-react';
import { fmtTime } from '../format.js';
import { planStyle, userAvatarURL, userName, userPlan } from '../plans.js';
import Avatar from './Avatar.jsx';
import { useT } from '../i18n.js';

function StatusDot({ status, latencyMs, t }) {
  const isOnline = status === 'online';
  const isOffline = status === 'offline';
  const color = isOnline ? 'bg-success' : isOffline ? 'bg-danger' : 'bg-mute';
  const label = isOnline
    ? t('titleBar.statusOnline')
    : isOffline
      ? t('titleBar.statusOffline')
      : t('titleBar.statusChecking');
  const title = isOnline && latencyMs != null
    ? `${label} · ${t('titleBar.statusLatency', { n: latencyMs })}`
    : label;
  return (
    <span className="flex items-center gap-1.5 shrink-0" title={title}>
      <span className="relative flex h-2 w-2">
        {(isOnline || isOffline) && (
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${color}`} />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${color}`} />
      </span>
    </span>
  );
}

export default function TitleBar({ user, lastTickAt, error, polling = false, onRefresh, onOpenSettings, settingsOpen }) {
  const t = useT();
  const name = userName(user);
  const plan = userPlan(user);
  const ps = planStyle(plan);
  const avatarUrl = userAvatarURL(user);

  const [svc, setSvc] = useState({ status: 'unknown', latencyMs: null });

  useEffect(() => {
    let alive = true;
    window.api.discloud.serviceStatus().then((s) => { if (alive && s) setSvc(s); });
    const off = window.api.onDiscloudStatus((s) => { if (alive) setSvc(s); });
    return () => { alive = false; off && off(); };
  }, []);

  return (
    <div className="titlebar-drag h-9 flex items-center justify-between border-b border-border bg-panel pl-3 pr-[150px] text-xs">
      <div className="flex items-center gap-2 text-mute min-w-0">
        <Cloud size={14} className="text-accent shrink-0" />
        <span className="font-semibold text-text shrink-0">Discloud Panel</span>
        {name && (
          <>
            <span className="text-border shrink-0">·</span>
            <div className="titlebar-nodrag flex items-center gap-1.5 shrink-0">
              <Avatar name={name} url={avatarUrl} size={18} />
              <span className="text-text">{name}</span>
            </div>
          </>
        )}
        {ps && (
          <>
            <span className="text-border shrink-0">·</span>
            <span className="flex items-center gap-1 shrink-0" title={`${t('titleBar.planLabel')} ${ps.label}`}>
              <Gem size={11} style={{ color: ps.color }} />
              <span>{ps.label}</span>
            </span>
          </>
        )}
      </div>
      <div className="titlebar-nodrag flex items-center gap-2">
        {error && (
          <span className="chip bg-danger/15 text-danger" title={error}>
            <AlertTriangle size={11} /> {t('titleBar.errorChip')}
          </span>
        )}
        {lastTickAt && (
          <span className="text-mute hidden sm:inline">{t('titleBar.updatedAt')} {fmtTime(lastTickAt)}</span>
        )}
        <StatusDot status={svc.status} latencyMs={svc.latencyMs} t={t} />
        <button className="btn !py-1 !px-2" onClick={onRefresh} title={polling ? t('titleBar.refreshing') : t('titleBar.refreshTitle')}>
          <RefreshCw size={13} className={polling ? 'animate-spin text-accent' : ''} />
        </button>
        <button
          className={`btn !py-1 !px-2 ${settingsOpen ? 'bg-border' : ''}`}
          onClick={onOpenSettings}
          title={t('common.settings')}
        >
          <SettingsIcon size={13} />
        </button>
      </div>
    </div>
  );
}
