import React, { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Plus, Trash2, Save, FileText, Code, RefreshCw, CheckCircle2, AlertTriangle, FilePlus } from 'lucide-react';
import { useT } from '../i18n.js';

const SECRET_HINT = /(TOKEN|SECRET|KEY|PASSWORD|PASS|PWD|API|AUTH|CREDENTIAL)/i;

function parseEnv(text) {
  const rows = [];
  const lines = String(text || '').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // remover aspas se cobrir o valor todo
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    rows.push({ key, value, secret: SECRET_HINT.test(key) });
  }
  return rows;
}

function stringifyEnv(rows) {
  return rows
    .filter((r) => r.key.trim())
    .map((r) => {
      const v = r.value || '';
      const needsQuotes = /[\s#]/.test(v) || v !== v.trim();
      const escaped = v.replace(/"/g, '\\"');
      return `${r.key.trim()}=${needsQuotes ? `"${escaped}"` : escaped}`;
    })
    .join('\n') + '\n';
}

export default function EnvEditor({ app, filename = '.env', title }) {
  const t = useT();
  const resolvedTitle = title || t('env.titleEnv');
  const [loading, setLoading] = useState(true);
  const [rawText, setRawText] = useState('');
  const [rows, setRows] = useState([]);
  const [mode, setMode] = useState('table');
  const [err, setErr] = useState(null);
  const [exists, setExists] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [fullPath, setFullPath] = useState(null);

  const isTeam = !!app.team;

  // Discloud usa workDir do app — descobrimos chamando explorer() sem cPath
  const resolveWorkdir = async () => {
    const r = await window.api.discloud.explorer(app.id, isTeam, null);
    return r?.path || '';
  };

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      let fp = fullPath;
      if (!fp) {
        const wd = await resolveWorkdir();
        fp = wd.replace(/\/$/, '') + '/' + filename;
        setFullPath(fp);
      }
      const res = await window.api.discloud.explorerOpen(app.id, isTeam, fp);
      const content = res?.content ?? '';
      setRawText(content);
      setRows(parseEnv(content));
      setExists(true);
      setDirty(false);
    } catch (e) {
      if (e?.message?.includes('404') || /n.o.+encontrad|pathInvalid|notFound/i.test(e?.message || '')) {
        setExists(false);
        setRawText('');
        setRows([]);
      } else {
        setErr(e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setFullPath(null); load(); /* eslint-disable-next-line */ }, [app.id, filename]);

  const createFile = async () => {
    setSaving(true);
    try {
      let fp = fullPath;
      if (!fp) {
        const wd = await resolveWorkdir();
        fp = wd.replace(/\/$/, '') + '/' + filename;
        setFullPath(fp);
      }
      await window.api.discloud.explorerCreate(app.id, isTeam, fp, 'file');
      setExists(true);
      await load();
    } catch (e) {
      setErr(e.message);
    } finally { setSaving(false); }
  };

  const setRow = (i, patch) => {
    setRows((rs) => rs.map((r, idx) => idx === i ? { ...r, ...patch } : r));
    setDirty(true);
  };
  const addRow = () => { setRows((rs) => [...rs, { key: '', value: '', secret: false }]); setDirty(true); };
  const delRow = (i) => { setRows((rs) => rs.filter((_, idx) => idx !== i)); setDirty(true); };

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      const content = mode === 'raw' ? rawText : stringifyEnv(rows);
      await window.api.discloud.explorerEdit(app.id, isTeam, fullPath, content);
      setRawText(content);
      if (mode === 'raw') setRows(parseEnv(content));
      setSavedAt(Date.now());
      setDirty(false);
      setTimeout(() => setSavedAt(0), 2500);
    } catch (e) {
      setErr(e.message);
    } finally { setSaving(false); }
  };

  const switchMode = (next) => {
    if (next === mode) return;
    if (next === 'raw') {
      // sai do table → gera raw a partir dos rows
      setRawText(stringifyEnv(rows));
    } else {
      // entra no table → parse o raw atual
      setRows(parseEnv(rawText));
    }
    setMode(next);
  };

  if (loading) {
    return (
      <div className="card p-4 text-xs text-mute flex items-center gap-2">
        <RefreshCw size={12} className="animate-spin" /> {t('env.loadingFile', { f: filename })}
      </div>
    );
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <FileText size={14} className="text-mute" />
        {resolvedTitle}
        <span className="text-xs text-mute font-normal font-mono">{fullPath || filename}</span>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => switchMode('table')}
            className={`px-2 py-1 text-[11px] rounded ${mode === 'table' ? 'bg-accent text-white' : 'bg-panel2 text-mute hover:text-text'}`}
            title={t('env.tableTip')}
          >
            {t('env.tableMode')}
          </button>
          <button
            onClick={() => switchMode('raw')}
            className={`px-2 py-1 text-[11px] rounded ${mode === 'raw' ? 'bg-accent text-white' : 'bg-panel2 text-mute hover:text-text'}`}
            title={t('env.textTip')}
          >
            <Code size={11} className="inline mr-1" /> {t('env.textMode')}
          </button>
          <button
            onClick={load}
            className="px-2 py-1 text-[11px] rounded bg-panel2 text-mute hover:text-text"
            title={t('env.reload')}
          >
            <RefreshCw size={11} />
          </button>
        </div>
      </div>

      {err && (
        <div className="text-xs text-danger flex items-center gap-1">
          <AlertTriangle size={12} /> {err}
        </div>
      )}

      {!exists ? (
        <div className="text-center py-4 space-y-2">
          <div className="text-sm text-mute">{t('env.notExists', { f: filename })}</div>
          <button className="btn-primary" onClick={createFile} disabled={saving}>
            <FilePlus size={13} className="inline mr-1" /> {t('env.createFile')}
          </button>
        </div>
      ) : mode === 'table' ? (
        <>
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {rows.length === 0 && (
              <div className="text-xs text-mute text-center py-4">{t('env.noVars')}</div>
            )}
            {rows.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={r.key}
                  onChange={(e) => setRow(i, { key: e.target.value })}
                  placeholder={t('env.keyPh')}
                  className="selectable w-40 bg-panel2 border border-border rounded-lg px-2 py-1.5 text-xs font-mono uppercase focus:outline-none focus:border-accent"
                />
                <span className="text-mute text-xs">=</span>
                <div className="flex-1 relative">
                  <input
                    type={r.secret ? 'password' : 'text'}
                    value={r.value}
                    onChange={(e) => setRow(i, { value: e.target.value })}
                    placeholder={t('env.valuePh')}
                    className="selectable w-full bg-panel2 border border-border rounded-lg px-2 py-1.5 pr-8 text-xs font-mono focus:outline-none focus:border-accent"
                  />
                  <button
                    type="button"
                    onClick={() => setRow(i, { secret: !r.secret })}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-mute hover:text-text"
                    title={r.secret ? t('env.show') : t('env.hide')}
                  >
                    {r.secret ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                </div>
                <button
                  onClick={() => delRow(i)}
                  className="text-mute hover:text-danger p-1"
                  title={t('env.remove')}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
          <button className="btn text-xs" onClick={addRow}>
            <Plus size={12} className="inline mr-1" /> {t('env.addVar')}
          </button>
        </>
      ) : (
        <textarea
          value={rawText}
          onChange={(e) => { setRawText(e.target.value); setDirty(true); }}
          rows={12}
          className="selectable w-full bg-panel2 border border-border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-accent resize-y"
          placeholder="# KEY=value"
          spellCheck={false}
        />
      )}

      {exists && (
        <div className="flex items-center gap-2 border-t border-border pt-3">
          <button className="btn-primary" onClick={save} disabled={saving || !dirty}>
            {savedAt
              ? <CheckCircle2 size={13} className="inline mr-1" />
              : saving
                ? <RefreshCw size={13} className="inline mr-1 animate-spin" />
                : <Save size={13} className="inline mr-1" />}
            {savedAt ? t('env.saved') : saving ? t('env.saving') : t('env.save')}
          </button>
          <span className="text-xs text-mute">
            {t('env.warnRestart', { f: filename })}
          </span>
        </div>
      )}
    </div>
  );
}
