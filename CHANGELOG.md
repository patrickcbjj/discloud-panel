# Changelog

Todas as mudanças notáveis deste projeto ficam documentadas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/) e o versionamento segue [SemVer](https://semver.org/).

## [0.2.2] - 2026-05-22

### Added
- **Auto-update via GitHub Releases.** Painel verifica novas versões ao abrir (10s depois) e a cada 6h. Download manual com confirmação por modal: o painel não baixa nada sem permissão. Modal mostra versão atual vs nova, botão "Baixar agora", "O que há de novo" (abre a release no GitHub) e "Mais tarde". Banner flutuante no canto inferior direito acompanha o progresso e oferece "Reiniciar e instalar" quando pronto.
- **Modal "Sobre"** com identidade visual nova, link pro repo, issues, licença MIT, créditos da stack e info de sistema pra anexar em bug reports. Acessível pelo fim de Configurações ou item da tray.
- **Logo nova** cyberpunk/dev: D bold com gradient azul→violeta, ponto verde de status no contraforma, brackets HUD nos cantos, scanlines sutis. Mesmo desenho usado no ícone do app, tray, atalho do Windows e modal Sobre.
- **Build logs persistidos.** Saída do build da Discloud é salva no SQLite junto com cada deploy. Novo botão `log` na lista de histórico abre um modal com numeração de linhas, coloração de erros/warnings, botão copiar e exportar como `.txt`.
- **Uptime SLA.** Cartão no AppDetail com % de uptime nas últimas 24h, 7 dias e 30 dias, calculado em cima dos snapshots já gravados localmente.
- **Health Score (0-100).** Combina uptime, frequência de restarts, OOM ativo, RAM média e variância de CPU num único número por app. Chip colorido aparece na sidebar (verde/amarelo/vermelho rápido de bater o olho) e no header do AppDetail com tooltip detalhando o porquê do score.
- **Watchdog do poller.** Cada request individual à API tem timeout de 30s. Tick completo tem watchdog de 60s. Se a Discloud travar, o painel não fica mais eterno em "atualizando…" — emite erro e tenta de novo no próximo tick. Guard anti-overlap evita ticks empilhando.
- **GitHub Actions workflow** que dispara em tag `v*`, builda no Windows e publica draft release com `.exe` + `.blockmap` + `latest.yml` anexados.

### Changed
- `electron-updater` configurado com `autoDownload: false` e `releaseType: draft` no publish config. Releases criadas pelo CI ficam como rascunho pra você revisar as notas antes de publicar.
- `scripts/gen-icon.js` migrado de desenho raw via PNG pra captura SVG via Electron headless. Permite gradientes, filtros e curvas que o método anterior não suportava. Comando: `npm run gen-icon`.

## [0.2.1] - 2026-05-22

### Security
- **Tokens criptografados.** `apiToken` (Discloud API) e `githubToken` (PAT do GitHub) agora ficam armazenados via Electron `safeStorage` (DPAPI no Windows, Keychain no macOS, libsecret no Linux). Antes ficavam em texto puro no `config.json`. Tokens existentes são migrados automaticamente para o formato criptografado no primeiro start após atualizar.

## [0.2.0] - 2026-05-22

### Added
- Indicador de status da API Discloud no TitleBar (bolinha verde/vermelha com latência).
- Apps de equipe (`/team`): aba dedicada na sidebar, ações com checagem de permissões, todos os endpoints `team*` integrados.
- Seções inline colapsáveis (GithubCard, EnvEditor, FileExplorer) com estado persistido por app.
- Enrichment via `/app/:id`: clusterName, mods, apts, exitCode, addedAtTimestamp, ramKilled puxados em paralelo com limite de concorrência.
- Chips de linguagem (cores GitHub Linguist) e cluster na sidebar.
- Sinais de saúde do app: badge OOM pulsando, chip de exitCode traduzido, data de criação, chip auto-restart.
- Mods + APT packages como seções colapsáveis no AppDetail.
- Coexistência com `/syncgit`: GithubCard detecta auto-deploy nativo da Discloud e evita double-deploy.

## [0.1.0] - 2026-05-22

### Added
- Release inicial.
- System tray com tooltip "X/Y online" e menu de controle.
- Notificações Windows (app caiu, restart inesperado, OOM, RAM alta, CPU sustentado, erro API).
- Nomes e avatares reais via `/app/all`.
- Logs ao vivo com auto-refresh, busca, auto-scroll, coloração.
- Slider de RAM com detecção de total do plano via `/user`.
- Marcadores de restart nos gráficos.
- Sidebar com filtro e ordenação persistidos.
- Deploy drag & drop com progresso real e cronômetro de build.
- Dashboard agregado (Visão geral) com KPIs e rankings.
