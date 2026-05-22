// Cliente leve para API REST do GitHub.
// Usa PAT (Personal Access Token) opcional; repos públicos funcionam sem.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const GH_API = 'https://api.github.com';

function parseRepo(s) {
  // aceita "owner/repo", "github.com/owner/repo", "https://github.com/owner/repo"
  const cleaned = String(s || '').trim().replace(/\.git$/, '');
  const m = cleaned.match(/(?:github\.com\/)?([^\/\s]+)\/([^\/\s]+)/i);
  if (!m) return null;
  return { owner: m[1], repo: m[2] };
}

function headers(token) {
  const h = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'discloud-panel/0.1'
  };
  if (token) h['Authorization'] = `Bearer ${token.trim()}`;
  return h;
}

async function ghFetch(url, token) {
  const res = await fetch(url, { headers: headers(token) });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) {
    const err = new Error(`GitHub ${res.status}: ${data?.message || res.statusText}`);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

// Info da branch (commit SHA + mensagem do último commit)
async function branchInfo(repoStr, branch, token) {
  const r = parseRepo(repoStr);
  if (!r) throw new Error('Repositório inválido. Use "owner/repo".');
  const url = `${GH_API}/repos/${r.owner}/${r.repo}/branches/${encodeURIComponent(branch || 'main')}`;
  const data = await ghFetch(url, token);
  return {
    owner: r.owner,
    repo: r.repo,
    branch: data.name,
    sha: data.commit?.sha,
    shortSha: (data.commit?.sha || '').slice(0, 7),
    message: data.commit?.commit?.message || '',
    author: data.commit?.commit?.author?.name || data.commit?.author?.login || '',
    date: data.commit?.commit?.author?.date || null
  };
}

// Baixa zip do código da branch pra um arquivo temp; retorna { path, size }
async function downloadZip(repoStr, ref, token) {
  const r = parseRepo(repoStr);
  if (!r) throw new Error('Repositório inválido. Use "owner/repo".');
  // endpoint da API segue redirect pra codeload, autenticando se necessário
  const url = `${GH_API}/repos/${r.owner}/${r.repo}/zipball/${encodeURIComponent(ref || 'HEAD')}`;
  const res = await fetch(url, { headers: headers(token), redirect: 'follow' });
  if (!res.ok) {
    const err = new Error(`GitHub ${res.status} ao baixar zip`);
    err.status = res.status;
    try { err.body = await res.json(); } catch {}
    throw err;
  }
  const tmpDir = path.join(os.tmpdir(), 'discloud-panel-gh');
  await fs.promises.mkdir(tmpDir, { recursive: true });
  const dest = path.join(tmpDir, `${r.owner}-${r.repo}-${Date.now()}.zip`);
  const tmp = dest + '.part';
  const fh = await fs.promises.open(tmp, 'w');
  try {
    const reader = res.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await fh.write(value);
    }
  } finally {
    await fh.close();
  }
  await fs.promises.rename(tmp, dest);
  const stat = await fs.promises.stat(dest);
  return { path: dest, size: stat.size, name: path.basename(dest) };
}

module.exports = { branchInfo, downloadZip, parseRepo };
