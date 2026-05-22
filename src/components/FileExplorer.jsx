import React, { useEffect, useState, useRef } from 'react';
import {
  FolderOpen, FileText, ChevronRight, ArrowLeft, RefreshCw, Save, Plus, Folder, File as FileIcon,
  Terminal, X, AlertTriangle, CheckCircle2, Play, FilePlus, Tag as RenameIcon, Pencil, Copy, Scissors, Trash2, ClipboardPaste, ChevronDown
} from 'lucide-react';
import { useT } from '../i18n.js';
import { useCollapsed } from '../hooks/useCollapsed.js';

// shell-quote: envolve em aspas simples e escapa '
function sh(s) {
  return `'${String(s).replace(/'/g, "'\\''")}'`;
}

const TEXT_EXTS = ['.env', '.json', '.js', '.jsx', '.ts', '.tsx', '.html', '.css', '.md', '.yml', '.yaml', '.config', '.txt', '.log', '.toml', '.ini', '.xml', '.sh', '.py', '.rb', '.go', '.rs', '.lua', '.gitignore'];

function isTextFile(name) {
  const n = String(name || '').toLowerCase();
  if (n.startsWith('.')) return true;
  return TEXT_EXTS.some((ext) => n.endsWith(ext));
}

function fmtSize(n) {
  if (n == null) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function joinPath(base, name) {
  if (base === '/' || !base) return '/' + name;
  return base.replace(/\/$/, '') + '/' + name;
}

function parentOf(p) {
  if (!p || p === '/' || p === '') return '/';
  const parts = p.replace(/\/$/, '').split('/').filter(Boolean);
  parts.pop();
  return '/' + parts.join('/');
}

export default function FileExplorer({ app }) {
  const t = useT();
  const isTeam = !!app.team;
  const [collapsed, toggleCollapsed] = useCollapsed(app.id, 'fileExplorer', true);
  const [path, setPath] = useState(null);     // caminho absoluto atual
  const [workdir, setWorkdir] = useState(null); // raiz (workDir do app)
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [selected, setSelected] = useState(null); // { path, name, content }
  const [editorText, setEditorText] = useState('');
  const [editorDirty, setEditorDirty] = useState(false);
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorSavedAt, setEditorSavedAt] = useState(0);

  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createType, setCreateType] = useState('file');
  const [creating, setCreating] = useState(false);

  const [execOpen, setExecOpen] = useState(false);
  const [execCmd, setExecCmd] = useState('');
  const [execResult, setExecResult] = useState(null);
  const [execRunning, setExecRunning] = useState(false);

  // Context menu + clipboard
  const [menu, setMenu] = useState(null); // { x, y, entry }
  const [clipboard, setClipboard] = useState(null); // { action: 'copy'|'cut', path, name }
  const [actionBusy, setActionBusy] = useState(null);

  const load = async (p = null) => {
    setLoading(true); setErr(null);
    try {
      const res = await window.api.discloud.explorer(app.id, isTeam, p);

      // A API Discloud retorna dir como objeto:
      //   { "pasta_atual": { "arquivo.x": {name, size, type, ...}, ... } }
      // Desempacota até achar entries com `type`.
      function unwrap(obj) {
        if (Array.isArray(obj)) return obj;
        if (!obj || typeof obj !== 'object') return [];
        const values = Object.values(obj);
        const looksLikeEntries = values.length > 0 && values.every(
          (v) => v && typeof v === 'object' && ('type' in v || 'size' in v)
        );
        if (looksLikeEntries) {
          return Object.entries(obj).map(([name, v]) => ({ name, ...v }));
        }
        // wrapper único — desce um nível
        if (values.length === 1 && typeof values[0] === 'object') {
          return unwrap(values[0]);
        }
        return [];
      }

      const list = unwrap(res?.dir ?? res?.files ?? res?.entries ?? res?.data);

      const normalized = list.map((e) => ({
        name: e.name || e.fileName || e.title || '',
        type: (e.type === 'directory' || e.type === 'folder' || e.isDirectory || e.kind === 'dir')
          ? 'directory'
          : 'file',
        size: e.size ?? e.bytes ?? null
      })).filter((e) => e.name);

      const sorted = normalized.sort((a, b) => {
        const aDir = a.type === 'directory' ? 0 : 1;
        const bDir = b.type === 'directory' ? 0 : 1;
        if (aDir !== bDir) return aDir - bDir;
        return a.name.localeCompare(b.name);
      });
      setEntries(sorted);
      const actual = res?.path || res?.currentPath || p || '/';
      setPath(actual);
      if (!workdir) setWorkdir(actual);
    } catch (e) {
      console.error('[explorer] load failed', e);
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setWorkdir(null); setPath(null); load(null); /* eslint-disable-next-line */ }, [app.id]);

  const atRoot = !workdir || path === workdir;

  const openEntry = async (entry) => {
    if (entry.type === 'directory') {
      setSelected(null);
      await load(joinPath(path, entry.name));
      return;
    }
    if (!isTextFile(entry.name)) {
      setErr(t('explorer.binary'));
      return;
    }
    const fp = joinPath(path, entry.name);
    setLoading(true); setErr(null);
    try {
      const res = await window.api.discloud.explorerOpen(app.id, isTeam, fp);
      const content = res?.content ?? '';
      setSelected({ path: fp, name: entry.name });
      setEditorText(content);
      setEditorDirty(false);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const saveFile = async () => {
    if (!selected) return;
    setEditorSaving(true); setErr(null);
    try {
      await window.api.discloud.explorerEdit(app.id, isTeam, selected.path, editorText);
      setEditorSavedAt(Date.now());
      setEditorDirty(false);
      setTimeout(() => setEditorSavedAt(0), 2500);
    } catch (e) {
      setErr(e.message);
    } finally { setEditorSaving(false); }
  };

  const closeEditor = () => {
    if (editorDirty && !confirm(t('explorer.unsavedDiscard'))) return;
    setSelected(null);
    setEditorText('');
    setEditorDirty(false);
  };

  const createEntry = async () => {
    if (!createName.trim()) return;
    setCreating(true); setErr(null);
    try {
      const fp = joinPath(path, createName.trim());
      await window.api.discloud.explorerCreate(app.id, isTeam, fp, createType);
      setCreateName(''); setShowCreate(false);
      await load(path);
    } catch (e) {
      setErr(e.message);
    } finally { setCreating(false); }
  };

  // ---------- Context menu actions ----------
  const closeMenu = () => setMenu(null);
  const openMenu = (e, entry) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, entry });
  };

  const runShell = async (cmd, label) => {
    setActionBusy(label);
    setErr(null);
    try {
      const res = await window.api.discloud.exec(app.id, isTeam, cmd);
      const exec = res?.exec;
      if (exec && exec.exitCode !== 0) {
        throw new Error(`exit ${exec.exitCode}: ${exec.stderr || exec.stdout || t('explorer.failed')}`);
      }
      await load(path);
    } catch (e) {
      setErr(`${label}: ${e.message}`);
    } finally {
      setActionBusy(null);
    }
  };

  const actionRename = async (entry) => {
    closeMenu();
    const nv = window.prompt(t('explorer.promptRename'), entry.name);
    if (!nv || nv === entry.name) return;
    if (/[\/]/.test(nv)) { setErr(t('explorer.invalidName')); return; }
    const src = joinPath(path, entry.name);
    const dst = joinPath(path, nv);
    await runShell(`mv ${sh(src)} ${sh(dst)}`, t('explorer.shellRename'));
  };

  const actionEdit = (entry) => {
    closeMenu();
    if (entry.type === 'directory') return;
    openEntry(entry);
  };

  const actionCopy = (entry) => {
    closeMenu();
    setClipboard({ action: 'copy', path: joinPath(path, entry.name), name: entry.name, type: entry.type });
  };

  const actionCut = (entry) => {
    closeMenu();
    setClipboard({ action: 'cut', path: joinPath(path, entry.name), name: entry.name, type: entry.type });
  };

  const actionDelete = async (entry) => {
    closeMenu();
    if (!window.confirm(t('explorer.confirmDelete', { name: entry.name, dir: entry.type === 'directory' ? t('explorer.deleteDir') : '' }))) return;
    const target = joinPath(path, entry.name);
    await runShell(`rm -rf ${sh(target)}`, t('explorer.shellDelete'));
  };

  const actionPaste = async () => {
    if (!clipboard) return;
    const dst = joinPath(path, clipboard.name);
    if (dst === clipboard.path) { setErr(t('explorer.samePath')); return; }
    const flag = clipboard.type === 'directory' && clipboard.action === 'copy' ? '-r ' : '';
    const cmd = clipboard.action === 'cut'
      ? `mv ${sh(clipboard.path)} ${sh(dst)}`
      : `cp ${flag}${sh(clipboard.path)} ${sh(dst)}`;
    await runShell(cmd, clipboard.action === 'cut' ? t('explorer.pasteCut') : t('explorer.pasteCopy'));
    if (clipboard.action === 'cut') setClipboard(null);
  };

  // fechar menu ao clicar em qualquer lugar
  useEffect(() => {
    if (!menu) return;
    const off = () => closeMenu();
    window.addEventListener('click', off);
    window.addEventListener('contextmenu', (e) => { if (!e.target.closest('[data-fileexplorer-menu]')) closeMenu(); });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
    return () => {
      window.removeEventListener('click', off);
    };
  }, [menu]);

  const runExec = async () => {
    if (!execCmd.trim()) return;
    setExecRunning(true);
    try {
      const res = await window.api.discloud.exec(app.id, isTeam, execCmd.trim());
      setExecResult(res?.exec || { stdout: '', stderr: res?.message || t('explorer.noReturn'), exitCode: -1 });
    } catch (e) {
      setExecResult({ stdout: '', stderr: e.message, exitCode: -1 });
    } finally { setExecRunning(false); }
  };

  // breadcrumb: só mostra o que está abaixo do workdir
  const relPath = (workdir && path && path.startsWith(workdir))
    ? path.slice(workdir.length).replace(/^\//, '')
    : '';
  const crumbs = relPath ? relPath.split('/').filter(Boolean) : [];

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <button
          type="button"
          onClick={toggleCollapsed}
          className="flex items-center gap-2 text-left"
          title={collapsed ? t('common.expand') : t('common.collapse')}
        >
          {collapsed ? <ChevronRight size={14} className="text-mute" /> : <ChevronDown size={14} className="text-mute" />}
          <FolderOpen size={14} className="text-mute" />
          {t('explorer.title')}
        </button>
        {!collapsed && (
        <div className="ml-auto flex items-center gap-1">
          {clipboard && (
            <button
              className="px-2 py-1 text-[11px] rounded bg-accent/15 text-accent hover:bg-accent/25"
              onClick={actionPaste}
              title={t('explorer.copyCutLabel', { a: clipboard.action === 'cut' ? t('explorer.cut') : t('explorer.copy'), name: clipboard.name })}
            >
              <ClipboardPaste size={11} className="inline mr-1" />
              {t('explorer.paste')}
              <span className="ml-1 opacity-70">({clipboard.name})</span>
              <button
                onClick={(e) => { e.stopPropagation(); setClipboard(null); }}
                className="ml-1 hover:text-text opacity-60 hover:opacity-100"
                title={t('explorer.cancel')}
              >
                <X size={9} className="inline" />
              </button>
            </button>
          )}
          {actionBusy && (
            <span className="text-[10px] text-mute flex items-center gap-1">
              <RefreshCw size={10} className="animate-spin" /> {actionBusy}…
            </span>
          )}
          <button className="px-2 py-1 text-[11px] rounded bg-panel2 text-mute hover:text-text" onClick={() => setShowCreate(!showCreate)} title={t('explorer.createTip')}>
            <Plus size={11} className="inline" /> {t('explorer.createBtn')}
          </button>
          <button className="px-2 py-1 text-[11px] rounded bg-panel2 text-mute hover:text-text" onClick={() => setExecOpen(true)} title={t('explorer.execTip')}>
            <Terminal size={11} className="inline" /> {t('explorer.execBtn')}
          </button>
          <button className="px-2 py-1 text-[11px] rounded bg-panel2 text-mute hover:text-text" onClick={() => load(path)} title={t('explorer.reloadTip')}>
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        )}
      </div>

      {!collapsed && (<>
      {/* breadcrumb (relativo ao workdir do app) */}
      <div className="flex items-center gap-1 text-xs text-mute flex-wrap">
        <button onClick={() => { setSelected(null); load(workdir); }} className="hover:text-text" title={workdir || ''}>
          <Folder size={11} className="inline mr-0.5" /> {t('explorer.root')}
        </button>
        {crumbs.map((c, i) => {
          const full = (workdir || '') + '/' + crumbs.slice(0, i + 1).join('/');
          return (
            <React.Fragment key={i}>
              <ChevronRight size={11} />
              <button onClick={() => { setSelected(null); load(full); }} className="hover:text-text">{c}</button>
            </React.Fragment>
          );
        })}
        {selected && (
          <>
            <ChevronRight size={11} />
            <span className="text-accent">{selected.name}</span>
          </>
        )}
      </div>

      {err && (
        <div className="text-xs text-danger flex items-center gap-1">
          <AlertTriangle size={12} /> {err}
        </div>
      )}

      {showCreate && (
        <div className="bg-panel2 border border-border rounded-lg p-2.5 flex items-center gap-2">
          <select
            value={createType}
            onChange={(e) => setCreateType(e.target.value)}
            className="bg-panel border border-border rounded-lg px-2 py-1 text-xs"
          >
            <option value="file">{t('explorer.file')}</option>
            <option value="directory">{t('explorer.folder')}</option>
          </select>
          <input
            type="text"
            autoFocus
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createEntry()}
            placeholder={createType === 'file' ? t('explorer.newFilePh') : t('explorer.newFolderPh')}
            className="selectable flex-1 bg-panel border border-border rounded-lg px-2 py-1 text-xs font-mono"
          />
          <button className="btn-primary" onClick={createEntry} disabled={creating || !createName.trim()}>
            <FilePlus size={12} className="inline mr-1" /> {t('explorer.createBtn')}
          </button>
          <button className="text-mute hover:text-text" onClick={() => { setShowCreate(false); setCreateName(''); }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* layout: lista + editor lado a lado quando selecionado, senão só lista */}
      <div className={`grid gap-3 ${selected ? 'grid-cols-1 lg:grid-cols-[260px_1fr]' : 'grid-cols-1'}`}>
        {/* lista */}
        <div className="bg-panel2 border border-border rounded-lg max-h-96 overflow-y-auto">
          {!atRoot && (
            <button
              onClick={() => { setSelected(null); load(parentOf(path)); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-mute hover:bg-border"
            >
              <ArrowLeft size={11} /> {t('explorer.back')}
            </button>
          )}
          {entries.length === 0 && !loading && (
            <div className="text-xs text-mute text-center py-4">{t('explorer.emptyFolder')}</div>
          )}
          {entries.map((e, i) => (
            <button
              key={i}
              onClick={() => openEntry(e)}
              onContextMenu={(ev) => openMenu(ev, e)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-border text-left ${
                selected?.name === e.name ? 'bg-border text-text' : ''
              } ${clipboard && clipboard.action === 'cut' && clipboard.path === joinPath(path, e.name) ? 'opacity-50' : ''}`}
            >
              {e.type === 'directory'
                ? <Folder size={12} className="text-accent shrink-0" />
                : <FileIcon size={12} className="text-mute shrink-0" />}
              <span className="truncate flex-1">{e.name}</span>
              {e.type !== 'directory' && (
                <span className="text-mute text-[10px] shrink-0">{fmtSize(e.size)}</span>
              )}
            </button>
          ))}
        </div>

        {/* editor */}
        {selected && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs text-mute font-mono truncate">{selected.path}</div>
              <button onClick={closeEditor} className="text-mute hover:text-text" title={t('explorer.close')}>
                <X size={14} />
              </button>
            </div>
            <textarea
              value={editorText}
              onChange={(e) => { setEditorText(e.target.value); setEditorDirty(true); }}
              rows={16}
              spellCheck={false}
              className="selectable w-full bg-panel2 border border-border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-accent resize-y"
            />
            <div className="flex items-center gap-2">
              <button className="btn-primary" onClick={saveFile} disabled={editorSaving || !editorDirty}>
                {editorSavedAt
                  ? <CheckCircle2 size={13} className="inline mr-1" />
                  : editorSaving
                    ? <RefreshCw size={13} className="inline mr-1 animate-spin" />
                    : <Save size={13} className="inline mr-1" />}
                {editorSavedAt ? t('explorer.saved') : editorSaving ? t('explorer.saving') : t('explorer.save')}
              </button>
              {editorDirty && <span className="text-xs text-warn">{t('explorer.unsaved')}</span>}
            </div>
          </div>
        )}
      </div>

      {/* context menu */}
      {menu && (
        <div
          data-fileexplorer-menu
          style={{ left: menu.x, top: menu.y }}
          className="fixed z-50 bg-panel border border-border rounded-lg shadow-xl py-1 min-w-[160px]"
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button onClick={() => actionRename(menu.entry)} className="w-full px-3 py-1.5 text-xs text-left hover:bg-panel2 flex items-center gap-2">
            <RenameIcon size={12} /> {t('explorer.rename')}
          </button>
          {menu.entry.type !== 'directory' && isTextFile(menu.entry.name) && (
            <button onClick={() => actionEdit(menu.entry)} className="w-full px-3 py-1.5 text-xs text-left hover:bg-panel2 flex items-center gap-2">
              <Pencil size={12} /> {t('explorer.edit')}
            </button>
          )}
          <button onClick={() => actionCopy(menu.entry)} className="w-full px-3 py-1.5 text-xs text-left hover:bg-panel2 flex items-center gap-2">
            <Copy size={12} /> {t('explorer.copy')}
          </button>
          <button onClick={() => actionCut(menu.entry)} className="w-full px-3 py-1.5 text-xs text-left hover:bg-panel2 flex items-center gap-2">
            <Scissors size={12} /> {t('explorer.cut')}
          </button>
          <div className="border-t border-border my-1" />
          <button onClick={() => actionDelete(menu.entry)} className="w-full px-3 py-1.5 text-xs text-left hover:bg-danger/15 text-danger flex items-center gap-2">
            <Trash2 size={12} /> {t('explorer.deleteItem')}
          </button>
        </div>
      )}

      {/* exec modal */}
      {execOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6">
          <div className="bg-panel border border-border rounded-xl w-full max-w-2xl flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-border flex items-center gap-2">
              <Terminal size={14} className="text-mute" />
              <div className="text-sm font-semibold">{t('explorer.execTitle', { n: app.name })}</div>
              <button onClick={() => { setExecOpen(false); setExecResult(null); }} className="ml-auto text-mute hover:text-text">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto">
              <div className="flex gap-2">
                <input
                  type="text"
                  autoFocus
                  value={execCmd}
                  onChange={(e) => setExecCmd(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !execRunning && runExec()}
                  placeholder={t('explorer.cmdPlaceholder')}
                  className="selectable flex-1 bg-panel2 border border-border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-accent"
                />
                <button className="btn-primary" onClick={runExec} disabled={execRunning || !execCmd.trim()}>
                  {execRunning ? <RefreshCw size={13} className="inline mr-1 animate-spin" /> : <Play size={13} className="inline mr-1" />}
                  {execRunning ? t('explorer.running') : t('explorer.run')}
                </button>
              </div>
              <p className="text-xs text-mute">
                {t('explorer.runHint')}
              </p>
              {execResult && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-mute">{t('explorer.exitCode')}</span>
                    <span className={`font-mono ${execResult.exitCode === 0 ? 'text-success' : 'text-danger'}`}>
                      {execResult.exitCode ?? '?'}
                    </span>
                  </div>
                  {execResult.stdout && (
                    <div>
                      <div className="text-xs text-mute mb-1">stdout</div>
                      <pre className="selectable bg-panel2 border border-border rounded-lg p-3 text-xs font-mono overflow-x-auto max-h-64">{execResult.stdout}</pre>
                    </div>
                  )}
                  {execResult.stderr && (
                    <div>
                      <div className="text-xs text-danger mb-1">stderr</div>
                      <pre className="selectable bg-panel2 border border-danger/30 rounded-lg p-3 text-xs font-mono overflow-x-auto max-h-64 text-danger">{execResult.stderr}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </>)}
    </div>
  );
}
