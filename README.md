<div align="center">

# Discloud Panel

**Painel desktop não-oficial para monitorar e gerenciar seus apps na [Discloud](https://discloud.com).**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Platform](https://img.shields.io/badge/platform-Windows-blue)
![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)

[Download](#-download) · [Recursos](#-recursos) · [Como usar](#-como-usar) · [Desenvolvimento](#-desenvolvimento) · [English](#english)

</div>

---

Aplicativo desktop que conversa com a API REST da Discloud para te dar uma visão completa dos seus apps sem precisar abrir o dashboard web ou o Discord. Tudo roda local — seu token nunca sai da sua máquina.

> **Aviso:** projeto da comunidade, **não oficial**. Sem vínculo com a equipe da Discloud.

## ✨ Recursos

- 📊 **Visão geral agregada** — KPIs do plano, RAM total ao longo do tempo, top apps por RAM/CPU/tráfego
- 🖥️ **Detalhes por app** — CPU, memória, SSD, rede em gráficos históricos com marcadores de restart
- 📜 **Logs ao vivo** — auto-refresh 5s, busca com highlight, coloração por nível, auto-scroll inteligente
- 🚀 **Deploy drag & drop** — solta o `.zip`, acompanha upload com velocidade/ETA, build progress, logs reais quando sobe
- 🧠 **Slider de RAM** — detecta o total do plano e mostra alocação por app
- 🔔 **Notificações Windows** — app caiu, restart inesperado, RAM/CPU alta, erro API (com cooldown)
- 🗂️ **File Explorer** — navega, edita e roda comandos dentro do container
- 🔧 **Editor de variáveis** — `.env` em modo tabela ou texto, com secret masking
- 🔗 **Vínculo com GitHub** — auto-deploy quando há novo commit (checa a cada 5 min)
- 👥 **Tray + auto-start** — minimiza pra bandeja, inicia com o Windows
- 🌐 **PT-BR / English** — toggle em Configurações

## 📥 Download

Pegue o instalador na aba [**Releases**](../../releases/latest) → `Discloud Panel-Setup-X.X.X.exe`.

**Pré-requisitos:** nenhum. Windows 10/11 x64. Tudo (Electron, runtime, dependências) vem empacotado no instalador (~80 MB).

## 🚀 Como usar

1. Instale o `.exe` (cria atalho na área de trabalho automaticamente)
2. Na primeira execução, cole seu **API Token da Discloud**
   - Pra gerar: abra o Discord da Discloud e use `/apitoken`
   - O token fica salvo localmente em `%APPDATA%\discloud-panel\config.json` — nunca sai da sua máquina
3. Aguarde alguns minutos pra começar a coletar histórico (snapshots a cada 30-60s, configurável)

### Vincular com GitHub (opcional)

Pra deploys automáticos a partir de um repo:
1. Suba seu código no GitHub
2. Pra repos privados: crie um **PAT fine-grained** (Contents + Metadata read-only) e cole em Configurações → GitHub
3. No app, expanda "Vincular repositório GitHub", preencha `owner/repo` + branch, clique Verificar → Vincular
4. Marque "Auto-deploy" pra ele monitorar novos commits

## 🔒 Privacidade

- Tudo é local. O painel só fala com `api.discloud.app` (Discloud) e `api.github.com` (se você vincular GitHub).
- Token + configurações: `%APPDATA%\discloud-panel\config.json`
- Histórico de métricas: `%APPDATA%\discloud-panel\data\snapshots.db` (SQLite via sql.js)
- Log de execução: `%APPDATA%\discloud-panel\app.log`
- Não há telemetria, não há servidor próprio, não há analytics.

## 🛠️ Desenvolvimento

Pré-requisitos: **Node.js 18+** e **Git**.

```bash
git clone https://github.com/patrickcbjj/discloud-panel.git
cd discloud-panel
npm install

# Modo desenvolvimento (hot reload Vite + Electron)
npm run dev

# Build do instalador Windows
npm run dist   # output: release/Discloud Panel-Setup-X.X.X.exe
```

### Stack

- **Electron 33** + Vite 5 + React 18 + Tailwind 3
- **sql.js** (WASM, sem dep nativa) pra histórico
- **recharts** + **lucide-react** pra UI
- **electron-builder** (NSIS) pro instalador

### Estrutura

```
electron/      Processo main, IPC, poller, GitHub scheduler
src/           UI React (componentes, i18n, formatadores)
build/         Ícones
scripts/       Utilitários de build
```

## 🤝 Contribuindo

PRs e issues bem-vindos! Especialmente:
- Tradução pra outros idiomas (i18n em `src/i18n.js`)
- Suporte a macOS/Linux (hoje só Windows)
- Roadmap aberto: apps de equipe, backup agendado, export CSV, atalhos, tema claro

## 📄 Licença

[MIT](LICENSE)

---

<a name="english"></a>

# Discloud Panel (English)

Unofficial desktop panel to monitor and manage your apps on [Discloud](https://discloud.com).

## ✨ Features

- 📊 **Aggregate overview** — plan KPIs, total RAM over time, top apps by RAM/CPU/traffic
- 🖥️ **Per-app details** — CPU, memory, SSD, network charts with restart markers
- 📜 **Live logs** — auto-refresh, highlight search, level coloring, smart auto-scroll
- 🚀 **Drag & drop deploy** — drop a `.zip`, track upload/build/online phases
- 🧠 **RAM slider** — auto-detects plan total, shows allocation per app
- 🔔 **Windows notifications** — offline, unexpected restart, high RAM/CPU, API errors
- 🗂️ **File Explorer** — browse, edit, run commands inside container
- 🔧 **Env editor** — `.env` table or text mode with secret masking
- 🔗 **GitHub integration** — auto-deploy on new commit (5 min poll)
- 👥 **Tray + autostart** — minimize to tray, start with Windows
- 🌐 **PT-BR / English** — toggle in Settings

## 📥 Download

Grab the installer from [**Releases**](../../releases/latest) → `Discloud Panel-Setup-X.X.X.exe`.

**Prerequisites:** none. Windows 10/11 x64. Everything (Electron runtime, deps) is bundled.

## 🚀 Quick start

1. Install the `.exe`
2. Paste your Discloud **API Token** on first launch (generate via `/apitoken` in Discloud's Discord)
3. Wait a few minutes for snapshot history to build up

## 🛠️ Development

```bash
git clone https://github.com/patrickcbjj/discloud-panel.git
cd discloud-panel
npm install
npm run dev      # dev mode
npm run dist     # build Windows installer
```

Stack: Electron 33 + Vite 5 + React 18 + Tailwind 3 + sql.js.

## 📄 License

[MIT](LICENSE) — community project, not affiliated with Discloud.
