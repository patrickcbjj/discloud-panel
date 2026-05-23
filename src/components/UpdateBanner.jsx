import React, { useEffect, useState } from 'react';
import { Download, CheckCircle2, RotateCw, X } from 'lucide-react';
import { useT } from '../i18n.js';

// Banner flutuante no canto inferior direito. Aparece quando uma update
// foi baixada e está pronta pra instalar. Também mostra progresso de download
// pra dar transparência ao usuário sem precisar abrir Configurações.

function fmtBytes(n) {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0; let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

export default function UpdateBanner({ onOpenSettings }) {
  const t = useT();
  const [state, setState] = useState({ status: 'idle' });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    window.api.updater.state().then(setState);
    return window.api.onUpdaterEvent((s) => {
      setState(s);
      // Re-mostra o banner em estados relevantes mesmo se tinha sido fechado
      if (s.status === 'downloaded' || s.status === 'downloading') {
        setDismissed(false);
      }
    });
  }, []);

  const visible = !dismissed && (state.status === 'downloading' || state.status === 'downloaded');
  if (!visible) return null;

  const pct = Math.max(0, Math.min(100, Math.round(state.progress?.percent || 0)));
  const isDownloaded = state.status === 'downloaded';

  return (
    <div
      className="fixed bottom-4 right-4 z-50 w-80 card p-4 shadow-2xl border-accent/30"
      role="status"
      aria-live="polite"
    >
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-2 right-2 text-mute hover:text-text p-1 rounded"
        aria-label="Fechar"
      >
        <X size={13} />
      </button>

      {isDownloaded ? (
        <>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={16} className="text-success" />
            <div className="text-sm font-medium">
              {t('settings.updateDownloaded', { v: state.version || '?' })}
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => window.api.updater.quitAndInstall()}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors"
            >
              <RotateCw size={12} />
              {t('settings.restartAndInstall')}
            </button>
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="px-3 py-2 rounded-lg bg-panel2 border border-border text-xs hover:bg-border transition-colors"
              >
                …
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-2">
            <Download size={16} className="text-accent" />
            <div className="text-sm font-medium pr-6">
              {t('settings.updateDownloading', { v: state.version || '?' })}
            </div>
          </div>
          <div className="h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-mute mt-1.5">
            <span>{fmtBytes(state.progress?.transferred)} / {fmtBytes(state.progress?.total)}</span>
            <span>{pct}%</span>
          </div>
        </>
      )}
    </div>
  );
}
