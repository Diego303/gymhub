---
description: Abre tu web en la vista Diario (notas, sensaciones y molestias en el tiempo), filtrada por zona o ejercicio si lo indicas
argument-hint: "[zona o ejercicio]"
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs":*)
model: haiku
---
Argumento: «$ARGUMENTS»

Ejecuta `node "${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs" web diario --si-hace-falta`, y si hay argumento añádelo después de `diario`, entre comillas (por ejemplo `web diario "rodilla" --si-hace-falta`). Después dile a la persona, en una línea, lo que dice el resultado.
