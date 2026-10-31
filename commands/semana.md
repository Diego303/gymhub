---
description: Resumen de tu semana (volumen, PRs, sensaciones, molestias) en semanas/AAAA-Www.md, con lo que conviene ajustar
argument-hint: "[AAAA-Www | anterior]"
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs":*)
---
Vas a escribir el resumen semanal de la persona. Las cifras ya están calculadas por el script: **cópialas tal cual, sin cambiar ni añadir ninguna**. Tú solo redactas «Qué ajustar».

Argumento: «$ARGUMENTS» (una semana `2026-W44`, `anterior`, o nada para la actual).

1. Ejecuta `node "${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs" semana <argumento>`. La primera línea dice el fichero (`semanas/AAAA-Www.md`) y después viene el borrador.
2. Debajo de «## Qué ajustar» escribe de 2 a 4 viñetas, cortas y concretas, a partir de esas cifras: grupos que van cortos, constancia, descarga, estancados, sueño… Si hay molestias, como mucho «valora consultarlo»; nunca diagnostiques. Quita el comentario `<!-- … -->`.
3. Guárdalo con `node "${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs" escribir semanas/AAAA-Www.md <<'GYMHUB_FIN' … GYMHUB_FIN`.
4. En el chat, responde en 3 a 5 líneas: lo esencial de la semana y tus ajustes. Di dónde está el fichero.
