// Renderiza build/icon.html para build/icon.png (256x256) usando Electron
// headless. Roda com: npm run gen-icon

const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const HTML = path.join(__dirname, '..', 'build', 'icon.html');
const OUT  = path.join(__dirname, '..', 'build', 'icon.png');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 256,
    height: 256,
    show: false,
    transparent: true,
    backgroundColor: '#00000000',
    useContentSize: true,
    frame: false,
    webPreferences: { offscreen: false, devTools: false }
  });

  win.setMenu(null);
  await win.loadFile(HTML);

  // espera o SVG/filtros assentarem antes de capturar
  await new Promise((r) => setTimeout(r, 400));

  const image = await win.webContents.capturePage({ x: 0, y: 0, width: 256, height: 256 });
  fs.writeFileSync(OUT, image.toPNG());

  console.log('Icon gerado:', OUT, '(', (fs.statSync(OUT).size / 1024).toFixed(1), 'KB )');
  win.close();
  app.quit();
});
