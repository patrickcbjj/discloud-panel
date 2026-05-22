import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Search, ArrowUpDown, X, LayoutDashboard, Users } from 'lucide-react';
import { fmtMB, fmtPct, appTypeLabel } from '../format.js';
import Avatar from './Avatar.jsx';
import { useT } from '../i18n.js';

function memPctOf(a) {
  if (!a.memory_max) return 0;
  return (a.memory_mb / a.memory_max) * 100;
}

function compare(a, b, key) {
  switch (key) {
    case 'name':
      return (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' });
    case 'ram':
      return memPctOf(b) - memPctOf(a);
    case 'cpu':
      return (b.cpu || 0) - (a.cpu || 0);
    case 'uptime':
      return (b.uptime_ms || 0) - (a.uptime_ms || 0);
    case 'status':
    default:
      // online primeiro, depois por nome
      if (a.running !== b.running) return b.running - a.running;
      return (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' });
  }
}

function renderAppCard(a, selected, onSelect) {
  const active = a.id === selected;
  const memPct = memPctOf(a);
  const typeLbl = appTypeLabel(a.type);
  const label = a.label;
  return (
    <button
      key={a.id}
      onClick={() => onSelect(a.id)}
      className={`w-full text-left px-3 py-2 mx-2 rounded-lg mb-1 transition-colors ${
        active ? 'bg-accent/15 border border-accent/30' : 'hover:bg-panel2 border border-transparent'
      }`}
    >
      <div className="flex items-center gap-2">
        <div className="relative">
          <Avatar name={a.name} url={a.avatarURL} size={28} />
          <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-panel ${a.running ? 'bg-success' : 'bg-danger'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm flex items-center gap-1.5 min-w-0">
            <span className="truncate">{a.name}</span>
            {typeLbl && (
              <span className="chip bg-panel2 text-mute text-[9px] py-0 px-1.5 shrink-0 uppercase border border-border">
                {typeLbl}
              </span>
            )}
            {a.team && (
              <span className="chip bg-accent/15 text-accent text-[9px] py-0 px-1.5 shrink-0">team</span>
            )}
          </div>
          {label && (
            <div className="text-[10px] text-accent2 truncate mt-0.5">{label}</div>
          )}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-3 text-[11px] text-mute">
        <span className="flex items-center gap-1"><Activity size={10} />{fmtPct(a.cpu)}</span>
        <span>{fmtMB(a.memory_mb)}{a.memory_max ? ` / ${fmtMB(a.memory_max)}` : ''}</span>
      </div>
      {memPct > 0 && (
        <div className="mt-1.5 h-1 bg-border rounded-full overflow-hidden">
          <div
            className={`h-full ${memPct > 85 ? 'bg-danger' : memPct > 60 ? 'bg-warn' : 'bg-success'}`}
            style={{ width: Math.min(100, memPct) + '%' }}
          />
        </div>
      )}
    </button>
  );
}

export default function Sidebar({ apps, selected, onSelect, overviewActive, onOpenOverview }) {
  const t = useT();
  const SORTS = [
    { key: 'status', label: t('sidebar.sortStatus') },
    { key: 'name',   label: t('sidebar.sortName') },
    { key: 'ram',    label: t('sidebar.sortRam') },
    { key: 'cpu',    label: t('sidebar.sortCpu') },
    { key: 'uptime', label: t('sidebar.sortUptime') }
  ];
  const FILTERS = [
    { key: 'all',     label: t('common.all') },
    { key: 'online',  label: t('common.online') },
    { key: 'offline', label: t('common.offline') }
  ];
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('status');
  const [filter, setFilter] = useState('all');
  const [tab, setTab] = useState('own'); // 'own' | 'team'

  // restaurar preferências
  useEffect(() => {
    (async () => {
      const s = await window.api.config.get('sidebarSort');
      const f = await window.api.config.get('sidebarFilter');
      const t = await window.api.config.get('sidebarTab');
      if (s) setSort(s);
      if (f) setFilter(f);
      if (t === 'own' || t === 'team') setTab(t);
    })();
  }, []);

  const saveSort = (k) => { setSort(k); window.api.config.set('sidebarSort', k); };
  const saveFilter = (k) => { setFilter(k); window.api.config.set('sidebarFilter', k); };
  const saveTab = (k) => { setTab(k); window.api.config.set('sidebarTab', k); };

  const { ownVisible, teamVisible, ownTotal, teamTotal } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const passFilter = (a) => {
      if (filter === 'online' && !a.running) return false;
      if (filter === 'offline' && a.running) return false;
      if (q) {
        const hay = (a.name + ' ' + a.id + ' ' + (a.type || '')).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    };
    const own = apps.filter((a) => !a.team);
    const team = apps.filter((a) => a.team);
    return {
      ownVisible: own.filter(passFilter).sort((a, b) => compare(a, b, sort)),
      teamVisible: team.filter(passFilter).sort((a, b) => compare(a, b, sort)),
      ownTotal: own.length,
      teamTotal: team.length
    };
  }, [apps, query, sort, filter]);

  const activeList = tab === 'team' ? teamVisible : ownVisible;
  const activeTotal = tab === 'team' ? teamTotal : ownTotal;
  const running = (tab === 'team' ? apps.filter((a) => a.team) : apps.filter((a) => !a.team))
    .filter((a) => a.running).length;

  return (
    <aside className="w-72 shrink-0 border-r border-border bg-panel flex flex-col">
      <div className="px-3 pt-3 pb-2">
        <button
          onClick={onOpenOverview}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            overviewActive
              ? 'bg-accent text-white'
              : 'bg-panel2 hover:bg-border text-text'
          }`}
        >
          <LayoutDashboard size={14} />
          <span className="flex-1 text-left">{t('sidebar.overview')}</span>
          <span className={`text-[10px] ${overviewActive ? 'text-white/70' : 'text-mute'}`}>
            {apps.length} {t('sidebar.apps')}
          </span>
        </button>
      </div>

      <div className="px-4 py-3 border-y border-border space-y-2">
        <div className="flex items-baseline justify-between">
          <div className="text-xs text-mute uppercase tracking-wider">
            {tab === 'team' ? t('sidebar.team') : t('sidebar.myApps')}
          </div>
          <div className="text-xs">
            <span className="text-success font-semibold">{running}</span>
            <span className="text-mute"> / {activeTotal} {t('common.online').toLowerCase()}</span>
          </div>
        </div>

        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mute" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('common.search')}
            className="selectable w-full bg-panel2 border border-border rounded-lg pl-7 pr-7 py-1 text-xs focus:outline-none focus:border-accent"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-mute hover:text-text"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <ArrowUpDown size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-mute pointer-events-none" />
            <select
              value={sort}
              onChange={(e) => saveSort(e.target.value)}
              className="appearance-none w-full bg-panel2 border border-border rounded-lg pl-6 pr-2 py-1 text-[11px] focus:outline-none focus:border-accent cursor-pointer"
              title={t('sidebar.sortBy')}
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="flex bg-panel2 border border-border rounded-lg overflow-hidden">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => saveFilter(f.key)}
                className={`px-2 py-1 text-[10px] transition-colors ${
                  filter === f.key ? 'bg-accent text-white' : 'text-mute hover:text-text'
                }`}
                title={f.label}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex bg-panel2 border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => saveTab('own')}
            className={`flex-1 px-2 py-1.5 text-[11px] font-medium transition-colors ${
              tab === 'own' ? 'bg-accent text-white' : 'text-mute hover:text-text'
            }`}
          >
            {t('sidebar.myApps')} <span className="opacity-70">({ownTotal})</span>
          </button>
          <button
            onClick={() => saveTab('team')}
            className={`flex-1 px-2 py-1.5 text-[11px] font-medium transition-colors flex items-center justify-center gap-1 ${
              tab === 'team' ? 'bg-accent text-white' : 'text-mute hover:text-text'
            }`}
          >
            <Users size={11} />
            {t('sidebar.team')} <span className="opacity-70">({teamTotal})</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {activeList.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-mute">
            {activeTotal === 0
              ? (tab === 'team' ? t('sidebar.noTeamApps') : t('sidebar.noApps'))
              : query.trim() || filter !== 'all'
                ? t('sidebar.noMatch')
                : t('sidebar.noApps')}
          </div>
        ) : (
          activeList.map((a) => renderAppCard(a, selected, onSelect))
        )}
      </div>

      {activeTotal > 0 && (query.trim() || filter !== 'all') && (
        <div className="px-4 py-2 border-t border-border text-[10px] text-mute">
          {t('sidebar.showing')} {activeList.length} / {activeTotal}
        </div>
      )}
    </aside>
  );
}
