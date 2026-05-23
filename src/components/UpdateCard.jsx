import React, { useEffect, useState } from 'react';
import { Download, RefreshCw, CheckCircle2, AlertTriangle, RotateCw, Sparkles, ChevronDown } from 'lucide-react';
import { useT } from '../i18n.js';

function shortError(msg) {
  if (!msg) return '?';
  // electron-updater devolve o stacktrace inteiro em uma string — pega só
  // a primeira linha pra UI ficar limpa
  const first = String(msg).split('\n')[0];
  // 404 do latest.yml é o caso mais comum: release publicada manualmente sem
  // o arquivo de metadados. Mensagem amigável.
  if (/latest\.yml/i.test(first) && /404|cannot find/i.test(first)) {
    return 'A release atual não inclui metadados de auto-update (latest.yml).';
  }
  if (/getaddrinfo|ENOTFOUND|ECONNREFUSED|ETIMEDOUT/i.test(first)) {
    return 'Sem conexão com GitHub.';
  }
  return first.length > 140 ? first.slice(0, 140) + '…' : first;
}

function fmtBytes(n) {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0; let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

export default function UpdateCard() {
  const t = useT();
  const [state, setState] = useState({ status: 'idle', currentVersion: '—' });
  const [checking, setChecking] = useState(false);
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  useEffect(() => {
    window.api.updater.state().then(setState);
    return window.api.onUpdaterEvent(setState);
  }, []);

  const handleCheck = async () => {
    setChecking(true);
    try {
      const res = await window.api.updater.checkNow();
      if (res?.state) setState(res.state);
    } finally {
      // O estado real vem via evento; este `checking` é só pra dar feedback no botão por ~1s
      setTimeout(() => setChecking(false), 800);
    }
  };

  const handleInstall = () => window.api.updater.quitAndInstall();

  const { status, currentVersion, version, progress, error } = state;
  const busy = checking || status === 'checking' || status === 'downloading';
  const pct = Math.max(0, Math.min(100, Math.round(progress?.percent || 0)));

  const renderStatus = () => {
    if (status === 'checking') {
      return (
        <div className="flex items-center gap-2 text-sm text-mute">
          <RotateCw size={14} className="animate-spin" />
          <span>{t('settings.checking')}</span>
        </div>
      );
    }
    if (status === 'available') {
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-accent">
            <Sparkles size={14} />
            <span>{t('settings.updateAvailable', { v: version || '?' })}</span>
          </div>
          <button
            onClick={() => window.api.updater.download()}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            <Download size={14} />
            {t('settings.updateModalDownload')}
          </button>
        </div>
      );
    }
    if (status === 'downloading') {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Download size={14} className="text-accent" />
            <span>{t('settings.updateDownloading', { v: version || '?' })}</span>
          </div>
          <div className="h-2 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-mute">
            <span>
              {t('settings.bytesOf', { a: fmtBytes(progress?.transferred), b: fmtBytes(progress?.total) })}
            </span>
            <span>{pct}%</span>
            <span>{fmtBytes(progress?.bytesPerSecond)}/s</span>
          </div>
        </div>
      );
    }
    if (status === 'downloaded') {
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-success">
            <CheckCircle2 size={14} />
            <span>{t('settings.updateDownloaded', { v: version || '?' })}</span>
          </div>
          <button
            onClick={handleInstall}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            <RotateCw size={14} />
            {t('settings.restartAndInstall')}
          </button>
        </div>
      );
    }
    if (status === 'not-available') {
      return (
        <div className="flex items-center gap-2 text-sm text-mute">
          <CheckCircle2 size={14} className="text-success" />
          <span>{t('settings.upToDate')}</span>
        </div>
      );
    }
    if (status === 'error') {
      return (
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-sm text-danger">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span className="leading-snug">{shortError(error)}</span>
          </div>
          {error && (
            <button
              onClick={() => setShowErrorDetails((v) => !v)}
              className="text-[11px] text-mute hover:text-text flex items-center gap-1 transition-colors"
            >
              <ChevronDown
                size={11}
                className={`transition-transform ${showErrorDetails ? 'rotate-180' : ''}`}
              />
              {showErrorDetails ? 'ocultar detalhes' : 'detalhes técnicos'}
            </button>
          )}
          {showErrorDetails && error && (
            <pre className="text-[10px] text-mute bg-panel2 border border-border rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap font-mono">
              {error}
            </pre>
          )}
        </div>
      );
    }
    return (
      <div className="text-xs text-mute">{t('settings.autoCheckHint')}</div>
    );
  };

  return (
    <div className="card p-5 space-y-4">
      <h2 className="text-xs uppercase text-mute tracking-wider flex items-center gap-2">
        <Download size={12} /> {t('settings.updates')}
      </h2>

      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-mute uppercase tracking-wider">
            {t('settings.currentVersion')}
          </div>
          <div className="font-mono text-sm mt-0.5">v{currentVersion}</div>
        </div>
        <button
          onClick={handleCheck}
          disabled={busy || status === 'downloaded'}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-panel2 border border-border hover:bg-border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw size={13} className={busy ? 'animate-spin' : ''} />
          {busy ? t('settings.checking') : t('settings.checkForUpdates')}
        </button>
      </div>

      {renderStatus()}
    </div>
  );
}
