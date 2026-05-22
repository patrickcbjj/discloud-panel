import React, { useEffect, useState } from 'react';
import { Github, Zap, RefreshCw, Unlink, Link2, ExternalLink, AlertTriangle, CheckCircle2, ChevronRight, ChevronDown, HelpCircle } from 'lucide-react';
import { useT, useI18n } from '../i18n.js';

function relTimeFn(t, locale, ts) {
  if (!ts) return null;
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return t('github.relNow');
  if (s < 3600) return t('github.relMin', { n: Math.floor(s / 60) });
  if (s < 86400) return t('github.relHour', { n: Math.floor(s / 3600) });
  return new Date(ts).toLocaleString(locale === 'en' ? 'en-US' : 'pt-BR');
}

export default function GithubCard({ app }) {
  const t = useT();
  const { locale } = useI18n();
  const relTime = (ts) => relTimeFn(t, locale, ts);
  const [link, setLink] = useState(null);
  const [draft, setDraft] = useState({ repo: '', branch: 'main', autoDeploy: false });
  const [busy, setBusy] = useState(false);
  const [check, setCheck] = useState(null); // { ok, info, error }
  const [deployMsg, setDeployMsg] = useState(null);
  const [running, setRunning] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  const reload = async () => {
    const all = await window.api.github.getLinks();
    setLink(all[app.id] || null);
    setRunning(await window.api.github.isRunning(app.id));
  };

  useEffect(() => {
    reload();
    const offChange = window.api.onGithubLinkChanged(reload);
    const offDeploy = window.api.onGithubDeploy((p) => {
      if (p?.appId === app.id) reload();
    });
    return () => { offChange(); offDeploy(); };
  }, [app.id]);

  useEffect(() => {
    setDraft({
      repo: link?.repo || '',
      branch: link?.branch || 'main',
      autoDeploy: !!link?.autoDeploy
    });
    setCheck(null);
  }, [link]);

  const validate = async () => {
    if (!draft.repo.trim()) return;
    setBusy(true);
    setCheck(null);
    const res = await window.api.github.checkRepo(draft.repo.trim(), draft.branch.trim() || 'main');
    setCheck(res);
    setBusy(false);
  };

  const save = async () => {
    setBusy(true);
    const res = await window.api.github.checkRepo(draft.repo.trim(), draft.branch.trim() || 'main');
    if (!res.ok) {
      setCheck(res);
      setBusy(false);
      return;
    }
    await window.api.github.setLink(app.id, {
      repo: `${res.info.owner}/${res.info.repo}`,
      branch: res.info.branch,
      autoDeploy: draft.autoDeploy,
      team: !!app.team
    });
    setCheck(res);
    setBusy(false);
  };

  const unlink = async () => {
    await window.api.github.setLink(app.id, null);
  };

  const deployNow = async () => {
    setRunning(true);
    setDeployMsg(t('github.sendingHint'));
    const res = await window.api.github.deployNow(app.id);
    if (res?.ok) setDeployMsg(t('github.sent', { sha: (res.sha || '').slice(0, 7) }));
    else setDeployMsg(t('github.failed', { e: res?.error || t('github.unknownError') }));
    setRunning(await window.api.github.isRunning(app.id));
    setTimeout(() => setDeployMsg(null), 6000);
  };

  const toggleAuto = async (v) => {
    if (!link) return;
    await window.api.github.setLink(app.id, { ...link, autoDeploy: v, team: !!app.team });
  };

  if (link) {
    return (
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Github size={14} />
          {t('github.title')}
          <button
            type="button"
            onClick={() => window.api.openExternal(`https://github.com/${link.repo}/tree/${link.branch}`)}
            className="ml-2 text-xs text-accent hover:underline flex items-center gap-1"
            title={t('github.openRepo')}
          >
            {link.repo} @ {link.branch}
            <ExternalLink size={11} />
          </button>
        </div>

        <div className="text-xs text-mute space-y-1">
          {link.lastSHA ? (
            <>
              <div>
                {t('github.lastDeploy')} <span className="text-text font-mono">{link.lastShortSha || link.lastSHA.slice(0, 7)}</span>
                {' · '}
                <span>{relTime(link.lastDeployAt)}</span>
                {link.lastTrigger && (
                  <span className="ml-1 chip bg-panel2 text-[10px] py-0">{link.lastTrigger}</span>
                )}
              </div>
              {link.lastMessage && (
                <div className="text-mute italic truncate" title={link.lastMessage}>
                  "{link.lastMessage.split('\n')[0]}"
                </div>
              )}
            </>
          ) : (
            <div>{t('github.noDeployYet')}</div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button className="btn-primary" onClick={deployNow} disabled={running}>
            {running
              ? <RefreshCw size={13} className="inline mr-1 animate-spin" />
              : <Zap size={13} className="inline mr-1" />}
            {running ? t('github.deploying') : t('github.deployNow')}
          </button>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={!!link.autoDeploy}
              onChange={(e) => toggleAuto(e.target.checked)}
              className="accent-accent"
            />
            {t('github.autoDeploy')}
          </label>
          <button className="btn-danger ml-auto" onClick={unlink}>
            <Unlink size={13} className="inline mr-1" /> {t('github.unlink')}
          </button>
        </div>
        {deployMsg && <div className="text-xs text-mute">{deployMsg}</div>}
      </div>
    );
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Github size={14} />
        {t('github.linkTitle')}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2">
          <label className="text-xs uppercase text-mute tracking-wider">{t('github.repo')}</label>
          <input
            type="text"
            value={draft.repo}
            onChange={(e) => setDraft({ ...draft, repo: e.target.value })}
            placeholder="owner/repo"
            className="selectable w-full mt-1 bg-panel2 border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="text-xs uppercase text-mute tracking-wider">{t('github.branch')}</label>
          <input
            type="text"
            value={draft.branch}
            onChange={(e) => setDraft({ ...draft, branch: e.target.value })}
            placeholder="main"
            className="selectable w-full mt-1 bg-panel2 border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-accent"
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs cursor-pointer">
        <input
          type="checkbox"
          checked={draft.autoDeploy}
          onChange={(e) => setDraft({ ...draft, autoDeploy: e.target.checked })}
          className="accent-accent"
        />
        {t('github.autoDeploy')}
      </label>
      {check && check.ok && (
        <div className="text-xs text-success flex items-center gap-1">
          <CheckCircle2 size={11} /> {t('github.found', { sha: check.info.shortSha, author: check.info.author || t('github.unknownAuthor') })}
        </div>
      )}
      {check && !check.ok && (
        <div className="text-xs text-danger flex items-center gap-1">
          <AlertTriangle size={11} /> {check.error}
          {check.status === 404 && t('github.notFoundHint')}
          {check.status === 401 && t('github.invalidToken')}
        </div>
      )}
      <div className="border-t border-border pt-2">
        <button
          type="button"
          onClick={() => setTutorialOpen(!tutorialOpen)}
          className="flex items-center gap-1.5 text-xs text-mute hover:text-accent transition-colors"
        >
          {tutorialOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <HelpCircle size={12} />
          <span>{t('github.howToToggle')}</span>
        </button>
        {tutorialOpen && (
          <div className="mt-3 space-y-3 text-xs bg-panel2/50 border border-border rounded-lg p-3">
            <p className="text-mute italic">{t('github.tutFlow')}</p>

            <div>
              <div className="font-semibold text-text flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-accent/15 text-accent text-[10px] flex items-center justify-center">1</span>
                {t('github.tutStep1Title')}
              </div>
              <div className="text-mute mt-1 ml-5.5 pl-1">{t('github.tutStep1Desc')}</div>
              <pre className="selectable mt-1 ml-5 bg-bg border border-border rounded p-2 text-[10.5px] font-mono leading-relaxed overflow-x-auto">{`git init
git add .
git commit -m "primeiro commit"
git branch -M main
git remote add origin https://github.com/<owner>/<repo>.git
git push -u origin main`}</pre>
            </div>

            <div>
              <div className="font-semibold text-text flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-accent/15 text-accent text-[10px] flex items-center justify-center">2</span>
                {t('github.tutStep2Title')}
              </div>
              <div className="text-mute mt-1 ml-5 pl-1">
                {t('github.tutStep2Desc')}
                <button
                  type="button"
                  onClick={() => window.api.openExternal('https://github.com/settings/personal-access-tokens/new')}
                  className="text-accent hover:underline inline-flex items-center gap-0.5"
                >
                  github.com/settings/personal-access-tokens/new
                  <ExternalLink size={9} />
                </button>
                {t('github.tutStep2Perm')}
              </div>
            </div>

            <div>
              <div className="font-semibold text-text flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-accent/15 text-accent text-[10px] flex items-center justify-center">3</span>
                {t('github.tutStep3Title')}
              </div>
              <div className="text-mute mt-1 ml-5 pl-1">{t('github.tutStep3Desc')}</div>
            </div>

            <div className="border-t border-border pt-2">
              <div className="font-semibold text-warn text-[11px] flex items-center gap-1">
                <AlertTriangle size={11} />
                {t('github.tutTipsTitle')}
              </div>
              <ul className="mt-1 text-mute space-y-0.5 list-disc list-inside ml-1 text-[11px]">
                <li>{t('github.tutTip404')}</li>
                <li>{t('github.tutTipBranch')}</li>
                <li>{t('github.tutTipBig')}</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button className="btn" onClick={validate} disabled={busy || !draft.repo.trim()}>
          {t('github.check')}
        </button>
        <button className="btn-primary" onClick={save} disabled={busy || !draft.repo.trim()}>
          <Link2 size={13} className="inline mr-1" /> {t('github.link')}
        </button>
      </div>
    </div>
  );
}
