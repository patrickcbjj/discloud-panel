const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('api', {
  config: {
    get: (k) => invoke('config:get', k),
    set: (k, v) => invoke('config:set', k, v),
    hasToken: () => invoke('config:hasToken')
  },
  discloud: {
    user: () => invoke('api:user'),
    allStatus: () => invoke('api:allStatus'),
    app: (id) => invoke('api:app', id),
    status: (id) => invoke('api:status', id),
    logs: (id) => invoke('api:logs', id),
    start: (id) => invoke('api:start', id),
    stop: (id) => invoke('api:stop', id),
    restart: (id) => invoke('api:restart', id),
    backup: (id) => invoke('api:backup', id),
    setRam: (id, ram) => invoke('api:setRam', id, ram),
    commit: (id, filePath) => invoke('api:commit', id, filePath),
    team: () => invoke('api:team'),
    teamStatus: (id) => invoke('api:teamStatus', id),
    teamLogs: (id) => invoke('api:teamLogs', id),
    teamStart: (id) => invoke('api:teamStart', id),
    teamStop: (id) => invoke('api:teamStop', id),
    teamRestart: (id) => invoke('api:teamRestart', id),
    teamBackup: (id) => invoke('api:teamBackup', id),
    teamSetRam: (id, ram) => invoke('api:teamSetRam', id, ram),
    teamCommit: (id, filePath) => invoke('api:teamCommit', id, filePath),
    explorer:       (id, team, cPath) => invoke('api:explorer', id, team, cPath),
    explorerOpen:   (id, team, cPath) => invoke('api:explorerOpen', id, team, cPath),
    explorerCreate: (id, team, cPath, typeFile) => invoke('api:explorerCreate', id, team, cPath, typeFile),
    explorerEdit:   (id, team, cPath, content) => invoke('api:explorerEdit', id, team, cPath, content),
    exec:           (id, team, cmd) => invoke('api:exec', id, team, cmd),
    serviceStatus:  () => invoke('discloud:serviceStatus'),
    probeStatus:    () => invoke('discloud:probeNow')
  },
  dialog: {
    openZip: () => invoke('dialog:openZip')
  },
  fs: {
    statFile: (filePath) => invoke('fs:statFile', filePath)
  },
  db: {
    history: (id, sinceMs) => invoke('db:history', id, sinceMs),
    latest: (id) => invoke('db:latest', id),
    restarts: (id, sinceMs) => invoke('db:restarts', id, sinceMs),
    purgeOlderThan: (ms) => invoke('db:purgeOlderThan', ms),
    insertDeploy: (id, info) => invoke('db:insertDeploy', id, info),
    deploys: (id, limit) => invoke('db:deploys', id, limit),
    deployBuildLog: (id, ts) => invoke('db:deployBuildLog', id, ts),
    slaStats: (sinceMs, appId) => invoke('db:slaStats', sinceMs, appId)
  },
  poller: {
    tickNow: () => invoke('poller:tickNow')
  },
  window: {
    hide: () => invoke('window:hide'),
    minimize: () => invoke('window:minimize'),
    setTheme: (theme) => invoke('window:setTheme', theme)
  },
  app: {
    quit: () => invoke('app:quit'),
    info: () => invoke('app:info')
  },
  export: {
    run: (opts) => invoke('export:run', opts)
  },
  notes: {
    getAll: () => invoke('notes:getAll'),
    set: (appId, data) => invoke('notes:set', appId, data)
  },
  github: {
    getLinks: () => invoke('github:getLinks'),
    setLink: (appId, data) => invoke('github:setLink', appId, data),
    checkRepo: (repo, branch) => invoke('github:checkRepo', repo, branch),
    deployNow: (appId) => invoke('github:deployNow', appId),
    isRunning: (appId) => invoke('github:isRunning', appId)
  },
  backup: {
    runNow: () => invoke('backup:runNow'),
    history: () => invoke('backup:history'),
    isRunning: () => invoke('backup:isRunning'),
    getFolder: () => invoke('backup:getFolder'),
    openFolder: () => invoke('backup:openFolder'),
    chooseFolder: () => invoke('backup:chooseFolder')
  },
  updater: {
    state: () => invoke('updater:state'),
    checkNow: () => invoke('updater:checkNow'),
    download: () => invoke('updater:download'),
    quitAndInstall: () => invoke('updater:quitAndInstall'),
    clearCache: () => invoke('updater:clearCache')
  },
  onUpdaterEvent: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on('updater-event', handler);
    return () => ipcRenderer.removeListener('updater-event', handler);
  },
  onOpenAbout: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('open-about', handler);
    return () => ipcRenderer.removeListener('open-about', handler);
  },
  onOpenSettings: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('open-settings', handler);
    return () => ipcRenderer.removeListener('open-settings', handler);
  },
  openExternal: (url) => invoke('shell:openExternal', url),
  popupMenu: () => invoke('menu:popup'),
  errors: {
    list: () => invoke('errors:list'),
    clear: () => invoke('errors:clear'),
    openFolder: () => invoke('errors:openFolder'),
    report: (payload) => invoke('errors:report', payload)
  },
  onTickStart: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on('tick-start', handler);
    return () => ipcRenderer.removeListener('tick-start', handler);
  },
  onSnapshot: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on('snapshot', handler);
    return () => ipcRenderer.removeListener('snapshot', handler);
  },
  onPollError: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on('poll-error', handler);
    return () => ipcRenderer.removeListener('poll-error', handler);
  },
  onFocusApp: (cb) => {
    const handler = (_e, appId) => cb(appId);
    ipcRenderer.on('focus-app', handler);
    return () => ipcRenderer.removeListener('focus-app', handler);
  },
  onCommitProgress: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on('commit-progress', handler);
    return () => ipcRenderer.removeListener('commit-progress', handler);
  },
  onCommitBuildOutput: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on('commit-build-output', handler);
    return () => ipcRenderer.removeListener('commit-build-output', handler);
  },
  onGithubLinkChanged: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('github-link-changed', handler);
    return () => ipcRenderer.removeListener('github-link-changed', handler);
  },
  onGithubDeploy: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on('github-deploy', handler);
    return () => ipcRenderer.removeListener('github-deploy', handler);
  },
  onNotesChanged: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on('notes-changed', handler);
    return () => ipcRenderer.removeListener('notes-changed', handler);
  },
  onDiscloudStatus: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on('discloud-status', handler);
    return () => ipcRenderer.removeListener('discloud-status', handler);
  },
  onBackupFinished: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on('backup-finished', handler);
    return () => ipcRenderer.removeListener('backup-finished', handler);
  }
});
