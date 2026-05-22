import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, RefreshCw, Pause, Play, Search, ArrowDownToLine, Copy } from 'lucide-react';
import { fmtTime } from '../format.js';
import { useT } from '../i18n.js';

const LEVEL_RE = /\b(ERROR|ERR|FATAL|WARN(ING)?|INFO|DEBUG|TRACE)\b/i;
const LEVEL_COLORS = {
  ERROR: 'text-danger',
  ERR: 'text-danger',
  FATAL: 'text-danger font-semibold',
  WARN: 'text-warn',
  WARNING: 'text-warn',
  INFO: 'text-accent',
  DEBUG: 'text-mute',
  TRACE: 'text-mute'
};

function colorClass(line) {
  const m = LEVEL_RE.exec(line);
  if (!m) return '';
  return LEVEL_COLORS[m[0].toUpperCase()] || '';
}

function highlight(line, query) {
  if (!query) return line;
  const q = query.toLowerCase();
  const idx = line.toLowerCase().indexOf(q);
  if (idx < 0) return line;
  return (
    <>
      {line.slice(0, idx)}
      <span className="bg-warn/30 text-warn">{line.slice(idx, idx + query.length)}</span>
      {line.slice(idx + query.length)}
    </>
  );
}

export default function LogsModal({ appId, team = false, onClose }) {
  const t = useT();
  const [raw, setRaw] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [query, setQuery] = useState('');
  const [error, setError] = useState(null);
  const [stickToBottom, setStickToBottom] = useState(true);

  const scrollRef = useRef(null);
  const timerRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const fn = team ? window.api.discloud.teamLogs : window.api.discloud.logs;
      const res = await fn(appId);
      const text =
        res?.apps?.terminal?.big ||
        res?.apps?.terminal?.small ||
        res?.terminal?.big ||
        res?.terminal?.small ||
        res?.logs ||
        (typeof res === 'string' ? res : JSON.stringify(res, null, 2));
      setRaw(text);
      setLastFetch(Date.now());
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // primeira carga + auto-refresh
  useEffect(() => { load(); }, [appId]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoRefresh) {
      timerRef.current = setInterval(load, 5000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [autoRefresh, appId]);

  // auto-scroll pro fim quando chega log novo (se stickToBottom)
  useEffect(() => {
    if (stickToBottom && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [raw, stickToBottom]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20;
    setStickToBottom(atBottom);
  };

  const lines = useMemo(() => raw.split('\n'), [raw]);
  const filtered = useMemo(() => {
    if (!query.trim()) return lines.map((l, i) => ({ text: l, idx: i }));
    const q = query.toLowerCase();
    return lines
      .map((l, i) => ({ text: l, idx: i }))
      .filter(({ text }) => text.toLowerCase().includes(q));
  }, [lines, query]);

  const matchCount = query.trim() ? filtered.length : null;

  const copyAll = async () => {
    try { await navigator.clipboard.writeText(raw); } catch {}
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setStickToBottom(true);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-8">
      <div className="card w-full max-w-5xl h-[85vh] flex flex-col">
        {/* header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border gap-3">
          <h2 className="font-semibold text-sm shrink-0">
            {t('logs.title')} · <span className="font-mono text-mute">{appId}</span>
          </h2>

          <div className="flex-1 relative max-w-sm">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mute" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('logs.search')}
              className="selectable w-full bg-panel2 border border-border rounded-lg pl-7 pr-12 py-1 text-xs focus:outline-none focus:border-accent"
            />
            {matchCount !== null && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-mute">
                {matchCount}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[10px] text-mute mr-1">
              {lastFetch && `${t('logs.lastUpdate')} ${fmtTime(lastFetch)}`}
            </span>
            <button
              className={`btn !py-1 !px-2 ${autoRefresh ? 'bg-success/15 border-success/30 text-success' : ''}`}
              onClick={() => setAutoRefresh(!autoRefresh)}
              title={autoRefresh ? t('logs.pauseAuto') : t('logs.resumeAuto')}
            >
              {autoRefresh ? <Pause size={12} /> : <Play size={12} />}
            </button>
            <button className="btn !py-1 !px-2" onClick={load} disabled={loading} title={t('logs.refreshNow')}>
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            </button>
            <button className="btn !py-1 !px-2" onClick={copyAll} title={t('logs.copyAll')}>
              <Copy size={12} />
            </button>
            <button className="btn !py-1 !px-2" onClick={onClose} title={t('logs.close')}>
              <X size={12} />
            </button>
          </div>
        </div>

        {/* log body */}
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="selectable flex-1 overflow-auto bg-bg font-mono text-[12px] leading-relaxed"
        >
          {error && (
            <div className="p-4 text-danger">{t('logs.errorPrefix')} {error}</div>
          )}
          {!error && filtered.length === 0 && (
            <div className="p-4 text-mute text-center">
              {loading ? t('logs.loading') : query.trim() ? t('logs.noMatch') : t('logs.empty')}
            </div>
          )}
          {!error && filtered.map(({ text, idx }) => (
            <div
              key={idx}
              className={`px-4 py-0.5 hover:bg-panel2/50 ${colorClass(text)}`}
            >
              <span className="inline-block w-10 text-mute/60 select-none text-right pr-3">{idx + 1}</span>
              <span className="whitespace-pre-wrap break-words">
                {highlight(text, query)}
              </span>
            </div>
          ))}
        </div>

        {/* footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border text-[11px] text-mute">
          <span>{lines.length} {t('logs.lines')} {query.trim() && `· ${matchCount} ${t('logs.filtered')}`}</span>
          {!stickToBottom && (
            <button
              className="flex items-center gap-1 text-accent hover:underline"
              onClick={scrollToBottom}
            >
              <ArrowDownToLine size={10} /> {t('logs.goToEnd')}
            </button>
          )}
          {stickToBottom && autoRefresh && (
            <span className="text-success">{t('logs.live')}</span>
          )}
        </div>
      </div>
    </div>
  );
}
