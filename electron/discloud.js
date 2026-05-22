// Cliente para a API REST da Discloud — https://docs.discloud.app/
// Auth via header "api-token". Base v2.
const BASE = 'https://api.discloud.app/v2';

class DiscloudClient {
  constructor(token) {
    this.token = token;
  }

  async _req(method, path, body) {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        'api-token': this.token,
        'Content-Type': 'application/json',
        'User-Agent': 'discloud-panel/0.1 (local)'
      },
      body: body ? JSON.stringify(body) : undefined
    });

    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }

    if (!res.ok) {
      const msg = data?.message || data?.statusCode || res.statusText;
      const err = new Error(`Discloud ${res.status}: ${msg}`);
      err.status = res.status;
      err.body = data;
      throw err;
    }
    return data;
  }

  user()           { return this._req('GET', '/user'); }
  allApps()        { return this._req('GET', '/app/all'); }
  allStatus()      { return this._req('GET', '/app/all/status'); }
  app(id)          { return this._req('GET', `/app/${id}`); }
  status(id)       { return this._req('GET', `/app/${id}/status`); }
  logs(id)         { return this._req('GET', `/app/${id}/logs`); }
  start(id)        { return this._req('PUT', `/app/${id}/start`); }
  stop(id)         { return this._req('PUT', `/app/${id}/stop`); }
  restart(id)      { return this._req('PUT', `/app/${id}/restart`); }
  backup(id)       { return this._req('GET', `/app/${id}/backup`); }
  setRam(id, ram)  { return this._req('PUT', `/app/${id}/ram`, { ramMB: ram }); }

  // --- Team (apps onde o usuário é mod de outras pessoas) ---
  // GET /team retorna lista com metadata + permissões (campo `perms` ou `mods`).
  team()             { return this._req('GET', '/team'); }
  teamStatus(id)     { return this._req('GET', `/team/${id}/status`); }
  teamLogs(id)       { return this._req('GET', `/team/${id}/logs`); }
  teamStart(id)      { return this._req('PUT', `/team/${id}/start`); }
  teamStop(id)       { return this._req('PUT', `/team/${id}/stop`); }
  teamRestart(id)    { return this._req('PUT', `/team/${id}/restart`); }
  teamBackup(id)     { return this._req('GET', `/team/${id}/backup`); }
  teamSetRam(id, r)  { return this._req('PUT', `/team/${id}/ram`, { ramMB: r }); }

  // --- File explorer + exec ---
  // (cPath = caminho no container; sem cPath usa o workDir)
  _q(cPath) { return cPath ? `?cPath=${encodeURIComponent(cPath)}` : ''; }
  explorer(id, cPath)        { return this._req('GET', `/app/${id}/explorer${this._q(cPath)}`); }
  explorerOpen(id, cPath)    { return this._req('GET', `/app/${id}/explorer/open${this._q(cPath)}`); }
  explorerCreate(id, cPath, typeFile) { return this._req('POST', `/app/${id}/explorer`, { cPath, typeFile }); }
  explorerEdit(id, cPath, fileContent) { return this._req('PUT', `/app/${id}/explorer/edit`, { cPath, fileContent }); }
  exec(id, cmd)              { return this._req('PUT', `/app/${id}/exec`, { cmd }); }

  teamExplorer(id, cPath)        { return this._req('GET', `/team/${id}/explorer${this._q(cPath)}`); }
  teamExplorerOpen(id, cPath)    { return this._req('GET', `/team/${id}/explorer/open${this._q(cPath)}`); }
  teamExplorerCreate(id, cPath, typeFile) { return this._req('POST', `/team/${id}/explorer`, { cPath, typeFile }); }
  teamExplorerEdit(id, cPath, fileContent) { return this._req('PUT', `/team/${id}/explorer/edit`, { cPath, fileContent }); }
  teamExec(id, cmd)              { return this._req('PUT', `/team/${id}/exec`, { cmd }); }

  // commit (deploy): envia .zip via multipart com progresso em tempo real.
  // callbacks:
  //   onProgress({ uploaded, total, pct }) — bytes do upload
  //   onBuildOutput(fullText) — texto do build do Docker (resposta streaming)
  async teamCommit(id, filePath, opts) {
    return this._commitInternal(`/team/${id}/commit`, filePath, opts);
  }

  async commit(id, filePath, opts) {
    return this._commitInternal(`/app/${id}/commit`, filePath, opts);
  }

  async _commitInternal(endpoint, filePath, { onProgress, onBuildOutput } = {}) {
    const fs = require('node:fs');
    const path = require('node:path');
    const stat = await fs.promises.stat(filePath);
    const fileSize = stat.size;
    const filename = path.basename(filePath);

    const boundary = '----DiscloudPanelBoundary' + Math.random().toString(36).slice(2);
    const header = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: application/zip\r\n\r\n`,
      'utf8'
    );
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
    const total = header.length + fileSize + footer.length;
    let uploaded = 0;

    const emit = () => {
      const pct = total > 0 ? (uploaded / total) * 100 : 0;
      onProgress?.({ uploaded, total, pct });
    };

    const fileStream = fs.createReadStream(filePath, { highWaterMark: 64 * 1024 });

    const body = new ReadableStream({
      async start(controller) {
        controller.enqueue(header);
        uploaded += header.length;
        emit();
        try {
          for await (const chunk of fileStream) {
            controller.enqueue(chunk);
            uploaded += chunk.length;
            emit();
          }
          controller.enqueue(footer);
          uploaded += footer.length;
          emit();
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      }
    });

    const res = await fetch(`${BASE}${endpoint}`, {
      method: 'PUT',
      headers: {
        'api-token': this.token,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': String(total),
        'User-Agent': 'discloud-panel/0.1 (local)'
      },
      body,
      duplex: 'half'
    });

    // lê a resposta como stream pra mostrar build logs em tempo real
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        onBuildOutput?.(buffer);
      }
      buffer += decoder.decode(); // flush final
      onBuildOutput?.(buffer);
    }

    let data = null;
    try { data = buffer ? JSON.parse(buffer) : null; }
    catch {
      // Se não for JSON puro, tenta achar JSON na ÚLTIMA linha (comum: build logs + final JSON)
      const lines = buffer.trim().split('\n');
      const last = lines[lines.length - 1];
      try { data = JSON.parse(last); } catch { data = { raw: buffer }; }
    }

    if (!res.ok) {
      const err = new Error(`Discloud ${res.status}: ${data?.message || res.statusText}`);
      err.status = res.status;
      err.body = data;
      err.buildOutput = buffer;
      throw err;
    }
    data._buildOutput = buffer;
    return data;
  }
}

module.exports = { DiscloudClient };
