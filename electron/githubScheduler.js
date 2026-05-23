// Polling de auto-deploy via GitHub.
// A cada N min checa o SHA da branch dos apps com autoDeploy ativo.
// Se mudou desde lastSHA, baixa o zip e dispara commit no Discloud.
const fs = require('node:fs');
const logger = require('./logger');
const { branchInfo, downloadZip } = require('./github');

class GithubScheduler {
  constructor({ store, getClient, onNotify, onDeployed }) {
    this.store = store;
    this.getClient = getClient;
    this.onNotify = onNotify || (() => {});
    this.onDeployed = onDeployed || (() => {});
    this.timer = null;
    this.intervalMs = 5 * 60_000;
    this.running = new Set();
  }

  start() {
    this.stop();
    logger.info('[github] scheduler started');
    this.timer = setInterval(() => this._tick().catch((e) => logger.error('[github] tick error', e?.message)), this.intervalMs);
    setTimeout(() => this._tick().catch(() => {}), 10_000);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  _getLinks() { return this.store.get('githubLinks') || {}; }
  _saveLink(appId, link) {
    const all = this._getLinks();
    if (link == null) delete all[appId];
    else all[appId] = link;
    this.store.set('githubLinks', all);
  }
  _token() { return this.store.get('githubToken') || null; }

  async _tick() {
    const links = this._getLinks();
    const token = this._token();
    for (const [appId, link] of Object.entries(links)) {
      if (!link || !link.autoDeploy) continue;
      if (this.running.has(appId)) continue;
      try {
        const info = await branchInfo(link.repo, link.branch, token);
        if (!info.sha) continue;
        if (info.sha === link.lastSHA) continue; // sem novidade
        logger.info('[github] new commit detected for', appId, info.shortSha, '(previous:', (link.lastSHA || 'none').slice(0, 7), ')');
        await this.deployNow(appId, { triggeredBy: 'auto', knownInfo: info });
      } catch (e) {
        logger.warn('[github] check failed for', appId, e?.message);
      }
    }
  }

  async deployNow(appId, { triggeredBy = 'manual', knownInfo = null } = {}) {
    if (this.running.has(appId)) throw new Error('deploy do GitHub já está rodando para esse app');
    const link = this._getLinks()[appId];
    if (!link) throw new Error('App não está vinculado a um repositório GitHub');
    const token = this._token();
    const client = this.getClient();
    if (!client) throw new Error('Cliente Discloud não disponível');

    this.running.add(appId);
    let zipPath = null;
    try {
      const info = knownInfo || await branchInfo(link.repo, link.branch, token);
      const dl = await downloadZip(link.repo, info.sha, token);
      zipPath = dl.path;

      const isTeam = !!link.team;
      const commitFn = isTeam ? client.teamCommit.bind(client) : client.commit.bind(client);
      let buildLog = '';
      const res = await commitFn(appId, zipPath, {
        onBuildOutput: (text) => { buildLog = text; }
      });
      if (!buildLog && res?._buildOutput) buildLog = res._buildOutput;

      this._saveLink(appId, {
        ...link,
        lastSHA: info.sha,
        lastShortSha: info.shortSha,
        lastMessage: info.message,
        lastDeployAt: Date.now(),
        lastTrigger: triggeredBy
      });

      this.onNotify({
        title: triggeredBy === 'auto' ? 'Auto-deploy GitHub' : 'Deploy GitHub concluído',
        body: `${link.repo}@${info.shortSha} → ${appId}: ${res?.message || 'enviado'}`,
        success: true,
        appId
      });
      this.onDeployed({ appId, repo: link.repo, sha: info.sha, fileSize: dl.size, fileName: dl.name, success: true, message: res?.message || 'enviado', buildLog, triggeredBy });
      return { success: true, sha: info.sha, message: res?.message };
    } catch (e) {
      logger.error('[github] deploy failed for', appId, e?.message, e?.stack);
      this.onNotify({
        title: 'Falha no deploy GitHub',
        body: `${appId}: ${e?.message || 'erro desconhecido'}`,
        success: false,
        appId
      });
      this.onDeployed({ appId, repo: link.repo, success: false, message: e?.message || String(e), buildLog: e?.buildOutput || '', triggeredBy });
      throw e;
    } finally {
      this.running.delete(appId);
      if (zipPath) {
        try { await fs.promises.unlink(zipPath); } catch {}
      }
    }
  }

  isRunning(appId) {
    return this.running.has(appId);
  }
}

module.exports = { GithubScheduler };
