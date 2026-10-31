---
description: Muestra o cambia la carpeta de datos de gymhub
argument-hint: "[ruta]"
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs":*), AskUserQuestion
model: haiku
---
Carpeta actual:
!`node "${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs" carpeta`

Argumento: «$ARGUMENTS»

- Sin argumento: dile a la persona cuál es su carpeta de datos, en una línea, y cómo cambiarla (`/gymhub:carpeta <ruta>`).
- Con argumento: ejecuta `node "${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs" carpeta "<ruta>"`, con la ruta entre comillas.
  - Si responde `SIN_ESTRUCTURA`, pregunta con AskUserQuestion si quiere crear ahí la estructura de gymhub. Si dice que sí, ejecuta `configurar "<ruta>"`; si no, deja la carpeta como estaba.
  - Responde en una línea con el resultado.
