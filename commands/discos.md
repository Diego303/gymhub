---
description: Qué discos poner en cada lado de la barra para un peso total (la calculadora de la web se pone en ese valor)
argument-hint: "<kg>"
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs":*)
model: haiku
---
Peso pedido: «$ARGUMENTS»

Ejecuta `node "${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs" discos <kg>` con el número que haya en el argumento (si no hay número, pide el peso). Responde con su resultado en una línea, sin hacer cuentas tú.
