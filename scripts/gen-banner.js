// Renderiza build/social-preview.html para build/social-preview.png (1280x640)
// usando Electron headless. Roda com: npm run gen-banner

const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const HTML = path.join(__dirname, '..', 'build', 'social-preview.html');
const OUT = path.join(__dirname, '..', 'build', 'social-preview.png');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 640,
    show: false,
    useContentSize: true,
    webPreferences: { offscreen: false, devTools: false }
  });

  win.setMenu(null);
  await win.loadFile(HTML);

  // pequena espera pra garantir layout + fontes carregadas
  await new Promise((r) => setTimeout(r, 600));

  const image = await win.webContents.capturePage({ x: 0, y: 0, width: 1280, height: 640 });
  fs.writeFileSync(OUT, image.toPNG());

  console.log('Banner gerado:', OUT, '(', (fs.statSync(OUT).size / 1024).toFixed(1), 'KB )');
  win.close();
  app.quit();
});
