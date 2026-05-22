import React, { createContext, useContext, useEffect, useState } from 'react';

const DICTS = {
  pt: {
    common: {
      save: 'Salvar', saving: 'Salvando…', saved: 'Salvo', cancel: 'Cancelar',
      delete: 'Apagar', edit: 'Editar', rename: 'Renomear', copy: 'Copiar', cut: 'Recortar', paste: 'Colar',
      create: 'Criar', refresh: 'Atualizar', close: 'Fechar', loading: 'Carregando…',
      yes: 'Sim', no: 'Não', confirm: 'Confirmar', error: 'Erro', back: 'Voltar',
      search: 'buscar...', all: 'Todos', online: 'Online', offline: 'Offline',
      enable: 'Ativar', disable: 'Desativar', open: 'Abrir', settings: 'Configurações',
      collapse: 'Recolher', expand: 'Expandir'
    },
    titleBar: { refreshTitle: 'Atualizar agora', refreshing: 'Atualizando…', errorChip: 'erro', updatedAt: 'atualizado às', planLabel: 'Plano', statusOnline: 'Discloud online', statusOffline: 'Discloud fora do ar', statusChecking: 'Verificando status…', statusLatency: 'latência {n}ms' },
    sidebar: {
      overview: 'Visão geral', apps: 'apps', myApps: 'Meus apps', team: 'Equipe',
      noApps: 'Nenhum app retornado pela API.', noTeamApps: 'Você não é mod de nenhum app de equipe.',
      noMatch: 'Nenhum app bate com o filtro.', showing: 'mostrando',
      sortStatus: 'Online primeiro', sortName: 'Nome A-Z', sortRam: 'Mais RAM (%)', sortCpu: 'Mais CPU', sortUptime: 'Mais antigo (uptime)',
      sortBy: 'Ordenar por'
    },
    overview: {
      title: 'Visão geral', subtitle: 'Agregado de todos os seus apps na Discloud',
      kpiApps: 'Apps', kpiRam: 'RAM em uso', kpiCpu: 'CPU média', kpiSsd: 'SSD total',
      kpiTraffic: 'Tráfego (cumulativo)', kpiPlanAlloc: 'Alocação do plano',
      allOnline: 'todos online', offlineCount: '{n} offline', allocOf: 'de {v} alocados',
      totalSum: 'total somado: {v}', freeRam: 'livre: {v}', definePlan: 'defina o total do plano nas configurações',
      ramOverTime: 'RAM total ao longo do tempo', collecting: 'Coletando dados… volte em alguns minutos.',
      ramByApp: 'Alocação de RAM por app', noAllocData: 'Sem dados de alocação.',
      topRam: 'MAIS RAM', topCpu: 'MAIS CPU', topTraffic: 'MAIS TRÁFEGO'
    },
    appDetail: {
      start: 'Iniciar', stop: 'Parar', restart: 'Reiniciar', logs: 'Logs', backup: 'Backup', deploy: 'Deploy',
      uptime: 'uptime', startedAt: 'iniciado em',
      cpu: 'CPU', memory: 'Memória', ssd: 'SSD', network: 'Rede (cumulativo)',
      history: 'Histórico', restarts: 'restart', restartsP: 'restarts', restartTitle: 'Restarts detectados na janela selecionada',
      collectingData: 'Coletando dados… O painel grava um snapshot a cada tick. Volte em alguns minutos pra ver os gráficos.',
      rawApi: 'Resposta bruta da API', selectApp: 'Selecione um app à esquerda.',
      notesTitle: 'Notas', notesLabel: 'Label / categoria', notesLabelPh: 'ex: produção, teste',
      notesText: 'Anotação', notesTextPh: 'Notas livres sobre esse app…',
      saveNotes: 'Salvar notas', notesHint: 'Salvo localmente; não envia nada pra Discloud.',
      deployHistory: 'Histórico de deploys',
      dragDrop: 'Solte aqui pra fazer deploy', sentTo: 'Arquivo será enviado pra',
      ramChange: 'Clique pra alterar a RAM alocada',
      oomBadge: 'OOM',
      oomTitle: 'Container morto por estouro de RAM (OOM kill)',
      exitCode: 'exit code',
      exitCodeOk: 'saída limpa',
      exitCodeOom: 'morto por OOM (sinal 9)',
      exitCodeSig: 'morto por sinal {n}',
      exitCodeErr: 'crash com código {n}',
      createdAt: 'criado em',
      createdRel: 'há {v}',
      autoRestartOn: 'auto-restart',
      autoRestartHint: 'Discloud reinicia automaticamente quando o app cai',
      modsTitle: 'Compartilhado com',
      modsCount: '{n} moderador(es)',
      modsEmpty: 'Nenhum moderador adicionado.',
      aptsTitle: 'Pacotes APT instalados',
      aptsCount: '{n} pacote(s)',
      aptsEmpty: 'Nenhum pacote APT instalado.',
      aptsHint: 'Pacotes do sistema (Linux) que a Discloud instalou via discloud.config / Aptfile.'
    },
    settings: {
      title: 'Configurações',
      appearance: 'Aparência', theme: 'Tema', dark: 'Escuro', light: 'Claro',
      language: 'Idioma',
      account: 'Conta', apiToken: 'API Token Discloud',
      github: 'GitHub', githubPat: 'Personal Access Token (PAT)', githubHint: 'Repos públicos funcionam sem token. Pra privados, gere um PAT em',
      githubScope: 'com permissão',
      saveToken: 'Salvar token',
      pollingHistory: 'Polling & histórico', intervalSec: 'Intervalo (segundos)', intervalHint: 'Recomendado 30-60s pra não tomar rate limit.',
      retentionDays: 'Reter histórico (dias)', purgeOld: 'Limpar histórico antigo', purged: 'Removidos {n} snapshots antigos.', savedMsg: 'Configurações salvas.',
      windowInit: 'Janela & inicialização',
      minimizeTray: 'Minimizar pra bandeja ao fechar',
      minimizeTrayHint: "Clicar no X esconde a janela; o app continua rodando na bandeja. Use 'Sair' no menu do ícone pra fechar de fato.",
      autoStart: 'Iniciar com o Windows', autoStartHint: 'Abre o painel automaticamente quando você fizer login.',
      startMin: 'Iniciar minimizado (só na bandeja)', startMinHint: 'Quando inicia com o Windows, abre direto na bandeja sem mostrar a janela.',
      quit: 'Sair completamente', quitHint: 'Encerra o processo (não fica na bandeja).',
      notifications: 'Notificações',
      alertOffline: 'App caiu (offline)', alertOfflineHint: 'Quando um app passa de online pra offline.',
      alertRestart: 'Restart inesperado', alertRestartHint: 'Quando o uptime cai sem você ter mandado reiniciar.',
      alertOom: 'OOM kill (RAM estourada)', alertOomHint: 'Container morto pela Discloud por exceder a RAM alocada. Considere aumentar.',
      alertHighRam: 'RAM alta (acima de {n}%)', alertRamHint: 'Limite ajustável abaixo.',
      alertHighCpu: 'CPU sustentada (acima de {n}% por 3 ticks)', alertCpuHint: 'Evita alertas por picos momentâneos.',
      alertApiError: 'Erro na API', alertApiHint: 'Token inválido, rate limit, ou Discloud fora do ar.',
      alertAnomaly: 'Anomalia de RAM/CPU', alertAnomalyHint: 'Alerta quando o uso sai do padrão histórico (Z-score ≥ 3 sobre os últimos ~15 minutos).',
      ramLimit: 'Limite RAM (%)', cpuLimit: 'Limite CPU (%)', cooldownHint: 'Cooldown de 5 minutos por app/tipo pra não inundar. Clica numa notificação pra abrir o app correspondente.',
      exportTitle: 'Exportar histórico', exportHint: 'Exporta os snapshots gravados localmente (CPU, RAM, rede, uptime) para análise externa.',
      format: 'Formato', period: 'Período', appLabel: 'App', last24h: 'Últimas 24h', last7d: 'Últimos 7 dias', last30d: 'Últimos 30 dias', allTime: 'Tudo',
      exportBtn: 'Exportar', exporting: 'Exportando…', exportCanceled: 'Exportação cancelada.', exportSuccess: 'Exportadas {n} linhas para {p}.',
      backupTitle: 'Backup automático', backupEnable: 'Ativar backup agendado', backupEnableHint: 'Baixa um .zip de todos os seus apps + apps de equipe com permissão de backup.',
      dayOfWeek: 'Dia da semana', hour: 'Hora', minute: 'Minuto',
      backupFolder: 'Pasta de destino', choose: 'Escolher…',
      keepLastN: 'Manter últimos N backups', keepLastNHint: 'Backups mais antigos são apagados automaticamente.',
      runNow: 'Fazer backup agora', running: 'Executando…',
      backupRunning: 'Executando backup… isso pode levar alguns minutos.',
      backupDone: 'Concluído: {ok} OK, {fail} falhas.', backupFail: 'Falha: {e}',
      history: 'Histórico', backupHistDuration: '{s}s', backupHistAuto: 'agendado', backupHistManual: 'manual',
      backupHistResult: '{ok} OK, {fail} falhas{rm}', backupHistRm: ' · {n} pasta(s) antiga(s) removida(s)',
      backupHistFails: 'Falhas:', backupHistTotal: 'Total:'
    },
    tokenGate: {
      title: 'Conectar à Discloud', desc: 'Cole seu API token pra começar.',
      placeholder: 'discloud_...', help: 'Gere o token via', save: 'Salvar e conectar', saving: 'Salvando…',
      howTo: 'Pra gerar o token:',
      step1: 'Vá no Discord da Discloud',
      step2a: 'Use o comando', step2b: '',
      step3: 'Cole o token aqui (ele fica salvo localmente)',
      emptyErr: 'Cole o token primeiro.',
      docsLabel: 'docs.discloud.app'
    },
    logs: {
      title: 'Logs', autoRefresh: 'Auto-refresh', search: 'filtrar linhas...',
      autoScroll: 'Auto-scroll', paused: 'pausado', copy: 'copiar', lastUpdate: 'atualizado às',
      empty: 'Sem logs.', loading: 'Carregando…',
      pauseAuto: 'Pausar auto-refresh', resumeAuto: 'Retomar auto-refresh',
      refreshNow: 'Atualizar agora', copyAll: 'Copiar tudo', close: 'Fechar',
      errorPrefix: 'Erro:', noMatch: 'Nenhuma linha bate com o filtro.',
      lines: 'linhas', filtered: 'filtradas', goToEnd: 'ir pro fim', live: '● ao vivo'
    },
    ram: {
      title: 'Alterar RAM alocada', planTotal: 'total do plano', alreadyAlloc: 'Já alocado em todos os apps',
      othersAlloc: 'Outros apps', thisApp: 'Este app', available: 'Disponível',
      current: 'atual', overrideHint: 'Se o painel não detectou o total do plano corretamente, defina manualmente em Configurações.',
      save: 'Salvar', restartWarn: 'Alterar a RAM reinicia o app.',
      planLabel: 'Plano', totalLabel: '{v} total',
      manualLimit: 'Limite definido manualmente nas configurações ({v}).',
      detectFail: 'Não consegui detectar o total de RAM do seu plano pela API. Defina manualmente abaixo pra ativar os limites.',
      planTotalLabel: 'Total do plano (MB):', planTotalPh: 'ex: 8192',
      newAlloc: 'Nova alocação', currentLabel: 'atual: {v}',
      maxLabel: 'máx: {v}',
      currentUsage: 'Uso atual: {v}', pctOfNew: '{p}% da nova RAM',
      warnUsing: 'O app está usando {v} agora, acima do limite que você quer definir. Provavelmente vai cair.',
      warnExceedPlan: 'Excede o limite do plano. Disponível: {v}.',
      cancel: 'Cancelar', apply: 'Aplicar', saving: 'Salvando…',
      ramChanged: 'RAM alterada para {v} MB'
    },
    deploy: {
      sending: 'Enviando…', building: 'Build em andamento', online: 'App online ✓',
      confirm: 'Confirmar deploy', drop: 'Solte aqui',
      uploadSpeed: 'velocidade', uploadEta: 'ETA',
      sentBytes: '{a} de {b}', buildLog: 'Logs do build',
      runningLogs: 'Logs do app rodando', goBack: 'Fechar',
      titleConfirm: 'Deploy de nova versão', titleUploading: 'Enviando arquivo...',
      titleBuilding: 'Build em andamento...', titleOnline: 'App online ✓', titleError: 'Falha no deploy',
      waitUpload: 'Aguarde o upload terminar',
      notZipWarn: 'Esse arquivo não termina em',
      attention: 'Atenção',
      warn1: 'O app vai ser', warn1Bold: 'reiniciado', warn1Suffix: 'após o deploy',
      warn2: 'Os arquivos atuais serão substituídos pelos do zip',
      warn3a: 'Verifique se o', warn3b: 'está incluído',
      warn4a: 'Recomendado fazer', warn4Bold: 'Backup', warn4b: 'antes',
      cancel: 'Cancelar', doDeploy: 'Fazer deploy',
      buildingMsg: 'Discloud está construindo seu app',
      buildingSub: 'Aguardando o servidor reiniciar com a nova versão...',
      buildingHint: 'Verificando status a cada 2s — o app será detectado online assim que o novo build subir. Apps maiores podem demorar alguns minutos.',
      containerLabel: 'container: {v}',
      appOnline: 'App reiniciado e online', builtIn: 'buildou em {v}',
      tracking: 'acompanhando logs', waitingLogs: 'Aguardando logs do app...',
      errorTitle: 'Algo deu errado',
      linesLabel: '{n} linhas', waitingBuild: 'aguardando build...',
      close: 'Fechar', filesSent: 'Arquivos enviados'
    },
    github: {
      title: 'GitHub', linkTitle: 'Vincular repositório GitHub',
      repo: 'Repositório', branch: 'Branch', autoDeploy: 'Auto-deploy quando houver novo commit (checa a cada 5 min)',
      check: 'Verificar', link: 'Vincular', unlink: 'Desvincular',
      deployNow: 'Deploy agora', deploying: 'Deployando…',
      lastDeploy: 'Último deploy:', noDeployYet: 'Ainda não houve deploy via GitHub.',
      found: 'Encontrado: {sha} por {author}', notFoundHint: ' — repo/branch não encontrado ou privado sem token configurado.',
      invalidToken: ' — token inválido.',
      sendingHint: 'Baixando e enviando…', sent: 'Deploy enviado ({sha}).', failed: 'Falha: {e}',
      openRepo: 'Abrir repositório',
      relNow: 'agora', relMin: '{n} min atrás', relHour: '{n} h atrás',
      unknownAuthor: 'desconhecido', unknownError: 'erro desconhecido',
      howToToggle: 'Como vincular?',
      tutFlow: 'O painel lê do GitHub e faz deploy no Discloud. Você precisa subir o código no repo primeiro.',
      tutStep1Title: 'Suba o código no GitHub',
      tutStep1Desc: 'No diretório do app:',
      tutStep2Title: 'Repo privado? Configure um PAT',
      tutStep2Desc: 'Configurações → GitHub. Crie um token em ',
      tutStep2Perm: ' (fine-grained) com permissão Contents + Metadata (read-only).',
      tutStep3Title: 'Preencha e vincule',
      tutStep3Desc: 'Digite owner/repo e a branch (geralmente main), clique Verificar e depois Vincular. Auto-deploy é opcional — checa novo commit a cada 5 min.',
      tutTipsTitle: 'Erros comuns:',
      tutTip404: '404 genérico → repo privado sem token, ou owner/repo errado',
      tutTipBranch: '404 branch → tente master ou veja a branch padrão no GitHub',
      tutTipBig: 'push falha "file too large" → adicione release/, dist/, node_modules ao .gitignore',
      nativeTitle: 'Auto-deploy gerenciado pela Discloud',
      nativeDesc: 'Esse app já está vinculado a um repositório Git pela própria Discloud (via comando /syncgit). O painel detectou e desativou a integração local pra evitar deploy duplicado.',
      nativeRepoLabel: 'Repositório',
      nativeOpenRepo: 'Abrir repo',
      nativeManageHint: 'Pra alterar ou desativar, use o comando da Discloud no Discord.',
      nativeNoSyncInfo: 'A Discloud não expõe a URL do repo via API pública.',
      syncLinkedTitle: 'Repositório vinculado na Discloud',
      syncLinkedDesc: 'Esse app tem um repo Git registrado na Discloud, mas com auto-deploy desativado. Deploys via painel ainda funcionam normalmente.'
    },
    env: {
      title: 'Variáveis de ambiente', titleEnv: 'Variáveis de ambiente (.env)',
      tableMode: 'Tabela', textMode: 'Texto',
      notExists: 'O arquivo {f} não existe nesse app.', createFile: 'Criar arquivo',
      noVars: 'Nenhuma variável definida ainda.', addVar: 'Adicionar variável',
      show: 'Mostrar', hide: 'Esconder', remove: 'Remover',
      warnRestart: 'Atenção: a Discloud só relê o {f} ao reiniciar o app.',
      loadingFile: 'Carregando {f}…',
      tableTip: 'Tabela KEY=VALUE', textTip: 'Editor de texto puro',
      reload: 'Recarregar', valuePh: 'valor', keyPh: 'KEY',
      save: 'Salvar', saving: 'Salvando…', saved: 'Salvo'
    },
    explorer: {
      title: 'Arquivos do container', root: 'raiz', emptyFolder: 'Pasta vazia.',
      runCmd: 'Executar comando', cmdPlaceholder: 'ex: ls -la, cat package.json',
      run: 'Rodar', running: 'Rodando…',
      runHint: 'Comando é executado dentro do container do app. Requer que o app esteja online.',
      exitCode: 'exit code:', stdout: 'stdout', stderr: 'stderr',
      binary: 'Esse arquivo parece binário; o editor só suporta arquivos de texto.',
      unsavedDiscard: 'Há alterações não salvas. Descartar?',
      unsaved: 'Alterações não salvas',
      confirmDelete: 'Apagar "{name}"{dir}?', deleteDir: ' e todo o conteúdo',
      promptRename: 'Novo nome:', invalidName: 'Nome não pode conter "/"',
      samePath: 'Origem e destino são iguais.',
      copyCutLabel: '{a}: {name}',
      newFilePh: 'novo-arquivo.txt', newFolderPh: 'nova-pasta',
      paste: 'Colar', cancel: 'Cancelar',
      createBtn: 'Criar', execBtn: 'Exec', reload: 'Recarregar',
      createTip: 'Criar arquivo/pasta', execTip: 'Executar comando', reloadTip: 'Recarregar',
      file: 'Arquivo', folder: 'Pasta',
      back: 'Voltar', close: 'Fechar',
      rename: 'Renomear', edit: 'Editar', copy: 'Copiar', cut: 'Recortar', deleteItem: 'Apagar',
      saving: 'Salvando…', saved: 'Salvo', save: 'Salvar',
      pasteCut: 'Colar (recortar)', pasteCopy: 'Colar (copiar)',
      shellRename: 'Renomear', shellDelete: 'Apagar',
      noReturn: 'sem retorno', failed: 'falha',
      execTitle: 'Executar comando · {n}'
    },
    days: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
  },
  en: {
    common: {
      save: 'Save', saving: 'Saving…', saved: 'Saved', cancel: 'Cancel',
      delete: 'Delete', edit: 'Edit', rename: 'Rename', copy: 'Copy', cut: 'Cut', paste: 'Paste',
      create: 'Create', refresh: 'Refresh', close: 'Close', loading: 'Loading…',
      yes: 'Yes', no: 'No', confirm: 'Confirm', error: 'Error', back: 'Back',
      search: 'search...', all: 'All', online: 'Online', offline: 'Offline',
      enable: 'Enable', disable: 'Disable', open: 'Open', settings: 'Settings',
      collapse: 'Collapse', expand: 'Expand'
    },
    titleBar: { refreshTitle: 'Refresh now', refreshing: 'Refreshing…', errorChip: 'error', updatedAt: 'updated at', planLabel: 'Plan', statusOnline: 'Discloud online', statusOffline: 'Discloud down', statusChecking: 'Checking status…', statusLatency: '{n}ms latency' },
    sidebar: {
      overview: 'Overview', apps: 'apps', myApps: 'My apps', team: 'Team',
      noApps: 'No apps returned by the API.', noTeamApps: "You're not a mod of any team app.",
      noMatch: 'No app matches the filter.', showing: 'showing',
      sortStatus: 'Online first', sortName: 'Name A-Z', sortRam: 'Most RAM (%)', sortCpu: 'Most CPU', sortUptime: 'Oldest uptime',
      sortBy: 'Sort by'
    },
    overview: {
      title: 'Overview', subtitle: 'Aggregate of all your Discloud apps',
      kpiApps: 'Apps', kpiRam: 'RAM in use', kpiCpu: 'Avg CPU', kpiSsd: 'Total SSD',
      kpiTraffic: 'Traffic (cumulative)', kpiPlanAlloc: 'Plan allocation',
      allOnline: 'all online', offlineCount: '{n} offline', allocOf: 'of {v} allocated',
      totalSum: 'total sum: {v}', freeRam: 'free: {v}', definePlan: 'set the plan total in settings',
      ramOverTime: 'Total RAM over time', collecting: 'Collecting data… come back in a few minutes.',
      ramByApp: 'RAM allocation per app', noAllocData: 'No allocation data.',
      topRam: 'TOP RAM', topCpu: 'TOP CPU', topTraffic: 'TOP TRAFFIC'
    },
    appDetail: {
      start: 'Start', stop: 'Stop', restart: 'Restart', logs: 'Logs', backup: 'Backup', deploy: 'Deploy',
      uptime: 'uptime', startedAt: 'started at',
      cpu: 'CPU', memory: 'Memory', ssd: 'SSD', network: 'Network (cumulative)',
      history: 'History', restarts: 'restart', restartsP: 'restarts', restartTitle: 'Restarts detected in the selected window',
      collectingData: 'Collecting data… the panel records a snapshot every tick. Come back in a few minutes to see the charts.',
      rawApi: 'Raw API response', selectApp: 'Select an app on the left.',
      notesTitle: 'Notes', notesLabel: 'Label / category', notesLabelPh: 'e.g. production, test',
      notesText: 'Note', notesTextPh: 'Free notes about this app…',
      saveNotes: 'Save notes', notesHint: 'Saved locally; nothing is sent to Discloud.',
      deployHistory: 'Deploy history',
      dragDrop: 'Drop here to deploy', sentTo: 'File will be sent to',
      ramChange: 'Click to change allocated RAM',
      oomBadge: 'OOM',
      oomTitle: 'Container killed by out-of-memory (OOM kill)',
      exitCode: 'exit code',
      exitCodeOk: 'clean exit',
      exitCodeOom: 'killed by OOM (signal 9)',
      exitCodeSig: 'killed by signal {n}',
      exitCodeErr: 'crashed with code {n}',
      createdAt: 'created on',
      createdRel: '{v} ago',
      autoRestartOn: 'auto-restart',
      autoRestartHint: 'Discloud restarts automatically when the app crashes',
      modsTitle: 'Shared with',
      modsCount: '{n} moderator(s)',
      modsEmpty: 'No moderators added.',
      aptsTitle: 'Installed APT packages',
      aptsCount: '{n} package(s)',
      aptsEmpty: 'No APT packages installed.',
      aptsHint: 'System (Linux) packages installed by Discloud via discloud.config / Aptfile.'
    },
    settings: {
      title: 'Settings',
      appearance: 'Appearance', theme: 'Theme', dark: 'Dark', light: 'Light',
      language: 'Language',
      account: 'Account', apiToken: 'Discloud API Token',
      github: 'GitHub', githubPat: 'Personal Access Token (PAT)', githubHint: 'Public repos work without a token. For private repos, generate a PAT at',
      githubScope: 'with permission',
      saveToken: 'Save token',
      pollingHistory: 'Polling & history', intervalSec: 'Interval (seconds)', intervalHint: 'Recommended 30-60s to avoid rate limit.',
      retentionDays: 'Keep history (days)', purgeOld: 'Clear old history', purged: 'Removed {n} old snapshots.', savedMsg: 'Settings saved.',
      windowInit: 'Window & startup',
      minimizeTray: 'Minimize to tray on close',
      minimizeTrayHint: "Clicking X hides the window; app keeps running in tray. Use 'Quit' from the tray menu to actually exit.",
      autoStart: 'Start with Windows', autoStartHint: 'Opens the panel automatically when you log in.',
      startMin: 'Start minimized (tray only)', startMinHint: 'When starting with Windows, opens straight to tray without showing the window.',
      quit: 'Quit completely', quitHint: 'Ends the process (does not stay in tray).',
      notifications: 'Notifications',
      alertOffline: 'App went offline', alertOfflineHint: 'When an app changes from online to offline.',
      alertRestart: 'Unexpected restart', alertRestartHint: 'When uptime drops without you asking for a restart.',
      alertOom: 'OOM kill (RAM exceeded)', alertOomHint: 'Container killed by Discloud for exceeding allocated RAM. Consider increasing it.',
      alertHighRam: 'High RAM (above {n}%)', alertRamHint: 'Threshold adjustable below.',
      alertHighCpu: 'Sustained CPU (above {n}% for 3 ticks)', alertCpuHint: 'Avoids alerts from momentary spikes.',
      alertApiError: 'API error', alertApiHint: 'Invalid token, rate limit, or Discloud down.',
      alertAnomaly: 'RAM/CPU anomaly', alertAnomalyHint: 'Alerts when usage breaks from the historical pattern (Z-score ≥ 3 over the last ~15 minutes).',
      ramLimit: 'RAM threshold (%)', cpuLimit: 'CPU threshold (%)', cooldownHint: 'Cooldown of 5 min per app/type to avoid flooding. Click a notification to open the related app.',
      exportTitle: 'Export history', exportHint: 'Exports locally recorded snapshots (CPU, RAM, network, uptime) for external analysis.',
      format: 'Format', period: 'Period', appLabel: 'App', last24h: 'Last 24h', last7d: 'Last 7 days', last30d: 'Last 30 days', allTime: 'All',
      exportBtn: 'Export', exporting: 'Exporting…', exportCanceled: 'Export canceled.', exportSuccess: 'Exported {n} rows to {p}.',
      backupTitle: 'Automatic backup', backupEnable: 'Enable scheduled backup', backupEnableHint: 'Downloads a .zip of all your apps + team apps with backup permission.',
      dayOfWeek: 'Day of week', hour: 'Hour', minute: 'Minute',
      backupFolder: 'Destination folder', choose: 'Choose…',
      keepLastN: 'Keep last N backups', keepLastNHint: 'Older backups are deleted automatically.',
      runNow: 'Back up now', running: 'Running…',
      backupRunning: 'Running backup… this may take a few minutes.',
      backupDone: 'Done: {ok} OK, {fail} failed.', backupFail: 'Failed: {e}',
      history: 'History', backupHistDuration: '{s}s', backupHistAuto: 'scheduled', backupHistManual: 'manual',
      backupHistResult: '{ok} OK, {fail} failed{rm}', backupHistRm: ' · {n} old folder(s) removed',
      backupHistFails: 'Failures:', backupHistTotal: 'Total:'
    },
    tokenGate: {
      title: 'Connect to Discloud', desc: 'Paste your API token to start.',
      placeholder: 'discloud_...', help: 'Generate the token via', save: 'Save & connect', saving: 'Saving…',
      howTo: 'To generate the token:',
      step1: 'Open the Discloud Discord',
      step2a: 'Use the command', step2b: '',
      step3: 'Paste the token here (stored locally)',
      emptyErr: 'Paste the token first.',
      docsLabel: 'docs.discloud.app'
    },
    logs: {
      title: 'Logs', autoRefresh: 'Auto-refresh', search: 'filter lines...',
      autoScroll: 'Auto-scroll', paused: 'paused', copy: 'copy', lastUpdate: 'updated at',
      empty: 'No logs.', loading: 'Loading…',
      pauseAuto: 'Pause auto-refresh', resumeAuto: 'Resume auto-refresh',
      refreshNow: 'Refresh now', copyAll: 'Copy all', close: 'Close',
      errorPrefix: 'Error:', noMatch: 'No line matches the filter.',
      lines: 'lines', filtered: 'filtered', goToEnd: 'go to end', live: '● live'
    },
    ram: {
      title: 'Change allocated RAM', planTotal: 'plan total', alreadyAlloc: 'Already allocated across all apps',
      othersAlloc: 'Other apps', thisApp: 'This app', available: 'Available',
      current: 'current', overrideHint: 'If the panel did not detect the plan total correctly, set it manually in Settings.',
      save: 'Save', restartWarn: 'Changing RAM restarts the app.',
      planLabel: 'Plan', totalLabel: '{v} total',
      manualLimit: 'Limit set manually in settings ({v}).',
      detectFail: "Couldn't detect your plan's RAM total via the API. Set it manually below to enable the limits.",
      planTotalLabel: 'Plan total (MB):', planTotalPh: 'e.g. 8192',
      newAlloc: 'New allocation', currentLabel: 'current: {v}',
      maxLabel: 'max: {v}',
      currentUsage: 'Current usage: {v}', pctOfNew: '{p}% of new RAM',
      warnUsing: 'The app is using {v} right now, above the limit you want to set. It will likely crash.',
      warnExceedPlan: 'Exceeds plan limit. Available: {v}.',
      cancel: 'Cancel', apply: 'Apply', saving: 'Saving…',
      ramChanged: 'RAM changed to {v} MB'
    },
    deploy: {
      sending: 'Sending…', building: 'Build in progress', online: 'App online ✓',
      confirm: 'Confirm deploy', drop: 'Drop here',
      uploadSpeed: 'speed', uploadEta: 'ETA',
      sentBytes: '{a} of {b}', buildLog: 'Build logs',
      runningLogs: 'Running app logs', goBack: 'Close',
      titleConfirm: 'Deploy new version', titleUploading: 'Uploading file...',
      titleBuilding: 'Build in progress...', titleOnline: 'App online ✓', titleError: 'Deploy failed',
      waitUpload: 'Wait for the upload to finish',
      notZipWarn: "This file doesn't end with",
      attention: 'Attention',
      warn1: 'The app will be', warn1Bold: 'restarted', warn1Suffix: 'after the deploy',
      warn2: 'Current files will be replaced by those in the zip',
      warn3a: 'Make sure', warn3b: 'is included',
      warn4a: 'It is recommended to', warn4Bold: 'Backup', warn4b: 'first',
      cancel: 'Cancel', doDeploy: 'Deploy',
      buildingMsg: 'Discloud is building your app',
      buildingSub: 'Waiting for the server to restart with the new version...',
      buildingHint: 'Checking status every 2s — the app will be detected online as soon as the new build comes up. Bigger apps may take a few minutes.',
      containerLabel: 'container: {v}',
      appOnline: 'App restarted and online', builtIn: 'built in {v}',
      tracking: 'tracking logs', waitingLogs: 'Waiting for app logs...',
      errorTitle: 'Something went wrong',
      linesLabel: '{n} lines', waitingBuild: 'waiting for build...',
      close: 'Close', filesSent: 'Files sent'
    },
    github: {
      title: 'GitHub', linkTitle: 'Link GitHub repository',
      repo: 'Repository', branch: 'Branch', autoDeploy: 'Auto-deploy on new commit (checks every 5 min)',
      check: 'Check', link: 'Link', unlink: 'Unlink',
      deployNow: 'Deploy now', deploying: 'Deploying…',
      lastDeploy: 'Last deploy:', noDeployYet: 'No deploys via GitHub yet.',
      found: 'Found: {sha} by {author}', notFoundHint: ' — repo/branch not found or private without configured token.',
      invalidToken: ' — invalid token.',
      sendingHint: 'Downloading and sending…', sent: 'Deploy sent ({sha}).', failed: 'Failed: {e}',
      openRepo: 'Open repository',
      relNow: 'now', relMin: '{n} min ago', relHour: '{n} h ago',
      unknownAuthor: 'unknown', unknownError: 'unknown error',
      howToToggle: 'How to link?',
      tutFlow: 'The panel reads from GitHub and deploys to Discloud. You need to push your code to the repo first.',
      tutStep1Title: 'Push your code to GitHub',
      tutStep1Desc: 'In your app directory:',
      tutStep2Title: 'Private repo? Set up a PAT',
      tutStep2Desc: 'Settings → GitHub. Create a token at ',
      tutStep2Perm: ' (fine-grained) with Contents + Metadata permission (read-only).',
      tutStep3Title: 'Fill in and link',
      tutStep3Desc: 'Type owner/repo and the branch (usually main), click Check then Link. Auto-deploy is optional — checks for new commits every 5 min.',
      tutTipsTitle: 'Common errors:',
      tutTip404: 'Generic 404 → private repo without token, or wrong owner/repo',
      tutTipBranch: '404 branch → try master or check the default branch on GitHub',
      tutTipBig: 'push fails "file too large" → add release/, dist/, node_modules to .gitignore',
      nativeTitle: 'Auto-deploy managed by Discloud',
      nativeDesc: 'This app is already linked to a Git repository by Discloud itself (via the /syncgit command). The panel detected it and disabled the local integration to avoid duplicate deploys.',
      nativeRepoLabel: 'Repository',
      nativeOpenRepo: 'Open repo',
      nativeManageHint: 'To change or disable, use the Discloud command on Discord.',
      nativeNoSyncInfo: 'Discloud does not expose the repo URL via public API.',
      syncLinkedTitle: 'Repository linked on Discloud',
      syncLinkedDesc: 'This app has a Git repo registered with Discloud, but auto-deploy is off. Deploys via the panel still work normally.'
    },
    env: {
      title: 'Environment variables', titleEnv: 'Environment variables (.env)',
      tableMode: 'Table', textMode: 'Text',
      notExists: 'The file {f} does not exist in this app.', createFile: 'Create file',
      noVars: 'No variables defined yet.', addVar: 'Add variable',
      show: 'Show', hide: 'Hide', remove: 'Remove',
      warnRestart: 'Note: Discloud only re-reads {f} after restarting the app.',
      loadingFile: 'Loading {f}…',
      tableTip: 'Table KEY=VALUE', textTip: 'Plain text editor',
      reload: 'Reload', valuePh: 'value', keyPh: 'KEY',
      save: 'Save', saving: 'Saving…', saved: 'Saved'
    },
    explorer: {
      title: 'Container files', root: 'root', emptyFolder: 'Empty folder.',
      runCmd: 'Run command', cmdPlaceholder: 'e.g. ls -la, cat package.json',
      run: 'Run', running: 'Running…',
      runHint: 'Command runs inside the app container. Requires the app to be online.',
      exitCode: 'exit code:', stdout: 'stdout', stderr: 'stderr',
      binary: 'This file looks binary; the editor only supports text files.',
      unsavedDiscard: 'There are unsaved changes. Discard?',
      unsaved: 'Unsaved changes',
      confirmDelete: 'Delete "{name}"{dir}?', deleteDir: ' and all contents',
      promptRename: 'New name:', invalidName: 'Name cannot contain "/"',
      samePath: 'Source and destination are the same.',
      copyCutLabel: '{a}: {name}',
      newFilePh: 'new-file.txt', newFolderPh: 'new-folder',
      paste: 'Paste', cancel: 'Cancel',
      createBtn: 'Create', execBtn: 'Exec', reload: 'Reload',
      createTip: 'Create file/folder', execTip: 'Run command', reloadTip: 'Reload',
      file: 'File', folder: 'Folder',
      back: 'Back', close: 'Close',
      rename: 'Rename', edit: 'Edit', copy: 'Copy', cut: 'Cut', deleteItem: 'Delete',
      saving: 'Saving…', saved: 'Saved', save: 'Save',
      pasteCut: 'Paste (cut)', pasteCopy: 'Paste (copy)',
      shellRename: 'Rename', shellDelete: 'Delete',
      noReturn: 'no return', failed: 'failed',
      execTitle: 'Run command · {n}'
    },
    days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  }
};

const I18nCtx = createContext({ locale: 'pt', t: (k) => k, setLocale: () => {} });

function lookup(dict, key) {
  const path = key.split('.');
  let v = dict;
  for (const p of path) {
    if (v && typeof v === 'object' && p in v) v = v[p];
    else return undefined;
  }
  return v;
}

function format(str, params) {
  if (!params || typeof str !== 'string') return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => params[k] != null ? params[k] : '');
}

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState('pt');

  useEffect(() => {
    let mounted = true;
    window.api.config.get('locale').then((v) => {
      if (!mounted) return;
      if (v === 'en' || v === 'pt') setLocaleState(v);
    });
    return () => { mounted = false; };
  }, []);

  const setLocale = async (l) => {
    setLocaleState(l);
    await window.api.config.set('locale', l);
  };

  const t = (key, params) => {
    const dict = DICTS[locale] || DICTS.pt;
    const fallback = DICTS.pt;
    const v = lookup(dict, key);
    if (v === undefined) return format(lookup(fallback, key) || key, params);
    return format(v, params);
  };

  return React.createElement(I18nCtx.Provider, { value: { locale, setLocale, t } }, children);
}

export function useI18n() {
  return useContext(I18nCtx);
}

export function useT() {
  return useI18n().t;
}

export function getDays(locale) {
  return DICTS[locale]?.days || DICTS.pt.days;
}
