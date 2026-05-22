# Discloud Panel

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Platform](https://img.shields.io/badge/platform-Windows-blue)
![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss&logoColor=white)

Unofficial desktop panel to monitor and manage your [Discloud](https://discloud.com) apps without opening Discord or the web dashboard.

Everything runs locally. Your token never leaves your machine.

> Community project, not affiliated with the Discloud team.

---

## Install

Grab the installer from the [Releases](../../releases/latest) tab — `Discloud Panel-Setup-X.X.X.exe`.

No prerequisites. Windows 10/11 x64 is all you need. Electron and every dependency are bundled in the installer (~80 MB).

## What it does

- **Aggregate overview** with plan KPIs, total RAM over time and top apps by RAM, CPU and traffic
- **Per-app details** with charts for CPU, memory, SSD, network and visible restart markers
- **Live logs** with search, auto-refresh, level coloring and smart auto-scroll
- **Drag & drop deploy** — drop a `.zip`, watch the upload, the build and the real app logs once it comes online
- **RAM slider** that auto-detects your plan total and shows allocation across apps
- **Native Windows notifications** for offline apps, unexpected restarts, high RAM/CPU and API errors
- **In-container file explorer** with inline editing and command execution
- **Env variable editor** in table or plain text mode
- **GitHub integration** with auto-deploy on new commits (5-minute polling)
- **Tray + autostart** — minimizes to tray, starts with Windows
- **PT-BR and English** with a toggle in Settings

## How to use it

1. Run the `.exe` (it creates a desktop shortcut automatically).
2. On first launch, paste your Discloud API token. To generate one, open the Discloud Discord and use `/apitoken`. The token is stored at `%APPDATA%\discloud-panel\config.json` — only on your computer.
3. Give it a few minutes to build up history. By default, snapshots are recorded every 30–60 seconds (configurable in Settings).

### Linking a GitHub repository (optional)

For automatic deploys from a repo:

1. Push your code to GitHub.
2. For private repos, generate a *fine-grained* PAT with `Contents` and `Metadata` (read-only) permissions and paste it under **Settings → GitHub**.
3. On the app card, expand **Link GitHub repository**, fill in `owner/repo` and the branch, click Check and then Link.
4. Tick **Auto-deploy** to have it watch for new commits every 5 minutes.

There's also an inline tutorial inside the linking card.

## Privacy

The panel only talks to `api.discloud.app` and, optionally, `api.github.com` (only if you link a repo). No telemetry, no backend, no analytics.

Everything is stored locally:

| File | Contents |
|---|---|
| `%APPDATA%\discloud-panel\config.json` | Token, preferences, GitHub links |
| `%APPDATA%\discloud-panel\data\snapshots.db` | Metrics history (SQLite via sql.js) |
| `%APPDATA%\discloud-panel\app.log` | Runtime log |

## Development

Requires Node.js 18+ and Git.

```bash
git clone https://github.com/patrickcbjj/discloud-panel.git
cd discloud-panel
npm install

# dev mode (Vite hot reload + Electron)
npm run dev

# build the installer
npm run dist
# output: release/Discloud Panel-Setup-X.X.X.exe
```

### Stack

Electron 33, Vite 5, React 18, Tailwind 3, sql.js (WASM, no native dependencies), recharts and lucide-react. Packaged with electron-builder using the NSIS target.

### Project layout

```
electron/    Main process, IPC, poller, GitHub scheduler
src/         React UI (components, i18n, formatters)
build/       Icons and build resources
scripts/     Utilities
```

## Contributing

PRs and issues are welcome. Good areas to contribute:

- Translations to other languages (dictionary lives in `src/i18n.js`)
- macOS and Linux support (Windows only today)
- Open roadmap items: team apps, scheduled backup, history export, keyboard shortcuts, light theme

## License

[MIT](LICENSE)

---

## Português

Painel desktop não-oficial para acompanhar e gerenciar seus apps na Discloud sem precisar abrir o Discord ou o dashboard web. Tudo roda localmente — seu token nunca sai da sua máquina. Projeto da comunidade, sem vínculo com a equipe da Discloud.

### Instalação

Baixe o instalador na aba [Releases](../../releases/latest). Windows 10/11 x64, sem pré-requisitos. Electron e dependências já vêm empacotados (~80 MB).

### Como usar

1. Instale o `.exe`.
2. Na primeira execução, cole seu API Token da Discloud (gere com `/apitoken` no Discord da Discloud).
3. Aguarde alguns minutos pra coletar histórico.

A UI tem toggle PT-BR / English em Configurações → Aparência.

### Desenvolvimento

```bash
git clone https://github.com/patrickcbjj/discloud-panel.git
cd discloud-panel
npm install
npm run dev      # modo desenvolvimento
npm run dist     # build do instalador
```

Stack: Electron 33 + Vite 5 + React 18 + Tailwind 3 + sql.js.

### Licença

[MIT](LICENSE)
