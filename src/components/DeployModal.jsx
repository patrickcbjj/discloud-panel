import React, { useEffect, useRef, useState } from 'react';
import { X, Upload, AlertTriangle, FileArchive, CheckCircle2, Terminal as TerminalIcon, Loader2 } from 'lucide-react';
import { fmtBytes } from '../format.js';
import { useT } from '../i18n.js';

const LEVEL_RE = /\b(ERROR|ERR|FATAL|WARN(ING)?|INFO|DEBUG|TRACE)\b/i;
const LEVEL_COLORS = {
  ERROR: 'text-danger', ERR: 'text-danger', FATAL: 'text-danger font-semibold',
  WARN: 'text-warn', WARNING: 'text-warn',
  INFO: 'text-accent', DEBUG: 'text-mute', TRACE: 'text-mute'
};
function colorClass(line) {
  const m = LEVEL_RE.exec(line);
  return m ? (LEVEL_COLORS[m[0].toUpperCase()] || '') : '';
}

// fases: confirm → uploading → waiting-build → online → (done) | error
export default function DeployModal({ app, file, onClose, onDeployed }) {
  const t = useT();
  const [phase, setPhase] = useState('confirm');
  const [progress, setProgress] = useState({ uploaded: 0, total: file.size, pct: 0 });
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [eta, setEta] = useState(null);
  const [commitMsg, setCommitMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [logs, setLogs] = useState('');
  const [statusInfo, setStatusInfo] = useState(null); // {running, memory, cpu...}

  const lastBytesRef = useRef({ ts: 0, bytes: 0 });
  const logsScrollRef = useRef(null);
  const elapsedTimerRef = useRef(null);
  const pollTimerRef = useRef(null);
  const startedAtBeforeRef = useRef(null);
  const buildStartRef = useRef(null);

  const isZip = file?.name?.toLowerCase().endsWith('.zip');
  const isLargeView = phase !== 'confirm';

  // rotear endpoints conforme app é próprio ou de equipe
  const apiStatus = app.team ? window.api.discloud.teamStatus : window.api.discloud.status;
  const apiLogs   = app.team ? window.api.discloud.teamLogs   : window.api.discloud.logs;
  const apiCommit = app.team ? window.api.discloud.teamCommit : window.api.discloud.commit;

  // captura startedAt atual ao abrir, pra detectar mudança após o commit
  useEffect(() => {
    (async () => {
      try {
        const s = await apiStatus(app.id);
        const data = s?.apps || s?.data || s;
        startedAtBeforeRef.current = data?.startedAt || data?.last_restart || null;
      } catch {}
    })();
  }, [app.id]);

  // progresso do upload via IPC
  useEffect(() => {
    const off = window.api.onCommitProgress(({ id, uploaded, total, pct }) => {
      if (id !== app.id) return;
      setProgress({ uploaded, total, pct });
      const now = Date.now();
      const last = lastBytesRef.current;
      if (last.ts > 0) {
        const dt = (now - last.ts) / 1000;
        if (dt > 0.2) {
          const speed = (uploaded - last.bytes) / dt;
          setUploadSpeed(speed);
          if (speed > 0) setEta((total - uploaded) / speed);
          lastBytesRef.current = { ts: now, bytes: uploaded };
        }
      } else {
        lastBytesRef.current = { ts: now, bytes: uploaded };
      }
    });
    return off;
  }, [app.id]);

  // timer de elapsed durante build/online
  useEffect(() => {
    if (phase === 'waiting-build' || phase === 'online') {
      if (buildStartRef.current == null) buildStartRef.current = Date.now();
      elapsedTimerRef.current = setInterval(() => {
        setElapsedSec(Math.floor((Date.now() - buildStartRef.current) / 1000));
      }, 1000);
    }
    return () => { if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current); };
  }, [phase]);

  // polling de status durante 'waiting-build' até startedAt mudar
  useEffect(() => {
    if (phase !== 'waiting-build') return;
    let cancelled = false;

    const poll = async () => {
      try {
        const s = await apiStatus(app.id);
        const data = s?.apps || s?.data || s;
        if (cancelled) return;
        setStatusInfo(data);
        const startedAt = data?.startedAt || data?.last_restart;
        const running =
          data?.container === 'Online' ||
          /online|running/i.test(String(data?.container || data?.status || ''));

        if (startedAt && startedAtBeforeRef.current && startedAt !== startedAtBeforeRef.current && running) {
          setPhase('online');
        }
      } catch {
        // ignora; tenta de novo
      }
    };

    poll();
    pollTimerRef.current = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [phase, app.id]);

  // logs do app rodando após 'online' (continua até fechar)
  useEffect(() => {
    if (phase !== 'online') return;
    let dead = false;

    const fetchLogs = async () => {
      try {
        const res = await apiLogs(app.id);
        if (dead) return;
        const text =
          res?.apps?.terminal?.big ||
          res?.apps?.terminal?.small ||
          res?.terminal?.big ||
          res?.terminal?.small ||
          res?.logs || '';
        setLogs(text);
      } catch {}
    };

    fetchLogs();
    const t = setInterval(fetchLogs, 2000);
    return () => { dead = true; clearInterval(t); };
  }, [phase, app.id]);

  // auto-scroll
  useEffect(() => {
    if (logsScrollRef.current) {
      logsScrollRef.current.scrollTop = logsScrollRef.current.scrollHeight;
    }
  }, [logs]);

  const deploy = async () => {
    setPhase('uploading');
    setErr(null);
    try {
      const res = await apiCommit(app.id, file.path);
      setCommitMsg(res?.message || t('deploy.filesSent'));
      window.api.db.insertDeploy(app.id, {
        ts: Date.now(),
        fileName: file.name,
        fileSize: file.size,
        success: true,
        message: res?.message || t('deploy.filesSent'),
        buildLog: res?._buildOutput || ''
      }).catch(() => {});
      setPhase('waiting-build');
      setTimeout(() => window.api.poller.tickNow(), 1500);
    } catch (e) {
      window.api.db.insertDeploy(app.id, {
        ts: Date.now(),
        fileName: file.name,
        fileSize: file.size,
        success: false,
        message: e.message,
        buildLog: e?.buildOutput || ''
      }).catch(() => {});
      setErr(e.message);
      setPhase('error');
    }
  };

  const closeAndDone = () => {
    if (commitMsg) onDeployed?.(commitMsg);
    onClose();
  };

  const fmtSpeed = (bps) => (!bps || !isFinite(bps)) ? '—' : fmtBytes(bps) + '/s';
  const fmtEta = (s) => {
    if (s == null || !isFinite(s) || s < 0) return '—';
    if (s < 60) return `${Math.ceil(s)}s`;
    return `${Math.floor(s / 60)}m ${Math.ceil(s % 60)}s`;
  };
  const fmtElapsed = (s) => {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  const logLines = logs ? logs.split('\n') : [];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-8">
      <div className={`card w-full flex flex-col ${isLargeView ? 'max-w-4xl h-[85vh]' : 'max-w-lg'}`}>
        {/* HEADER */}
        <div className="flex items-start justify-between p-5 pb-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              phase === 'online' ? 'bg-success/15 text-success' :
              phase === 'error' ? 'bg-danger/15 text-danger' :
              'bg-accent/15 text-accent'
            }`}>
              {phase === 'confirm' && <Upload size={20} />}
              {phase === 'uploading' && <Upload size={20} />}
              {phase === 'waiting-build' && <Loader2 size={20} className="animate-spin" />}
              {phase === 'online' && <CheckCircle2 size={20} />}
              {phase === 'error' && <AlertTriangle size={20} />}
            </div>
            <div>
              <h2 className="font-semibold">
                {phase === 'confirm' && t('deploy.titleConfirm')}
                {phase === 'uploading' && t('deploy.titleUploading')}
                {phase === 'waiting-build' && t('deploy.titleBuilding')}
                {phase === 'online' && t('deploy.titleOnline')}
                {phase === 'error' && t('deploy.titleError')}
              </h2>
              <p className="text-xs text-mute">{app.name}</p>
            </div>
          </div>
          <button
            className="btn !py-1 !px-2"
            onClick={(phase === 'uploading') ? undefined : closeAndDone}
            disabled={phase === 'uploading'}
            title={phase === 'uploading' ? t('deploy.waitUpload') : t('deploy.close')}
          >
            <X size={13} />
          </button>
        </div>

        {/* === CONFIRM === */}
        {phase === 'confirm' && (
          <div className="px-5 pb-5 space-y-4">
            <div className="bg-panel2 border border-border rounded-lg p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent2/15 text-accent2 flex items-center justify-center shrink-0">
                <FileArchive size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm truncate">{file.name}</div>
                <div className="text-xs text-mute font-mono truncate">{file.path}</div>
              </div>
              <div className="text-right text-sm shrink-0 font-semibold">{fmtBytes(file.size)}</div>
            </div>

            {!isZip && (
              <div className="flex items-start gap-2 p-3 bg-warn/10 border border-warn/30 rounded-lg text-xs text-warn">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <div>{t('deploy.notZipWarn')} <code>.zip</code>.</div>
              </div>
            )}

            <div className="bg-warn/10 border border-warn/30 rounded-lg p-3 text-xs space-y-2">
              <div className="flex items-start gap-2 text-warn">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <div className="font-medium">{t('deploy.attention')}</div>
              </div>
              <ul className="text-mute space-y-1 ml-6 list-disc">
                <li>{t('deploy.warn1')} <strong>{t('deploy.warn1Bold')}</strong> {t('deploy.warn1Suffix')}</li>
                <li>{t('deploy.warn2')}</li>
                <li>{t('deploy.warn3a')} <code>discloud.config</code> {t('deploy.warn3b')}</li>
                <li>{t('deploy.warn4a')} <strong>{t('deploy.warn4Bold')}</strong> {t('deploy.warn4b')}</li>
              </ul>
            </div>

            <div className="flex justify-end gap-2">
              <button className="btn" onClick={onClose}>{t('deploy.cancel')}</button>
              <button className="btn-primary" onClick={deploy} disabled={!isZip}>
                {t('deploy.doDeploy')}
              </button>
            </div>
          </div>
        )}

        {/* === UPLOADING / WAITING / ONLINE / ERROR === */}
        {isLargeView && (
          <div className="flex-1 flex flex-col min-h-0 px-5 pb-5 gap-3">
            {/* progresso compacto */}
            <div className="bg-panel2 border border-border rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2 text-xs">
                <FileArchive size={14} className="text-accent2 shrink-0" />
                <span className="truncate flex-1">{file.name}</span>
                <span className="text-mute font-mono shrink-0">
                  {fmtBytes(progress.uploaded)} / {fmtBytes(progress.total)}
                </span>
                <span className={`font-semibold shrink-0 ${progress.pct >= 100 ? 'text-success' : 'text-text'}`}>
                  {progress.pct.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 bg-border rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-200 ${progress.pct >= 100 ? 'bg-success' : 'bg-gradient-to-r from-accent to-accent2'}`}
                  style={{ width: `${Math.min(100, progress.pct)}%` }}
                />
              </div>
              {phase === 'uploading' && progress.pct < 100 && (
                <div className="flex justify-between text-[10px] text-mute mt-1.5">
                  <span>↑ {fmtSpeed(uploadSpeed)}</span>
                  <span>ETA: {fmtEta(eta)}</span>
                </div>
              )}
            </div>

            {/* Status box durante waiting-build */}
            {phase === 'waiting-build' && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-bg border border-border rounded-lg p-8">
                <Loader2 size={48} className="text-accent animate-spin" />
                <div className="text-center space-y-1">
                  <div className="text-lg font-semibold">{t('deploy.buildingMsg')}</div>
                  <div className="text-sm text-mute">
                    {t('deploy.buildingSub')}
                  </div>
                </div>
                <div className="font-mono text-2xl text-accent">
                  {fmtElapsed(elapsedSec)}
                </div>
                <div className="text-[10px] text-mute text-center max-w-md">
                  {commitMsg && <div className="text-success">✓ {commitMsg}</div>}
                  <div className="mt-1">
                    {t('deploy.buildingHint')}
                  </div>
                </div>
                {statusInfo?.container && (
                  <div className="text-xs text-mute bg-panel2 px-3 py-1 rounded-full">
                    {t('deploy.containerLabel', { v: statusInfo.container })}
                  </div>
                )}
              </div>
            )}

            {/* Logs do app online */}
            {phase === 'online' && (
              <>
                <div className="flex items-center gap-2 text-xs">
                  <CheckCircle2 size={14} className="text-success" />
                  <span className="text-success font-medium">{t('deploy.appOnline')}</span>
                  <span className="text-mute">· {t('deploy.builtIn', { v: fmtElapsed(elapsedSec) })}</span>
                  <span className="ml-auto text-mute flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                    {t('deploy.tracking')}
                  </span>
                </div>
                <div
                  ref={logsScrollRef}
                  className="selectable flex-1 overflow-auto bg-bg border border-border rounded-lg font-mono text-[12px] leading-relaxed"
                >
                  {logLines.length === 0 || (logLines.length === 1 && !logLines[0]) ? (
                    <div className="p-4 text-mute text-center">{t('deploy.waitingLogs')}</div>
                  ) : (
                    logLines.map((line, i) => (
                      <div key={i} className={`px-3 py-0.5 ${colorClass(line)}`}>
                        <span className="inline-block w-8 text-mute/60 select-none text-right pr-2">{i + 1}</span>
                        <span className="whitespace-pre-wrap break-words">{line}</span>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {/* Erro */}
            {phase === 'error' && err && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-bg border border-danger/30 rounded-lg p-8">
                <AlertTriangle size={48} className="text-danger" />
                <div className="text-center space-y-2">
                  <div className="text-lg font-semibold">{t('deploy.errorTitle')}</div>
                  <div className="text-sm text-danger font-mono max-w-lg break-words">{err}</div>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center text-[11px] text-mute">
              <span>
                {phase === 'online' && t('deploy.linesLabel', { n: logLines.length })}
                {phase === 'waiting-build' && t('deploy.waitingBuild')}
              </span>
              {(phase === 'online' || phase === 'error' || phase === 'waiting-build') && (
                <button className="btn-primary !py-1 !px-3 !text-xs" onClick={closeAndDone}>
                  {t('deploy.close')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
