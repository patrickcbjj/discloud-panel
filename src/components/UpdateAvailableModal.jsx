import React, { useEffect, useState } from 'react';
import { X, Sparkles, Download, ExternalLink, ArrowRight } from 'lucide-react';
import { useT } from '../i18n.js';
import AppIcon from './AppIcon.jsx';

const REPO = 'https://github.com/patrickcbjj/discloud-panel';

// Modal que aparece quando o updater detecta uma versão nova. O download
// NÃO é automático — usuário escolhe baixar ou ignorar. Se ignorar, o modal
// só some até o próximo start do app (toda abertura mostra de novo se ainda
// houver versão nova disponível).

export default function UpdateAvailableModal() {
  const t = useT();
  const [state, setState] = useState({ status: 'idle' });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    window.api.updater.state().then(setState);
    return window.api.onUpdaterEvent(setState);
  }, []);

  const visible = !dismissed && state.status === 'available';
  if (!visible) return null;

  const newVersion = state.version || '?';
  const currentVersion = state.currentVersion || '?';
  const releaseUrl = `${REPO}/releases/tag/v${newVersion}`;

  const handleDownload = () => {
    window.api.updater.download();
    // O banner flutuante assume daqui (mostra progresso e CTA de reiniciar).
    // Fecha o modal pra não atrapalhar.
    setDismissed(true);
  };

  const handleLater = () => setDismissed(true);
  const handleWhatsNew = () => window.api.openExternal(releaseUrl);

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-6"
      onClick={handleLater}
    >
      <div
        className="card w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header com gradient e ícone */}
        <div className="relative px-6 pt-6 pb-5 bg-gradient-to-br from-accent/25 via-accent2/15 to-transparent border-b border-border">
          <button
            onClick={handleLater}
            className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-panel2 transition-colors"
            aria-label={t('settings.updateModalLater')}
          >
            <X size={14} />
          </button>

          <div className="flex items-start gap-4">
            <div className="shrink-0 relative">
              <div className="rounded-2xl overflow-hidden shadow-lg ring-1 ring-white/10">
                <AppIcon size={56} />
              </div>
              <div className="absolute -top-1.5 -right-1.5 bg-accent text-white text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full shadow-lg flex items-center gap-0.5">
                <Sparkles size={9} fill="currentColor" />
                NEW
              </div>
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="text-base font-semibold leading-tight">
                {t('settings.updateModalTitle')}
              </div>
              <div className="text-xs text-mute mt-1.5 leading-snug">
                {t('settings.updateModalSubtitle', { v: newVersion })}
              </div>
            </div>
          </div>
        </div>

        {/* Comparação de versões */}
        <div className="px-6 py-4 flex items-center justify-center gap-3 bg-panel2/40">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-mute uppercase tracking-wider text-[10px]">atual</span>
            <span className="font-mono text-text">v{currentVersion}</span>
          </div>
          <ArrowRight size={14} className="text-mute" />
          <div className="flex items-center gap-2 text-xs">
            <span className="text-accent uppercase tracking-wider text-[10px]">nova</span>
            <span className="font-mono text-accent font-semibold">v{newVersion}</span>
          </div>
        </div>

        {/* Ações */}
        <div className="p-5 space-y-2.5">
          <button
            onClick={handleDownload}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-white font-medium text-sm hover:bg-accent/90 transition-colors shadow-sm"
          >
            <Download size={15} />
            {t('settings.updateModalDownload')}
          </button>

          <div className="flex gap-2">
            <button
              onClick={handleWhatsNew}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-panel2 border border-border hover:border-accent/40 hover:bg-border text-sm transition-colors"
            >
              <Sparkles size={13} />
              {t('settings.updateModalWhatsNew')}
              <ExternalLink size={11} className="text-mute" />
            </button>
            <button
              onClick={handleLater}
              className="flex-1 px-3 py-2 rounded-lg bg-panel2 border border-border hover:bg-border text-sm text-mute hover:text-text transition-colors"
            >
              {t('settings.updateModalLater')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
