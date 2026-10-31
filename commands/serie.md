---
description: Apunta una serie en vivo, por ejemplo /gymhub:serie "sentadilla 5x120 @8". Marca la casilla de la rutina y arranca el descanso
argument-hint: "\"<ejercicio reps x carga @RPE>\""
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs":*)
model: haiku
---
Serie: «$ARGUMENTS»

Identifica el ejercicio con el catálogo (si dudas, `node "${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs" catalogo` y elige el id). Después ejecuta:

`node "${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs" serie --ejercicio <id> -- <el texto de la serie tal cual>`

El texto se guarda sin tocar: lo normaliza `/gymhub:refresh` después. Responde con el resultado en una línea.
