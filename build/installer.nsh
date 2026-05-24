; NSIS custom macros pro Discloud Panel.
; - customUnInstall: remove %APPDATA%\discloud-panel ao desinstalar manualmente.
;   IMPORTANTE: pula a remoção se o uninstall foi disparado em modo silent
;   (auto-update do electron-updater faz uninstall silent antes de instalar
;   a versão nova; perder os dados nessa hora arruinaria o app).

!macro customUnInstall
  IfSilent skip_userdata 0
    DetailPrint "Removendo dados do Discloud Panel..."
    RMDir /r "$APPDATA\discloud-panel"
    RMDir /r "$LOCALAPPDATA\discloud-panel-updater"
  skip_userdata:
!macroend
