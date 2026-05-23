import React, { useEffect, useRef, useState } from 'react';
import { X, Copy, Check, Download, ScrollText, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { useT } from '../i18n.js';

// Modal pra visualizar o build log de um deploy. Carrega sob demanda via IPC
// (logs ficam no SQLite mas não vêm na lista de deploys pra não inflar payload).

function fmtDate(ts) {
  if (!ts) return '';
  try { return new Date(ts).toLocaleString(); } catch { return String(ts); }
}

// Highlight básico de linhas com keywords típicos de build. Não tenta ser
// um syntax highlighter completo; só pinta o sinal que importa.
function classifyLine(line) {
  if (/\berror\b|\bfailed\b|\bfatal\b|\btraceback\b|exit code [^0]/i.test(line)) return 'err';
  if (/\bwarn(ing)?\b|deprecat/i.test(line)) return 'warn';
  if (/^\s*=>|^\s*\[\d+\/\d+\]|^\s*#\d+|successfully|completed/i.test(line)) return 'info';
  return 'plain';
}

export default function BuildLogModal({ appId, deploy, onClose }) {
  const t = useT();
  const [log, setLog] = useState(null); // null = loading, '' = empty, string = loaded
  const [copied, setCopied] = useState(false);
  const preRef = useRef(null);

  useEffect(() => {
    let dead = false;
    setLog(null);
    window.api.db.deployBuildLog(appId, deploy.ts).then((text) => {
      if (!dead) setLog(text || '');
    }).catch(() => { if (!dead) setLog(''); });
    return () => { dead = true; };
  }, [appId, deploy.ts]);

  // ESC fecha
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // scroll pro fim quando carrega
  useEffect(() => {
    if (log && preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [log]);

  const handleCopy = async () => {
    if (!log) return;
    try {
      await navigator.clipboard.writeText(log);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const handleDownload = () => {
    if (!log) return;
    const blob = new Blob([log], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const stamp = new Date(deploy.ts).toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.download = `build-log_${appId}_${stamp}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const truncated = typeof log === 'string' && log.startsWith('[…log truncado');

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-6"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-start gap-3">
          <ScrollText size={18} className="text-accent shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold leading-tight">{t('settings.buildLogTitle')}</h2>
              {deploy.success
                ? <span className="chip bg-success/15 text-success text-[10px] py-0.5 px-1.5 flex items-center gap-1"><CheckCircle2 size={10} />ok</span>
                : <span className="chip bg-danger/15 text-danger text-[10px] py-0.5 px-1.5 flex items-center gap-1"><XCircle size={10} />falhou</span>}
            </div>
            <div className="text-xs text-mute mt-1 flex items-center gap-2 flex-wrap font-mono">
              <span>{fmtDate(deploy.ts)}</span>
              {deploy.file_name && <span className="truncate max-w-[200px]">· {deploy.file_name}</span>}
              {typeof log === 'string' && log.length > 0 && (
                <span>· {t('settings.buildLogSize', { n: log.length.toLocaleString() })}</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg hover:bg-panel2 transition-colors"
            aria-label={t('settings.buildLogClose')}
          >
            <X size={14} />
          </button>
        </div>

        {/* Truncation warning */}
        {truncated && (
          <div className="px-5 py-2 bg-warn/10 border-b border-warn/30 text-xs text-warn flex items-center gap-2">
            <AlertTriangle size={12} />
            {t('settings.buildLogTruncated')}
          </div>
        )}

        {/* Log body */}
        <div className="flex-1 min-h-0 bg-panel2/40">
          {log === null ? (
            <div className="h-full flex items-center justify-center text-mute text-sm">
              <ScrollText size={14} className="animate-pulse mr-2" /> carregando…
            </div>
          ) : log === '' ? (
            <div className="h-full flex items-center justify-center text-mute text-sm px-6 text-center">
              {t('settings.buildLogEmpty')}
            </div>
          ) : (
            <div
              ref={preRef}
              className="h-full overflow-auto font-mono text-[11px] leading-relaxed px-4 py-3 selectable"
            >
              {log.split('\n').map((line, i) => {
                const cls = classifyLine(line);
                const color =
                  cls === 'err'  ? 'text-danger' :
                  cls === 'warn' ? 'text-warn' :
                  cls === 'info' ? 'text-accent2' :
                                   'text-text/85';
                return (
                  <div key={i} className={`flex gap-3 ${color} hover:bg-panel/40`}>
                    <span className="text-mute select-none w-9 text-right shrink-0">{i + 1}</span>
                    <span className="whitespace-pre-wrap break-all flex-1">{line || ' '}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border flex items-center justify-between gap-2 bg-panel">
          <div className="text-[11px] text-mute">
            {deploy.message && <span className="truncate" title={deploy.message}>{deploy.message}</span>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {log && (
              <>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-panel2 border border-border hover:bg-border text-xs transition-colors"
                >
                  {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                  {copied ? t('settings.buildLogCopied') : t('settings.buildLogCopy')}
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-panel2 border border-border hover:bg-border text-xs transition-colors"
                >
                  <Download size={12} />
                  .txt
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors"
            >
              {t('settings.buildLogClose')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
