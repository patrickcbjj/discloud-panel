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

function write(level, ...args) {
  const ts = new Date().toISOString();
  const msg = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  const line = `[${ts}] ${level.toUpperCase().padEnd(5)} ${msg}\n`;
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
