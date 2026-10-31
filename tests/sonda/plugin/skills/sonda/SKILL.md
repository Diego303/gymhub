---
name: sonda
description: Sonda F0 de gymhub. Úsala solo si te piden cargar la skill de la sonda de gymhub.
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/sonda.mjs":*)
---
SKILL-ROOT=[${CLAUDE_PLUGIN_ROOT}] SKILL-DIR=[${CLAUDE_SKILL_DIR}]
Formato cargado:
!`node "${CLAUDE_PLUGIN_ROOT}/bin/sonda.mjs" formato`
