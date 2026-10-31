---
description: Abre tu web de gymhub (se actualiza sola mientras importas o registras)
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs":*)
model: haiku
---
Resultado: !`node "${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs" web`

Dile a la persona, en una línea y sin usar herramientas, que su web está abierta (o el problema, si lo hay). Si el resultado dice que no hay carpeta, sugiere `/gymhub:configurar`.
