---
description: Abre tu web en la vista Análisis (equilibrio por patrón, carga, predicciones). Modo fuerza o volumen
argument-hint: "[fuerza|volumen]"
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs":*)
model: haiku
---
Argumento: «$ARGUMENTS»

Ejecuta `node "${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs" web analisis --si-hace-falta`, añadiendo `--modo fuerza` o `--modo volumen` si el argumento es uno de esos dos (si es otra cosa, ignóralo). Después dile a la persona, en una línea, lo que dice el resultado.
