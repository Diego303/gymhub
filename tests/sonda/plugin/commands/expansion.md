---
description: Sonda F0 de gymhub. Muestra cómo se expanden argumentos, variables y la preejecución
argument-hint: "<a> <b>"
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/sonda.mjs":*)
model: haiku
---
ARGS=[$ARGUMENTS] A0=[$0] A1=[$1] IDX0=[$ARGUMENTS[0]]
ROOT=[${CLAUDE_PLUGIN_ROOT}] DATA=[${CLAUDE_PLUGIN_DATA}] SESION=[${CLAUDE_SESSION_ID}]
Preejecución: !`node "${CLAUDE_PLUGIN_ROOT}/bin/sonda.mjs" formato`

Copia literalmente todo lo anterior, sin usar herramientas.
