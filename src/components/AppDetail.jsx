import React, { useEffect, useState } from 'react';
import { Play, Square, RotateCw, Download, Terminal, HardDrive, Cpu, MemoryStick, ArrowDownUp, Upload, FileArchive, Users, Tag, NotebookPen, Check, History, CheckCircle2, XCircle, AlertOctagon, RefreshCw as RefreshIcon, CalendarDays, ScrollText } from 'lucide-react';
import Charts from './Charts.jsx';
import LogsModal from './LogsModal.jsx';
import RamModal from './RamModal.jsx';
import DeployModal from './DeployModal.jsx';
import Avatar from './Avatar.jsx';
import GithubCard from './GithubCard.jsx';
import EnvEditor from './EnvEditor.jsx';
import FileExplorer from './FileExplorer.jsx';
import BuildLogModal from './BuildLogModal.jsx';
import HealthChip from './HealthChip.jsx';
import { fmtUptimePct } from '../health.js';
import { Settings2 } from 'lucide-react';
import { fmtMB, fmtPct, fmtBytes, fmtUptime, fmtRelativePast, describeExitCode } from '../format.js';
import { useT, useI18n } from '../i18n.js';

// Mapeia ação UI -> permissões aceitas pela API Discloud (nomes podem variar)
const PERM_ALIASES = {
  start:   ['start_app', 'start'],
  stop:    ['stop_app', 'stop'],
  restart: ['restart_app', 'restart', 'start_app'],
  logs:    ['logs_app', 'logs', 'view_logs', 'read_logs'],
  backup:  ['backup_app', 'backup'],
  commit:  ['commit_app', 'commit', 'deploy'],
  ram:     ['edit_ram_memory', 'edit_ram', 'ram']
};

function can(app, action) {
  if (!app.team) return true;
  const mods = app.mods || [];
  if (mods.length === 0) return true; // se a API não trouxe perms, deixa a própria API decidir
  const aliases = PERM_ALIASES[action] || [action];
  return aliases.some((p) => mods.includes(p));
}

// resolve qual endpoint usar (próprio vs team) p/ uma ação
function endpointFor(app, action) {
  if (!app.team) return window.api.discloud[action];
  const key = 'team' + action.charAt(0).toUpperCase() + action.slice(1);
  return window.api.discloud[key];
}

function Stat({ icon: Icon, label, value, sub }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-mute text-xs">
        <Icon size={14} />
        <span className="uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {sub && <div className="text-xs text-mute mt-1">{sub}</div>}
    </div>
  );
}

export default function AppDetail({ app, apps = [], user = null }) {
  const t = useT();
  const { locale } = useI18n();
  const [history, setHistory] = useState([]);
  const [restarts, setRestarts] = useState([]);
  const [deploys, setDeploys] = useState([]);
  const [windowMs, setWindowMs] = useState(6 * 3600 * 1000);
  const [busy, setBusy] = useState(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [ramOpen, setRamOpen] = useState(false);
  const [deployFile, setDeployFile] = useState(null);
  const [draggingOver, setDraggingOver] = useState(false);
  const [buildLogDeploy, setBuildLogDeploy] = useState(null);
  const [slaWindows, setSlaWindows] = useState({ d1: null, d7: null, d30: null });
  const [toast, setToast] = useState(null);
  const [labelDraft, setLabelDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [notesSavedAt, setNotesSavedAt] = useState(0);

  useEffect(() => {
    setLabelDraft(app.label || '');
    setNoteDraft(app.note || '');
  }, [app.id, app.label, app.note]);

  const saveNotes = async () => {
    await window.api.notes.set(app.id, { label: labelDraft.trim(), note: noteDraft });
    setNotesSavedAt(Date.now());
    setTimeout(() => setNotesSavedAt(0), 2000);
  };

  useEffect(() => {
    let dead = false;
    (async () => {
      const since = Date.now() - windowMs;
      const [rows, rests, deps] = await Promise.all([
        window.api.db.history(app.id, since),
        window.api.db.restarts(app.id, since),
        window.api.db.deploys(app.id, 20)
      ]);
      if (!dead) {
        setHistory(rows);
        setRestarts(rests);
        setDeploys(deps);
      }
    })();
    return () => { dead = true; };
  }, [app.id, windowMs, app.ts]);

  // SLA com 3 janelas (24h, 7d, 30d). Re-fetch a cada minuto.
  useEffect(() => {
    let dead = false;
    const fetchAll = async () => {
      const now = Date.now();
      const windows = {
        d1: now - 24 * 3600 * 1000,
        d7: now - 7 * 24 * 3600 * 1000,
        d30: now - 30 * 24 * 3600 * 1000
      };
      try {
        const [d1, d7, d30] = await Promise.all([
          window.api.db.slaStats(windows.d1, app.id),
          window.api.db.slaStats(windows.d7, app.id),
          window.api.db.slaStats(windows.d30, app.id)
        ]);
        if (!dead) setSlaWindows({
          d1: d1[app.id] || null,
          d7: d7[app.id] || null,
          d30: d30[app.id] || null
        });
      } catch {}
    };
    fetchAll();
    const tt = setInterval(fetchAll, 60_000);
    return () => { dead = true; clearInterval(tt); };
  }, [app.id, app.ts]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const doAction = async (kind) => {
    setBusy(kind);
    try {
      const fn = endpointFor(app, kind);
      const res = await fn(app.id);
      showToast(res?.message || `${kind} ok`);
      setTimeout(() => window.api.poller.tickNow(), 1500);
    } catch (e) {
      showToast('Erro: ' + e.message);
    } finally {
      setBusy(null);
    }
  };

  const openZipPicker = async () => {
    const file = await window.api.dialog.openZip();
    if (file) setDeployFile(file);
  };

  const onDragOver = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) setDraggingOver(true);
  };
  const onDragLeave = (e) => {
    e.preventDefault(); e.stopPropagation();
    // só fecha se sair do container principal
    if (e.currentTarget === e.target) setDraggingOver(false);
  };
  const onDrop = async (e) => {
    e.preventDefault(); e.stopPropagation();
    setDraggingOver(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (!files.length) return;
    const f = files[0];
    // em Electron, File.path expõe o caminho real no disco
    if (f.path) {
      const info = await window.api.fs.statFile(f.path);
      if (info) setDeployFile(info);
      else showToast('Não consegui ler o arquivo.');
    } else {
      showToast('Arraste o arquivo direto da pasta do Windows.');
    }
  };

  const doBackup = async () => {
    setBusy('backup');
    try {
      const res = await endpointFor(app, 'backup')(app.id);
      const url = res?.backups?.url || res?.url;
      if (url) {
        window.api.openExternal(url);
        showToast('Backup aberto no navegador');
      } else {
        showToast('Backup sem URL na resposta');
      }
    } catch (e) {
      showToast('Erro: ' + e.message);
    } finally {
      setBusy(null);
    }
  };

  const memPct = app.memory_max ? (app.memory_mb / app.memory_max) * 100 : null;

  return (
    <div
      className="p-6 space-y-4 relative"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex items-center gap-4">
          <div className="relative shrink-0">
            <Avatar name={app.name} url={app.avatarURL} size={56} />
            <span className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-[3px] border-bg ${app.running ? 'bg-success' : 'bg-danger'}`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold truncate">{app.name}</h1>
              {app.id !== app.name && (
                <span className="chip bg-panel2 text-mute font-mono">{app.id}</span>
              )}
              {app._health && app._health.score != null && (
                <HealthChip health={app._health} variant="normal" />
              )}
              {app.type && <span className="chip bg-accent/15 text-accent">{app.type}</span>}
              {app.team && (
                <span className="chip bg-accent/15 text-accent flex items-center gap-1" title={app.raw?.ownerID ? `dono: ${app.raw.ownerID}` : 'app de equipe'}>
                  <Users size={11} /> team
                </span>
              )}
              {app.label && (
                <span className="chip bg-accent2/15 text-accent2 flex items-center gap-1">
                  <Tag size={11} /> {app.label}
                </span>
              )}
              {app.raw?.mainFile && (
                <span className="chip bg-panel2 text-mute font-mono">{app.raw.mainFile}</span>
              )}
              {app.autoRestart && (
                <span
                  className="chip bg-accent/15 text-accent flex items-center gap-1"
                  title={t('appDetail.autoRestartHint')}
                >
                  <RefreshIcon size={11} /> {t('appDetail.autoRestartOn')}
                </span>
              )}
              {app.ramKilled && (
                <span
                  className="chip bg-danger/15 text-danger flex items-center gap-1 font-bold uppercase border border-danger/30 animate-pulse"
                  title={t('appDetail.oomTitle')}
                >
                  <AlertOctagon size={11} /> {t('appDetail.oomBadge')}
                </span>
              )}
              {(() => {
                const ec = describeExitCode(app.exitCode, t);
                if (!ec) return null;
                const cls = ec.tone === 'ok'
                  ? 'bg-success/15 text-success'
                  : ec.tone === 'oom'
                    ? 'bg-danger/15 text-danger border border-danger/30'
                    : 'bg-warn/15 text-warn';
                return (
                  <span className={`chip flex items-center gap-1 ${cls}`} title={`${t('appDetail.exitCode')}: ${app.exitCode}`}>
                    {t('appDetail.exitCode')} {app.exitCode}
                    <span className="opacity-70">· {ec.label}</span>
                  </span>
                );
              })()}
            </div>
            <div className="text-xs text-mute mt-1 flex items-center gap-2 flex-wrap">
              <span>
                {t('appDetail.uptime')}: {fmtUptime(app.uptime_ms)}
                {app.raw?.startedAt && ` · ${t('appDetail.startedAt')} ${new Date(app.raw.startedAt).toLocaleString()}`}
              </span>
              {app.addedAtTimestamp && (
                <span className="flex items-center gap-1" title={new Date(app.addedAtTimestamp).toLocaleString()}>
                  <span className="text-border">·</span>
                  <CalendarDays size={11} />
                  {t('appDetail.createdAt')} {new Date(app.addedAtTimestamp).toLocaleDateString(locale === 'en' ? 'en-US' : 'pt-BR')}
                  {' '}
                  <span className="opacity-70">({t('appDetail.createdRel', { v: fmtRelativePast(app.addedAtTimestamp, locale) })})</span>
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {app.running ? (
            can(app, 'stop') && (
              <button className="btn-danger" disabled={busy} onClick={() => doAction('stop')}>
                <Square size={13} className="inline mr-1" /> {t('appDetail.stop')}
              </button>
            )
          ) : (
            can(app, 'start') && (
              <button className="btn-primary" disabled={busy} onClick={() => doAction('start')}>
                <Play size={13} className="inline mr-1" /> {t('appDetail.start')}
              </button>
            )
          )}
          {can(app, 'restart') && (
            <button className="btn" disabled={busy} onClick={() => doAction('restart')}>
              <RotateCw size={13} className="inline mr-1" /> {t('appDetail.restart')}
            </button>
          )}
          {can(app, 'logs') && (
            <button className="btn" disabled={busy} onClick={() => setLogsOpen(true)}>
              <Terminal size={13} className="inline mr-1" /> {t('appDetail.logs')}
            </button>
          )}
          {can(app, 'backup') && (
            <button className="btn" disabled={busy} onClick={doBackup}>
              <Download size={13} className="inline mr-1" /> {t('appDetail.backup')}
            </button>
          )}
          {can(app, 'commit') && (
            <button className="btn" disabled={busy} onClick={openZipPicker} title=".zip">
              <Upload size={13} className="inline mr-1" /> {t('appDetail.deploy')}
            </button>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-3">
        <Stat icon={Cpu} label={t('appDetail.cpu')} value={fmtPct(app.cpu)} />
        {can(app, 'ram') ? (
          <button
            onClick={() => setRamOpen(true)}
            className="card p-4 text-left hover:border-accent/50 transition-colors group relative"
            title={t('appDetail.ramChange')}
          >
            <div className="flex items-center gap-2 text-mute text-xs">
              <MemoryStick size={14} />
              <span className="uppercase tracking-wider">{t('appDetail.memory')}</span>
              <Settings2 size={11} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="mt-2 text-2xl font-semibold">{fmtMB(app.memory_mb)}</div>
            {app.memory_max && (
              <div className="text-xs text-mute mt-1">
                {fmtPct(memPct)} de {fmtMB(app.memory_max)}
              </div>
            )}
          </button>
        ) : (
          <Stat
            icon={MemoryStick}
            label={t('appDetail.memory')}
            value={fmtMB(app.memory_mb)}
            sub={app.memory_max ? `${fmtPct(memPct)} de ${fmtMB(app.memory_max)}` : null}
          />
        )}
        <Stat icon={HardDrive} label={t('appDetail.ssd')} value={fmtMB(app.ssd_mb)} />
        <Stat
          icon={ArrowDownUp}
          label={t('appDetail.network')}
          value={fmtBytes((app.net_down || 0) + (app.net_up || 0))}
          sub={`↓ ${fmtBytes(app.net_down)} · ↑ ${fmtBytes(app.net_up)}`}
        />
      </div>

      {/* Charts */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">{t('appDetail.history')}</h2>
            {restarts.length > 0 && (
              <span className="chip bg-danger/15 text-danger text-[10px]" title={t('appDetail.restartTitle')}>
                ↻ {restarts.length} {restarts.length > 1 ? t('appDetail.restartsP') : t('appDetail.restarts')}
              </span>
            )}
          </div>
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
        <Charts history={history} restarts={restarts} />
        {history.length < 2 && (
          <div className="mt-3 text-xs text-mute text-center">
            {t('appDetail.collectingData')}
          </div>
        )}
      </div>

      {/* Notas/label */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <NotebookPen size={14} className="text-mute" />
          {t('appDetail.notesTitle')}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs uppercase text-mute tracking-wider">{t('appDetail.notesLabel')}</label>
            <input
              type="text"
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              placeholder={t('appDetail.notesLabelPh')}
              maxLength={32}
              className="selectable w-full mt-1 bg-panel2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs uppercase text-mute tracking-wider">{t('appDetail.notesText')}</label>
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              rows={2}
              placeholder={t('appDetail.notesTextPh')}
              className="selectable w-full mt-1 bg-panel2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent resize-none"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-primary" onClick={saveNotes}>
            {notesSavedAt ? <Check size={13} className="inline mr-1" /> : null}
            {notesSavedAt ? t('common.saved') : t('appDetail.saveNotes')}
          </button>
          <span className="text-xs text-mute">{t('appDetail.notesHint')}</span>
        </div>
      </div>

      {/* GitHub */}
      <GithubCard app={app} />

      {/* Variáveis de ambiente */}
      <EnvEditor app={app} filename=".env" title="Variáveis de ambiente" />

      {/* discloud.config */}
      <details className="card p-0">
        <summary className="cursor-pointer p-4 text-sm font-semibold text-mute">
          Editar discloud.config
        </summary>
        <div className="px-4 pb-4">
          <EnvEditor app={app} filename="discloud.config" title="discloud.config" />
        </div>
      </details>

      {/* File explorer */}
      <details className="card p-0">
        <summary className="cursor-pointer p-4 text-sm font-semibold text-mute">
          Arquivos & Console
        </summary>
        <div className="px-4 pb-4">
          <FileExplorer app={app} />
        </div>
      </details>

      {/* SLA / disponibilidade */}
      <div className="card p-4">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Activity size={14} className="text-mute" />
            {t('settings.slaTitle')}
          </h3>
          <span className="text-[10px] text-mute">{t('settings.slaSubtitle')}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { key: 'd1',  label: t('settings.slaLast24h'),  stats: slaWindows.d1 },
            { key: 'd7',  label: t('settings.slaLast7d'),   stats: slaWindows.d7 },
            { key: 'd30', label: t('settings.slaLast30d'),  stats: slaWindows.d30 }
          ].map(({ key, label, stats }) => {
            const pct = stats?.uptimePct;
            const samples = stats?.samples || 0;
            const insufficient = samples < 10;
            const tone =
              pct == null || insufficient ? 'text-mute' :
              pct >= 99 ? 'text-success' :
              pct >= 90 ? 'text-accent' :
              pct >= 70 ? 'text-warn' :
                          'text-danger';
            return (
              <div key={key} className="bg-panel2 border border-border rounded-lg p-3 flex flex-col">
                <div className="text-[10px] text-mute uppercase tracking-wider">{label}</div>
                <div className={`text-2xl font-semibold mt-1 font-mono ${tone}`}>
                  {insufficient ? '—' : fmtUptimePct(pct)}
                </div>
                <div className="text-[10px] text-mute mt-1">
                  {insufficient
                    ? t('settings.slaInsufficient')
                    : t('settings.slaSamples', { n: samples.toLocaleString() })}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-mute mt-2 italic">{t('settings.slaCaveat')}</p>
      </div>

      {/* Histórico de deploys */}
      {deploys.length > 0 && (
        <details className="card p-4">
          <summary className="cursor-pointer text-sm font-semibold flex items-center gap-2">
            <History size={14} className="text-mute" />
            {t('appDetail.deployHistory')}
            <span className="text-xs text-mute font-normal ml-1">({deploys.length})</span>
          </summary>
          <div className="mt-3 space-y-1.5 max-h-72 overflow-y-auto">
            {deploys.map((d) => (
              <div key={d.ts} className="flex items-center gap-2 text-xs bg-panel2 border border-border rounded-lg px-3 py-2">
                {d.success
                  ? <CheckCircle2 size={13} className="text-success shrink-0" />
                  : <XCircle size={13} className="text-danger shrink-0" />}
                <span className="font-medium shrink-0">{new Date(d.ts).toLocaleString('pt-BR')}</span>
                {d.file_name && (
                  <span className="text-mute truncate" title={d.file_name}>{d.file_name}</span>
                )}
                <div className="ml-auto flex items-center gap-2 shrink-0">
                  {d.file_size != null && (
                    <span className="text-mute">{fmtBytes(d.file_size)}</span>
                  )}
                  {d.has_log === 1 && (
                    <button
                      onClick={() => setBuildLogDeploy(d)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-accent/15 text-accent hover:bg-accent/25 transition-colors text-[10px] font-medium"
                      title={t('settings.buildLogView')}
                    >
                      <ScrollText size={10} />
                      log
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Moderadores compartilhados */}
      {app.mods && app.mods.length > 0 && (
        <details className="card p-4" open>
          <summary className="cursor-pointer text-sm font-semibold flex items-center gap-2">
            <Users size={14} className="text-mute" />
            {t('appDetail.modsTitle')}
            <span className="ml-2 chip bg-panel2 text-mute text-[10px] py-0 px-1.5">
              {t('appDetail.modsCount', { n: app.mods.length })}
            </span>
          </summary>
          <div className="mt-3 flex flex-wrap gap-2">
            {app.mods.map((m, i) => {
              const display = typeof m === 'string' ? m : (m?.id || m?.userID || m?.name || JSON.stringify(m));
              return (
                <span
                  key={i}
                  className="flex items-center gap-2 bg-panel2 border border-border rounded-full pl-1 pr-3 py-1"
                  title={display}
                >
                  <Avatar name={display} size={20} />
                  <span className="text-xs font-mono truncate max-w-[180px]">{display}</span>
                </span>
              );
            })}
          </div>
        </details>
      )}

      {/* Pacotes APT instalados no container */}
      {app.apts && app.apts.length > 0 && (
        <details className="card p-4">
          <summary className="cursor-pointer text-sm font-semibold flex items-center gap-2">
            <FileArchive size={14} className="text-mute" />
            {t('appDetail.aptsTitle')}
            <span className="ml-2 chip bg-panel2 text-mute text-[10px] py-0 px-1.5">
              {t('appDetail.aptsCount', { n: app.apts.length })}
            </span>
          </summary>
          <div className="mt-3 space-y-2">
            <p className="text-xs text-mute">{t('appDetail.aptsHint')}</p>
            <div className="flex flex-wrap gap-1.5">
              {app.apts.map((pkg, i) => (
                <code
                  key={i}
                  className="text-[11px] font-mono bg-panel2 border border-border rounded px-2 py-0.5 text-text"
                >
                  {String(pkg)}
                </code>
              ))}
            </div>
          </div>
        </details>
      )}

      {/* Raw */}
      <details className="card p-4">
        <summary className="cursor-pointer text-sm font-semibold text-mute">{t('appDetail.rawApi')}</summary>
        <pre className="selectable mt-3 text-xs text-mute overflow-x-auto font-mono">
{JSON.stringify(app.raw, null, 2)}
        </pre>
      </details>

      {logsOpen && <LogsModal appId={app.id} team={app.team} onClose={() => setLogsOpen(false)} />}
      {ramOpen && (
        <RamModal
          app={app}
          apps={apps}
          user={user}
          onClose={() => setRamOpen(false)}
          onSaved={(msg) => showToast(msg)}
        />
      )}
      {deployFile && (
        <DeployModal
          app={app}
          file={deployFile}
          onClose={() => setDeployFile(null)}
          onDeployed={(msg) => showToast(msg)}
        />
      )}
      {buildLogDeploy && (
        <BuildLogModal
          appId={app.id}
          deploy={buildLogDeploy}
          onClose={() => setBuildLogDeploy(null)}
        />
      )}

      {/* drop overlay */}
      {draggingOver && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-accent/20 backdrop-blur-sm border-4 border-dashed border-accent pointer-events-none">
          <div className="bg-panel border border-accent rounded-2xl p-8 text-center shadow-2xl">
            <FileArchive size={48} className="text-accent mx-auto mb-3" />
            <div className="text-xl font-semibold">{t('appDetail.dragDrop')}</div>
            <div className="text-sm text-mute mt-1">{t('appDetail.sentTo')} <strong>{app.name}</strong></div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-panel2 border border-border rounded-lg px-4 py-2 text-sm shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
