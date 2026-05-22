import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import AppDetail from './components/AppDetail.jsx';
import TokenGate from './components/TokenGate.jsx';
import TitleBar from './components/TitleBar.jsx';
import Settings from './components/Settings.jsx';
import Overview from './components/Overview.jsx';
import { useT } from './i18n.js';

export default function App() {
  const t = useT();
  const [hasToken, setHasToken] = useState(null);
  const [snapshots, setSnapshots] = useState([]); // último tick
  const [appsMeta, setAppsMeta] = useState([]);   // raw apps da API
  const [selected, setSelected] = useState(null);
  const [lastTickAt, setLastTickAt] = useState(null);
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const [polling, setPolling] = useState(false);
  const [notes, setNotes] = useState({});
  const [view, setView] = useState('overview'); // overview | dashboard | settings

  useEffect(() => {
    window.api.config.hasToken().then(setHasToken);
    // aplica tema salvo (dark padrão)
    (async () => {
      const t = await window.api.config.get('theme');
      const theme = t === 'light' ? 'light' : 'dark';
      document.documentElement.dataset.theme = theme;
      window.api.window?.setTheme?.(theme);
    })();
  }, []);

  useEffect(() => {
    if (!hasToken) return;
    let dead = false;
    (async () => {
      try { const u = await window.api.discloud.user(); if (!dead) setUser(u); } catch {}
    })();
    window.api.notes.getAll().then(setNotes).catch(() => {});
    const offNotes = window.api.onNotesChanged(setNotes);
    const offTick = window.api.onTickStart(() => setPolling(true));
    const offSnap = window.api.onSnapshot(({ ts, rows, apps }) => {
      setSnapshots(rows);
      setAppsMeta(apps);
      setLastTickAt(ts);
      setError(null);
      setPolling(false);
    });
    const offErr = window.api.onPollError((e) => { setError(e.message); setPolling(false); });
    const offFocus = window.api.onFocusApp((appId) => {
      setView('dashboard');
      setSelected(appId);
    });
    window.api.poller.tickNow();
    return () => { dead = true; offNotes(); offTick(); offSnap(); offErr(); offFocus(); };
  }, [hasToken]);

  const apps = useMemo(() => {
    return snapshots.map((s) => {
      const raw = appsMeta.find(
        (a) => String(a.id ?? a.appId ?? a._id) === s.app_id
      ) || {};
      const n = notes[s.app_id];
      return {
        id: s.app_id,
        name: raw.name || raw.id || s.app_id,
        avatarURL: raw.avatarURL || raw.avatar || null,
        type: raw.type,
        language: raw.language || raw.lang || null,
        cluster: raw.cluster || null,
        autoDeployGit: raw.autoDeployGit || null,
        syncGit: raw.syncGit || null,
        ramKilled: raw.ramKilled === true,
        exitCode: typeof raw.exitCode === 'number' ? raw.exitCode : null,
        addedAtTimestamp: typeof raw.addedAtTimestamp === 'number' ? raw.addedAtTimestamp : null,
        autoRestart: raw.autoRestart === true,
        team: !!raw.team,
        mods: Array.isArray(raw.mods) ? raw.mods : [],
        apts: Array.isArray(raw.apts) ? raw.apts : [],
        label: n?.label || null,
        note: n?.note || null,
        ...s,
        raw
      };
    });
  }, [snapshots, appsMeta, notes]);

  const current = apps.find((a) => a.id === selected) || null;

  if (hasToken === null) {
    return <div className="h-full flex items-center justify-center text-mute">{t('common.loading')}</div>;
  }

  if (!hasToken) {
    return <TokenGate onSaved={() => setHasToken(true)} />;
  }

  return (
    <div className="h-full flex flex-col bg-bg">
      <TitleBar
        user={user}
        lastTickAt={lastTickAt}
        error={error}
        polling={polling}
        onRefresh={() => window.api.poller.tickNow()}
        onOpenSettings={() => setView(view === 'settings' ? 'dashboard' : 'settings')}
        settingsOpen={view === 'settings'}
      />
      <div className="flex-1 flex min-h-0">
        <Sidebar
          apps={apps}
          selected={view === 'dashboard' ? selected : null}
          onSelect={(id) => { setSelected(id); setView('dashboard'); }}
          overviewActive={view === 'overview'}
          onOpenOverview={() => setView('overview')}
        />
        <main className="flex-1 min-w-0 overflow-y-auto">
          {view === 'settings' ? (
            <Settings apps={apps} onChanged={() => {}} />
          ) : view === 'overview' ? (
            <Overview
              apps={apps}
              user={user}
              onSelectApp={(id) => { setSelected(id); setView('dashboard'); }}
            />
          ) : current ? (
            <AppDetail app={current} apps={apps} user={user} />
          ) : (
            <div className="h-full flex items-center justify-center text-mute">
              {apps.length === 0 ? t('sidebar.noApps') : t('appDetail.selectApp')}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
