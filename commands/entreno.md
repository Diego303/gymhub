---
description: Empieza el entreno de hoy (opcional, para registrar desde el terminal). Rutina, calentamiento y prehab; Rex se pone a levantar
argument-hint: "[plantilla]"
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs":*)
model: sonnet
---
Plantilla pedida: «$ARGUMENTS»

Ejecuta `node "${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs" entreno`, añadiendo el nombre de la plantilla entre comillas si se ha pedido una. Enseña la rutina, el calentamiento y el prehab tal como los da (no recalcules pesos ni discos), y recuerda en una línea cómo apuntar: `/gymhub:serie "sentadilla 5x120 @8"`. Al acabar, `/gymhub:fin`.
