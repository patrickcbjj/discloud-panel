import React, { useEffect, useState } from 'react';
import { Save, Trash2, Power, Bell, Archive, FolderOpen, Play, RefreshCw, CheckCircle2, AlertTriangle, FileDown, Sun, Moon, Palette, Github, Languages } from 'lucide-react';
import { useI18n, getDays } from '../i18n.js';


function fmtBytes(n) {
  if (!n) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0; let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

function fmtWhen(ts) {
  return new Date(ts).toLocaleString('pt-BR');
}

function Toggle({ checked, onChange, label, hint }) {
  const toggle = () => onChange(!checked);
  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={toggle}
        className={`relative mt-0.5 inline-flex w-10 h-6 rounded-full shrink-0 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
          checked ? 'bg-accent' : 'bg-border'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
      <div onClick={toggle} className="flex-1 cursor-pointer select-none">
        <div className="text-sm leading-snug">{label}</div>
        {hint && <div className="text-xs text-mute mt-0.5 leading-snug">{hint}</div>}
      </div>
    </div>
  );
}

export default function Settings({ apps = [] }) {
  const { t, locale, setLocale } = useI18n();
  const DAYS = getDays(locale);
  const [token, setToken] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [githubTokenSaved, setGithubTokenSaved] = useState(false);
  const [interval, setInterval] = useState(30);
  const [retention, setRetention] = useState(30);
  const [minimizeToTray, setMinimizeToTray] = useState(true);
  const [autoStart, setAutoStart] = useState(false);
  const [startMinimized, setStartMinimized] = useState(false);
  const [alertOffline, setAlertOffline] = useState(true);
  const [alertRestart, setAlertRestart] = useState(true);
  const [alertHighRam, setAlertHighRam] = useState(true);
  const [alertHighCpu, setAlertHighCpu] = useState(true);
  const [alertApiError, setAlertApiError] = useState(true);
  const [alertAnomaly, setAlertAnomaly] = useState(true);
  const [ramThreshold, setRamThreshold] = useState(90);
  const [cpuThreshold, setCpuThreshold] = useState(80);
  const [msg, setMsg] = useState(null);

  // Tema
  const [theme, setTheme] = useState('dark');

  // Export
  const [exportFormat, setExportFormat] = useState('csv');
  const [exportRange, setExportRange] = useState('7d');
  const [exportAppId, setExportAppId] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState(null);

  // Backup automático
  const [backupEnabled, setBackupEnabled] = useState(false);
  const [backupDay, setBackupDay] = useState(2);
  const [backupHour, setBackupHour] = useState(3);
  const [backupMinute, setBackupMinute] = useState(0);
  const [backupRetention, setBackupRetention] = useState(4);
  const [backupFolder, setBackupFolder] = useState('');
  const [backupRunning, setBackupRunning] = useState(false);
  const [backupHistory, setBackupHistory] = useState([]);
  const [backupMsg, setBackupMsg] = useState(null);

  useEffect(() => {
    (async () => {
      const t = await window.api.config.get('apiToken');
      const i = await window.api.config.get('pollInterval');
      const r = await window.api.config.get('retentionDays');
      const mt = await window.api.config.get('minimizeToTray');
      const as = await window.api.config.get('autoStart');
      const sm = await window.api.config.get('startMinimized');
      if (t) setToken(t);
      if (i) setInterval(Number(i));
      if (r) setRetention(Number(r));
      setMinimizeToTray(mt === undefined ? true : !!mt);
      setAutoStart(!!as);
      setStartMinimized(!!sm);

      const get = async (k, def) => {
        const v = await window.api.config.get(k);
        return v === undefined || v === null ? def : v;
      };
      setAlertOffline(await get('alertOffline', true));
      setAlertRestart(await get('alertRestart', true));
      setAlertHighRam(await get('alertHighRam', true));
      setAlertHighCpu(await get('alertHighCpu', true));
      setAlertApiError(await get('alertApiError', true));
      setAlertAnomaly(await get('alertAnomaly', true));
      setRamThreshold(Number(await get('ramThreshold', 90)));
      setCpuThreshold(Number(await get('cpuThreshold', 80)));

      setBackupEnabled(!!(await get('backupEnabled', false)));
      setBackupDay(Number(await get('backupDay', 2)));
      setBackupHour(Number(await get('backupHour', 3)));
      setBackupMinute(Number(await get('backupMinute', 0)));
      setBackupRetention(Number(await get('backupRetention', 4)));
      setBackupFolder(await window.api.backup.getFolder());
      setBackupRunning(await window.api.backup.isRunning());
      setBackupHistory(await window.api.backup.history());

      const th = await get('theme', 'dark');
      setTheme(th === 'light' ? 'light' : 'dark');

      const gh = await get('githubToken', '');
      setGithubToken(gh || '');
    })();

    const off = window.api.onBackupFinished(async () => {
      setBackupRunning(false);
      setBackupHistory(await window.api.backup.history());
    });
    return off;
  }, []);

  const save = async () => {
    await window.api.config.set('apiToken', token.trim());
    await window.api.config.set('pollInterval', Number(interval));
    await window.api.config.set('retentionDays', Number(retention));
    setMsg(t('settings.savedMsg'));
    setTimeout(() => setMsg(null), 2000);
  };

  const purge = async () => {
    const cutoff = Date.now() - Number(retention) * 86400 * 1000;
    const n = await window.api.db.purgeOlderThan(cutoff);
    setMsg(t('settings.purged', { n }));
    setTimeout(() => setMsg(null), 3000);
  };

  const setToggle = async (key, value, setter) => {
    setter(value);
    await window.api.config.set(key, value);
  };

  const setBackupField = async (key, value, setter) => {
    setter(value);
    await window.api.config.set(key, value);
  };

  const chooseFolder = async () => {
    const f = await window.api.backup.chooseFolder();
    if (f) setBackupFolder(f);
  };

  const saveGithubToken = async () => {
    await window.api.config.set('githubToken', githubToken.trim());
    setGithubTokenSaved(true);
    setTimeout(() => setGithubTokenSaved(false), 2000);
  };

  const applyTheme = async (t) => {
    setTheme(t);
    document.documentElement.dataset.theme = t;
    await window.api.config.set('theme', t);
    window.api.window?.setTheme?.(t);
  };

  const runExport = async () => {
    setExporting(true);
    setExportMsg(null);
    try {
      const rangeMs = {
        '24h': 24 * 3600 * 1000,
        '7d':  7 * 24 * 3600 * 1000,
        '30d': 30 * 24 * 3600 * 1000,
        'all': null
      }[exportRange];
      const sinceMs = rangeMs == null ? 0 : Date.now() - rangeMs;
      const appNameById = Object.fromEntries(apps.map((a) => [a.id, a.name]));
      const res = await window.api.export.run({
        format: exportFormat,
        sinceMs,
        appId: exportAppId || null,
        appNameById
      });
      if (res?.canceled) setExportMsg(t('settings.exportCanceled'));
      else if (res?.error) setExportMsg(`${t('common.error')}: ${res.error}`);
      else setExportMsg(t('settings.exportSuccess', { n: res.rows, p: res.filePath }));
    } catch (e) {
      setExportMsg(`${t('common.error')}: ${e.message}`);
    } finally {
      setExporting(false);
      setTimeout(() => setExportMsg(null), 8000);
    }
  };

  const runBackupNow = async () => {
    setBackupRunning(true);
    setBackupMsg(t('settings.backupRunning'));
    try {
      const res = await window.api.backup.runNow();
      if (res?.error) {
        setBackupMsg(t('settings.backupFail', { e: res.error }));
      } else if (res) {
        setBackupMsg(t('settings.backupDone', { ok: res.ok, fail: res.fail }));
      }
      setBackupHistory(await window.api.backup.history());
    } catch (e) {
      setBackupMsg(`${t('common.error')}: ${e.message}`);
    } finally {
      setBackupRunning(false);
      setTimeout(() => setBackupMsg(null), 6000);
    }
  };

  return (
    <div className="p-6 max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">{t('settings.title')}</h1>

      <div className="card p-5 space-y-4">
        <h2 className="text-xs uppercase text-mute tracking-wider flex items-center gap-2">
          <Palette size={12} /> {t('settings.appearance')}
        </h2>
        <div>
          <label className="text-xs uppercase text-mute tracking-wider">{t('settings.theme')}</label>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => applyTheme('dark')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                theme === 'dark' ? 'bg-accent/15 border-accent text-accent' : 'bg-panel2 border-border hover:bg-border'
              }`}
            >
              <Moon size={14} /> {t('settings.dark')}
            </button>
            <button
              onClick={() => applyTheme('light')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                theme === 'light' ? 'bg-accent/15 border-accent text-accent' : 'bg-panel2 border-border hover:bg-border'
              }`}
            >
              <Sun size={14} /> {t('settings.light')}
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs uppercase text-mute tracking-wider flex items-center gap-1"><Languages size={11} /> {t('settings.language')}</label>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => setLocale('pt')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                locale === 'pt' ? 'bg-accent/15 border-accent text-accent' : 'bg-panel2 border-border hover:bg-border'
              }`}
            >
              🇧🇷 Português (BR)
            </button>
            <button
              onClick={() => setLocale('en')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                locale === 'en' ? 'bg-accent/15 border-accent text-accent' : 'bg-panel2 border-border hover:bg-border'
              }`}
            >
              🇺🇸 English
            </button>
          </div>
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <h2 className="text-xs uppercase text-mute tracking-wider">{t('settings.account')}</h2>
        <div>
          <label className="text-xs uppercase text-mute tracking-wider">{t('settings.apiToken')}</label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="selectable w-full mt-1 bg-panel2 border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <h2 className="text-xs uppercase text-mute tracking-wider flex items-center gap-2">
          <Github size={12} /> GitHub
        </h2>
        <div>
          <label className="text-xs uppercase text-mute tracking-wider">{t('settings.githubPat')}</label>
          <input
            type="password"
            value={githubToken}
            onChange={(e) => setGithubToken(e.target.value)}
            placeholder="ghp_…"
            className="selectable w-full mt-1 bg-panel2 border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-accent"
          />
          <p className="text-xs text-mute mt-1">
            {t('settings.githubHint')}{' '}
            <button
              type="button"
              onClick={() => window.api.openExternal('https://github.com/settings/personal-access-tokens/new')}
              className="text-accent hover:underline"
            >
              github.com/settings/personal-access-tokens
            </button>
            {' '}{t('settings.githubScope')} <code className="bg-panel2 px-1 rounded">Contents: read</code>.
          </p>
        </div>
        <button className="btn-primary" onClick={saveGithubToken}>
          {githubTokenSaved ? <CheckCircle2 size={13} className="inline mr-1" /> : <Save size={13} className="inline mr-1" />}
          {githubTokenSaved ? t('common.saved') : t('settings.saveToken')}
        </button>
      </div>

      <div className="card p-5 space-y-4">
        <h2 className="text-xs uppercase text-mute tracking-wider">{t('settings.pollingHistory')}</h2>
        <div>
          <label className="text-xs uppercase text-mute tracking-wider">{t('settings.intervalSec')}</label>
          <input
            type="number" min={15} max={600}
            value={interval}
            onChange={(e) => setInterval(e.target.value)}
            className="selectable w-32 mt-1 bg-panel2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
          />
          <p className="text-xs text-mute mt-1">{t('settings.intervalHint')}</p>
        </div>

        <div>
          <label className="text-xs uppercase text-mute tracking-wider">{t('settings.retentionDays')}</label>
          <input
            type="number" min={1} max={365}
            value={retention}
            onChange={(e) => setRetention(e.target.value)}
            className="selectable w-32 mt-1 bg-panel2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
          />
        </div>

        <div className="flex items-center gap-2">
          <button className="btn-primary" onClick={save}>
            <Save size={13} className="inline mr-1" /> {t('common.save')}
          </button>
          <button className="btn-danger" onClick={purge}>
            <Trash2 size={13} className="inline mr-1" /> {t('settings.purgeOld')}
          </button>
          {msg && <span className="text-xs text-success ml-2">{msg}</span>}
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <h2 className="text-xs uppercase text-mute tracking-wider">{t('settings.windowInit')}</h2>
        <Toggle
          checked={minimizeToTray}
          onChange={(v) => setToggle('minimizeToTray', v, setMinimizeToTray)}
          label={t('settings.minimizeTray')}
          hint={t('settings.minimizeTrayHint')}
        />
        <Toggle
          checked={autoStart}
          onChange={(v) => setToggle('autoStart', v, setAutoStart)}
          label={t('settings.autoStart')}
          hint={t('settings.autoStartHint')}
        />
        <Toggle
          checked={startMinimized}
          onChange={(v) => setToggle('startMinimized', v, setStartMinimized)}
          label={t('settings.startMin')}
          hint={t('settings.startMinHint')}
        />

        <div className="border-t border-border pt-3">
          <button
            className="btn-danger"
            onClick={() => window.api.app.quit()}
          >
            <Power size={13} className="inline mr-1" /> {t('settings.quit')}
          </button>
          <p className="text-xs text-mute mt-2">
            {t('settings.quitHint')}
          </p>
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <h2 className="text-xs uppercase text-mute tracking-wider flex items-center gap-2">
          <Bell size={12} /> {t('settings.notifications')}
        </h2>
        <Toggle
          checked={alertOffline}
          onChange={(v) => setToggle('alertOffline', v, setAlertOffline)}
          label={t('settings.alertOffline')}
          hint={t('settings.alertOfflineHint')}
        />
        <Toggle
          checked={alertRestart}
          onChange={(v) => setToggle('alertRestart', v, setAlertRestart)}
          label={t('settings.alertRestart')}
          hint={t('settings.alertRestartHint')}
        />
        <Toggle
          checked={alertHighRam}
          onChange={(v) => setToggle('alertHighRam', v, setAlertHighRam)}
          label={t('settings.alertHighRam', { n: ramThreshold })}
          hint={t('settings.alertRamHint')}
        />
        <Toggle
          checked={alertHighCpu}
          onChange={(v) => setToggle('alertHighCpu', v, setAlertHighCpu)}
          label={t('settings.alertHighCpu', { n: cpuThreshold })}
          hint={t('settings.alertCpuHint')}
        />
        <Toggle
          checked={alertApiError}
          onChange={(v) => setToggle('alertApiError', v, setAlertApiError)}
          label={t('settings.alertApiError')}
          hint={t('settings.alertApiHint')}
        />
        <Toggle
          checked={alertAnomaly}
          onChange={(v) => setToggle('alertAnomaly', v, setAlertAnomaly)}
          label={t('settings.alertAnomaly')}
          hint={t('settings.alertAnomalyHint')}
        />

        <div className="grid grid-cols-2 gap-3 pt-2">
          <div>
            <label className="text-xs uppercase text-mute tracking-wider">{t('settings.ramLimit')}</label>
            <input
              type="number" min={50} max={100}
              value={ramThreshold}
              onChange={(e) => { setRamThreshold(Number(e.target.value)); window.api.config.set('ramThreshold', Number(e.target.value)); }}
              className="selectable w-full mt-1 bg-panel2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="text-xs uppercase text-mute tracking-wider">{t('settings.cpuLimit')}</label>
            <input
              type="number" min={30} max={100}
              value={cpuThreshold}
              onChange={(e) => { setCpuThreshold(Number(e.target.value)); window.api.config.set('cpuThreshold', Number(e.target.value)); }}
              className="selectable w-full mt-1 bg-panel2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
            />
          </div>
        </div>
        <p className="text-xs text-mute">{t('settings.cooldownHint')}</p>
      </div>

      <div className="card p-5 space-y-4">
        <h2 className="text-xs uppercase text-mute tracking-wider flex items-center gap-2">
          <FileDown size={12} /> {t('settings.exportTitle')}
        </h2>
        <p className="text-xs text-mute -mt-2">
          {t('settings.exportHint')}
        </p>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs uppercase text-mute tracking-wider">{t('settings.format')}</label>
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
              className="w-full mt-1 bg-panel2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
            >
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
          </div>
          <div>
            <label className="text-xs uppercase text-mute tracking-wider">{t('settings.period')}</label>
            <select
              value={exportRange}
              onChange={(e) => setExportRange(e.target.value)}
              className="w-full mt-1 bg-panel2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
            >
              <option value="24h">{t('settings.last24h')}</option>
              <option value="7d">{t('settings.last7d')}</option>
              <option value="30d">{t('settings.last30d')}</option>
              <option value="all">{t('settings.allTime')}</option>
            </select>
          </div>
          <div>
            <label className="text-xs uppercase text-mute tracking-wider">{t('settings.appLabel')}</label>
            <select
              value={exportAppId}
              onChange={(e) => setExportAppId(e.target.value)}
              className="w-full mt-1 bg-panel2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
            >
              <option value="">{t('common.all')}</option>
              {apps.map((a) => (
                <option key={a.id} value={a.id}>{a.name}{a.team ? ' (team)' : ''}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="btn-primary" onClick={runExport} disabled={exporting}>
            {exporting
              ? <RefreshCw size={13} className="inline mr-1 animate-spin" />
              : <FileDown size={13} className="inline mr-1" />}
            {exporting ? t('settings.exporting') : t('settings.exportBtn')}
          </button>
          {exportMsg && <span className="text-xs text-mute">{exportMsg}</span>}
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <h2 className="text-xs uppercase text-mute tracking-wider flex items-center gap-2">
          <Archive size={12} /> {t('settings.backupTitle')}
        </h2>

        <Toggle
          checked={backupEnabled}
          onChange={(v) => setBackupField('backupEnabled', v, setBackupEnabled)}
          label={t('settings.backupEnable')}
          hint={t('settings.backupEnableHint')}
        />

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs uppercase text-mute tracking-wider">{t('settings.dayOfWeek')}</label>
            <select
              value={backupDay}
              onChange={(e) => setBackupField('backupDay', Number(e.target.value), setBackupDay)}
              disabled={!backupEnabled}
              className="w-full mt-1 bg-panel2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent disabled:opacity-50"
            >
              {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs uppercase text-mute tracking-wider">{t('settings.hour')}</label>
            <input
              type="number" min={0} max={23}
              value={backupHour}
              onChange={(e) => setBackupField('backupHour', Math.max(0, Math.min(23, Number(e.target.value) || 0)), setBackupHour)}
              disabled={!backupEnabled}
              className="selectable w-full mt-1 bg-panel2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent disabled:opacity-50"
            />
          </div>
          <div>
            <label className="text-xs uppercase text-mute tracking-wider">{t('settings.minute')}</label>
            <input
              type="number" min={0} max={59}
              value={backupMinute}
              onChange={(e) => setBackupField('backupMinute', Math.max(0, Math.min(59, Number(e.target.value) || 0)), setBackupMinute)}
              disabled={!backupEnabled}
              className="selectable w-full mt-1 bg-panel2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent disabled:opacity-50"
            />
          </div>
        </div>

        <div>
          <label className="text-xs uppercase text-mute tracking-wider">{t('settings.backupFolder')}</label>
          <div className="flex gap-2 mt-1">
            <input
              type="text"
              value={backupFolder || ''}
              readOnly
              className="selectable flex-1 bg-panel2 border border-border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-accent"
            />
            <button className="btn" onClick={chooseFolder}>{t('settings.choose')}</button>
            <button className="btn" onClick={() => window.api.backup.openFolder()} title="Abrir pasta no Explorer">
              <FolderOpen size={13} />
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs uppercase text-mute tracking-wider">{t('settings.keepLastN')}</label>
          <input
            type="number" min={1} max={50}
            value={backupRetention}
            onChange={(e) => setBackupField('backupRetention', Math.max(1, Math.min(50, Number(e.target.value) || 1)), setBackupRetention)}
            className="selectable w-32 mt-1 bg-panel2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
          />
          <p className="text-xs text-mute mt-1">{t('settings.keepLastNHint')}</p>
        </div>

        <div className="flex items-center gap-2 border-t border-border pt-3">
          <button className="btn-primary" onClick={runBackupNow} disabled={backupRunning}>
            {backupRunning ? <RefreshCw size={13} className="inline mr-1 animate-spin" /> : <Play size={13} className="inline mr-1" />}
            {backupRunning ? t('settings.running') : t('settings.runNow')}
          </button>
          {backupMsg && <span className="text-xs text-mute">{backupMsg}</span>}
        </div>

        {backupHistory.length > 0 && (
          <details className="border-t border-border pt-3">
            <summary className="cursor-pointer text-xs uppercase text-mute tracking-wider">
              {t('settings.history')} ({backupHistory.length})
            </summary>
            <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
              {backupHistory.map((h, idx) => (
                <div key={idx} className="bg-panel2 border border-border rounded-lg p-3 text-xs">
                  <div className="flex items-center gap-2">
                    {h.error || h.fail > 0
                      ? <AlertTriangle size={12} className="text-warn" />
                      : <CheckCircle2 size={12} className="text-success" />}
                    <span className="font-medium">{fmtWhen(h.ts)}</span>
                    <span className="text-mute">·</span>
                    <span className="text-mute">{h.trigger === 'auto' ? t('settings.backupHistAuto') : t('settings.backupHistManual')}</span>
                    <span className="text-mute ml-auto">{t('settings.backupHistDuration', { s: (h.durationMs / 1000).toFixed(1) })}</span>
                  </div>
                  <div className="mt-1 text-mute">
                    {h.error
                      ? <span className="text-danger">{h.error}</span>
                      : <span>{t('settings.backupHistResult', { ok: h.ok, fail: h.fail, rm: h.removed ? t('settings.backupHistRm', { n: h.removed }) : '' })}</span>}
                  </div>
                  {h.items?.some((i) => !i.ok) && (
                    <div className="mt-1 text-danger/80">
                      {t('settings.backupHistFails')} {h.items.filter((i) => !i.ok).map((i) => i.name || i.id).join(', ')}
                    </div>
                  )}
                  {h.items?.length > 0 && (
                    <div className="text-mute mt-1">
                      {t('settings.backupHistTotal')} {fmtBytes(h.items.reduce((s, i) => s + (i.size || 0), 0))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
