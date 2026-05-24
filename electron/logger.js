// Logger persistente em arquivo + console.
const fs = require('node:fs');
const path = require('node:path');

let stream = null;
let filePath = null;

function init(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    filePath = path.join(dir, 'app.log');
    // mantém só ~1MB de log (trunca se maior)
    try {
      const st = fs.statSync(filePath);
      if (st.size > 1024 * 1024) fs.truncateSync(filePath, 0);
    } catch {}
    stream = fs.createWriteStream(filePath, { flags: 'a' });
    write('info', '--- app started, pid=' + process.pid + ' ---');
  } catch (err) {
    console.error('logger init failed:', err);
  }
}

// Padrões de segredos que NUNCA podem ir parar no log (token Discloud em
// Bearer/api-token headers, PATs do GitHub, ou tokens crus em objetos
// serializados). Defesa em profundidade — o código atual não loga tokens
// de propósito, mas qualquer JSON.stringify(err) com Authorization no body
// vazaria sem isso.
const SECRET_PATTERNS = [
  // GitHub PATs
  /\bghp_[A-Za-z0-9]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bgho_[A-Za-z0-9]{20,}\b/g,
  /\bghu_[A-Za-z0-9]{20,}\b/g,
  /\bghs_[A-Za-z0-9]{20,}\b/g,
  // Authorization / Bearer
  /(Bearer\s+)[A-Za-z0-9\-._~+/=]{10,}/gi,
  // headers serializados
  /("?(?:api-token|authorization|x-api-key)"?\s*:\s*")[^"]+(")/gi,
  // tokens em formato JWT-like (3 segmentos base64url)
  /\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g
];

function redact(str) {
  let out = str;
  for (const re of SECRET_PATTERNS) {
    out = out.replace(re, (m, p1, p2) => {
      if (p1 && p2) return `${p1}[REDACTED]${p2}`;
      if (p1) return `${p1}[REDACTED]`;
      return '[REDACTED]';
    });
  }
  return out;
}

function write(level, ...args) {
  const ts = new Date().toISOString();
  const msg = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  const safe = redact(msg);
  const line = `[${ts}] ${level.toUpperCase().padEnd(5)} ${safe}\n`;
  if (stream) stream.write(line);
  if (level === 'error') console.error(line.trimEnd());
  else console.log(line.trimEnd());
}

module.exports = {
  init,
  info: (...a) => write('info', ...a),
  warn: (...a) => write('warn', ...a),
  error: (...a) => write('error', ...a),
  debug: (...a) => write('debug', ...a),
  getPath: () => filePath
};
