import React, { useEffect, useState } from 'react';
import { AlertTriangle, Trash2, FolderOpen, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';

function fmtWhen(ts) {
  return new Date(ts).toLocaleString('pt-BR');
}

function sourceColor(source) {
  if (source === 'main') return 'bg-danger/15 text-danger';
  if (source === 'renderer') return 'bg-warn/15 text-warn';
  return 'bg-border text-mute';
}

export default function ErrorLogCard() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openIdx, setOpenIdx] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const list = await window.api.errors.list();
      setEntries(Array.isArray(list) ? list : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onClear = async () => {
    if (!entries.length) return;
    if (!window.confirm('Apagar todos os erros registrados?')) return;
    await window.api.errors.clear();
    await load();
  };

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-warn" />
          <h3 className="text-sm font-semibold">Erros recentes</h3>
          <span className="text-xs text-mute">({entries.length})</span>
        </div>
        <div className="flex items-center gap-1">
          <button className="btn !py-1 !px-2 text-xs" onClick={load} title="Recarregar">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
          <button className="btn !py-1 !px-2 text-xs" onClick={() => window.api.errors.openFolder()} title="Abrir pasta">
            <FolderOpen size={12} />
          </button>
          <button
            className="btn !py-1 !px-2 text-xs hover:!bg-danger/15 hover:!text-danger disabled:opacity-50"
            onClick={onClear}
            disabled={!entries.length}
            title="Limpar"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      <p className="text-xs text-mute leading-relaxed">
        Erros capturados localmente do processo principal e da interface. Nada é enviado pra fora. Cap em 200 entradas;
        as mais antigas são descartadas.
      </p>

      {entries.length === 0 ? (
        <div className="text-xs text-mute italic text-center py-4">
          Nenhum erro registrado.
        </div>
      ) : (
        <div className="max-h-80 overflow-auto -mx-2">
          {entries.map((e, i) => {
            const open = openIdx === i;
            return (
              <div key={i} className="border-b border-border last:border-0">
                <button
                  className="w-full px-2 py-2 flex items-start gap-2 text-left hover:bg-border/30"
                  onClick={() => setOpenIdx(open ? null : i)}
                >
                  {open ? <ChevronDown size={12} className="mt-1 shrink-0 text-mute" /> : <ChevronRight size={12} className="mt-1 shrink-0 text-mute" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`chip text-[10px] ${sourceColor(e.source)}`}>{e.source}</span>
                      <span className="text-[10px] text-mute font-mono">{e.type}</span>
                      <span className="text-[10px] text-mute ml-auto">{fmtWhen(e.ts)}</span>
                    </div>
                    <div className="text-xs text-text mt-1 truncate font-mono">{e.message || '(sem mensagem)'}</div>
                  </div>
                </button>
                {open && (
                  <div className="px-4 pb-3 space-y-2 text-[11px]">
                    {e.url && (
                      <div className="text-mute font-mono break-all">
                        {e.url}{e.line != null ? `:${e.line}${e.col != null ? `:${e.col}` : ''}` : ''}
                      </div>
                    )}
                    {e.stack && (
                      <pre className="bg-bg p-2 rounded border border-border overflow-auto max-h-48 whitespace-pre-wrap font-mono text-mute">
                        {e.stack}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
