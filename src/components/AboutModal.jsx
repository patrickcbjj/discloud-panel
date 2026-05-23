import React, { useEffect, useState } from 'react';
import { X, Github, Bug, Heart, Copy, Check, ExternalLink, Scale, Cpu } from 'lucide-react';
import { useT } from '../i18n.js';
import AppIcon from './AppIcon.jsx';

const REPO_URL = 'https://github.com/patrickcbjj/discloud-panel';
const ISSUES_URL = `${REPO_URL}/issues/new`;
const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`;
const AUTHOR_URL = 'https://github.com/patrickcbjj';

const STACK = [
  { label: 'Electron', url: 'https://www.electronjs.org' },
  { label: 'React', url: 'https://react.dev' },
  { label: 'Vite', url: 'https://vite.dev' },
  { label: 'Tailwind', url: 'https://tailwindcss.com' },
  { label: 'recharts', url: 'https://recharts.org' },
  { label: 'sql.js', url: 'https://sql.js.org' },
  { label: 'lucide', url: 'https://lucide.dev' }
];

export default function AboutModal({ onClose }) {
  const t = useT();
  const [info, setInfo] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    window.api.app.info().then(setInfo);
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const open = (url) => window.api.openExternal(url);

  const copyDebug = async () => {
    if (!info) return;
    const text = [
      `Discloud Panel v${info.version}`,
      `Electron ${info.electron} · Chrome ${info.chrome} · Node ${info.node}`,
      `${info.platform}/${info.arch}`,
      `Locale: ${navigator.language}`
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-8"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header com gradient */}
        <div className="relative p-6 pb-5 bg-gradient-to-br from-accent/20 via-accent2/10 to-transparent border-b border-border">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-panel2 transition-colors"
            aria-label={t('settings.aboutClose')}
          >
            <X size={14} />
          </button>

          <div className="flex items-start gap-4">
            <div className="shrink-0 rounded-2xl overflow-hidden shadow-lg ring-1 ring-white/10">
              <AppIcon size={64} />
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <div className="text-lg font-semibold leading-tight">Discloud Panel</div>
              <div className="font-mono text-xs text-mute mt-0.5">
                v{info?.version || '…'}
              </div>
              <div className="text-xs text-mute mt-2 leading-snug">
                {t('settings.aboutTagline')}
              </div>
            </div>
          </div>
        </div>

        {/* Links principais */}
        <div className="p-5 space-y-2">
          <button
            onClick={() => open(REPO_URL)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-panel2 border border-border hover:border-accent/40 hover:bg-border transition-colors text-left"
          >
            <Github size={16} className="text-mute shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{t('settings.aboutSourceCode')}</div>
              <div className="text-[10px] text-mute font-mono truncate">github.com/patrickcbjj/discloud-panel</div>
            </div>
            <ExternalLink size={12} className="text-mute shrink-0" />
          </button>

          <button
            onClick={() => open(ISSUES_URL)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-panel2 border border-border hover:border-accent/40 hover:bg-border transition-colors text-left"
          >
            <Bug size={16} className="text-mute shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{t('settings.aboutReportBug')}</div>
              <div className="text-[10px] text-mute truncate">Abre uma issue no GitHub</div>
            </div>
            <ExternalLink size={12} className="text-mute shrink-0" />
          </button>

          <button
            onClick={() => open(LICENSE_URL)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-panel2 border border-border hover:border-accent/40 hover:bg-border transition-colors text-left"
          >
            <Scale size={16} className="text-mute shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{t('settings.aboutLicense')}</div>
              <div className="text-[10px] text-mute truncate">MIT</div>
            </div>
            <ExternalLink size={12} className="text-mute shrink-0" />
          </button>
        </div>

        {/* Autor */}
        <div className="px-5 pb-4">
          <div className="text-[10px] uppercase text-mute tracking-wider mb-2">
            {t('settings.aboutAuthor')}
          </div>
          <button
            onClick={() => open(AUTHOR_URL)}
            className="flex items-center gap-2 text-sm hover:text-accent transition-colors group"
          >
            <Heart size={12} className="text-danger" fill="currentColor" />
            <span className="font-medium">Patrick</span>
            <span className="text-mute font-mono text-xs group-hover:text-accent">@patrickcbjj</span>
            <ExternalLink size={11} className="text-mute opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </div>

        {/* Stack */}
        <div className="px-5 pb-4">
          <div className="text-[10px] uppercase text-mute tracking-wider mb-2">
            {t('settings.aboutBuiltWith')}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STACK.map((s) => (
              <button
                key={s.label}
                onClick={() => open(s.url)}
                className="text-[11px] px-2 py-0.5 rounded-md bg-panel2 border border-border text-mute hover:text-accent hover:border-accent/40 transition-colors font-mono"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Info do sistema */}
        {info && (
          <div className="px-5 pb-4">
            <div className="text-[10px] uppercase text-mute tracking-wider mb-2 flex items-center gap-1">
              <Cpu size={10} /> {t('settings.aboutSystem')}
            </div>
            <div className="bg-panel2 border border-border rounded-lg p-3 font-mono text-[10px] text-mute space-y-0.5 leading-relaxed">
              <div>Electron <span className="text-text">{info.electron}</span> · Chrome <span className="text-text">{info.chrome}</span></div>
              <div>Node <span className="text-text">{info.node}</span></div>
              <div>{info.platform}/{info.arch}</div>
            </div>
            <button
              onClick={copyDebug}
              className="mt-2 flex items-center gap-1.5 text-[10px] text-mute hover:text-accent transition-colors"
            >
              {copied ? <Check size={11} className="text-success" /> : <Copy size={11} />}
              {copied ? t('settings.aboutCopied') : t('settings.aboutCopyDebug')}
            </button>
          </div>
        )}

        {/* Disclaimer + close */}
        <div className="px-5 pb-5 pt-3 border-t border-border space-y-3">
          <p className="text-[10px] text-mute leading-relaxed italic">
            {t('settings.aboutDisclaimer')}
          </p>
          <button
            onClick={onClose}
            className="w-full px-3 py-2 rounded-lg bg-panel2 border border-border hover:bg-border text-sm transition-colors"
          >
            {t('settings.aboutClose')}
          </button>
        </div>
      </div>
    </div>
  );
}
