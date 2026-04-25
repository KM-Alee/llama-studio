; LlamaStudio NSIS hooks (Tauri bundler).
; See https://v2.tauri.app/distribute/windows-installer/
;
; Finishes the native installer experience: optional browser open to official llama.cpp
; (GPU users should pick a matching release asset instead). No prompt for silent /S.

!macro NSIS_HOOK_PREINSTALL
!macroend

!macro NSIS_HOOK_POSTINSTALL
  IfSilent skip_llama_prompt
  MessageBox MB_YESNO|MB_ICONINFORMATION|MB_DEFBUTTON2 "Local chat needs separate llama.cpp server binaries (not redistributed in this package).$\r$\n$\r$\nIn the app, use Settings, then Runtime Dependencies, to check what is installed.$\r$\n$\r$\nOpen the official download page in your web browser now?" /SD IDNO IDYES _ls_open
  Goto _ls_done
  _ls_open:
  ExecShell "open" "https://github.com/ggerganov/llama.cpp/releases/latest"
  _ls_done:
  skip_llama_prompt:
!macroend

!macro NSIS_HOOK_PREUNINSTALL
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
!macroend
