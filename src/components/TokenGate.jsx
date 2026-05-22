import React, { useState } from 'react';
import { KeyRound, ExternalLink } from 'lucide-react';
import { useT } from '../i18n.js';

export default function TokenGate({ onSaved }) {
  const t = useT();
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const save = async () => {
    setErr(null);
    if (!token.trim()) { setErr(t('tokenGate.emptyErr')); return; }
    setSaving(true);
    await window.api.config.set('apiToken', token.trim());
    setSaving(false);
    onSaved();
  };

  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="card p-8 w-[480px] space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/15 text-accent flex items-center justify-center">
            <KeyRound size={20} />
          </div>
          <div>
            <h1 className="text-lg font-semibold">{t('tokenGate.title')}</h1>
            <p className="text-xs text-mute">{t('tokenGate.desc')}</p>
          </div>
        </div>

        <div className="text-sm text-mute space-y-2">
          <p>{t('tokenGate.howTo')}</p>
          <ol className="list-decimal list-inside space-y-1 text-slate-300">
            <li>{t('tokenGate.step1')}</li>
            <li>{t('tokenGate.step2a')} <code className="px-1 py-0.5 rounded bg-panel2 text-accent">/apitoken</code></li>
            <li>{t('tokenGate.step3')}</li>
          </ol>
        </div>

        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={t('tokenGate.placeholder')}
          className="selectable w-full bg-panel2 border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-accent"
          autoFocus
        />

        {err && <div className="text-danger text-xs">{err}</div>}

        <div className="flex justify-between items-center">
          <button
            className="text-xs text-mute hover:text-accent flex items-center gap-1"
            onClick={() => window.api.openExternal('https://docs.discloud.app/')}
          >
            {t('tokenGate.docsLabel')} <ExternalLink size={10} />
          </button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? t('tokenGate.saving') : t('tokenGate.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
