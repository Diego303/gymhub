---
description: Resumen de un ejercicio en el chat y su ficha completa en la web (vista Ejercicios); la gráfica del Panel pasa a ese ejercicio
argument-hint: "<nombre>"
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs":*)
model: sonnet
---
Ejercicio pedido: «$ARGUMENTS»

Ejecuta `node "${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs" ejercicio "<nombre>"`, con el nombre entre comillas.

- Si encuentra el ejercicio, resume en 3 o 4 líneas lo que dice: e1RM actual y mejor marca, tendencia de 12 meses, objetivo y predicción si los hay, y las últimas sesiones. Usa **solo** sus cifras. Termina diciendo que la web muestra su ficha.
- Si propone candidatos, pregunta cuál es (o elige el evidente y repite la orden).
- Si no lo encuentra, dilo en una línea.
