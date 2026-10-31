---
description: Cierra el entreno en vivo de hoy, te pide la sensación y las notas, y lo importa a tu historial
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs":*), AskUserQuestion, Read
---
Vas a cerrar el entreno en vivo de hoy.

1. Pregunta con AskUserQuestion, en una sola llamada:
   - la sensación al terminar, de 0 a 10 (opciones 6, 7, 8, 9);
   - si quiere añadir una nota (opción «Sin notas»).

   Si no puedes preguntar, sigue sin ellas.
2. Ejecuta `node "${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs" fin --post <n> --notas "<texto>"`, poniendo solo lo que haya contestado.
3. Importa lo apuntado con el mismo flujo de `/gymhub:refresh`:
   - carga las reglas con `formato`, `guia guardar` y `contexto`;
   - después `refresh preparar`, `refresh lote <n>`, `refresh guardar <n>` y `refresh cerrar`.

   Lo normal es un solo lote con el fichero `AAAA-MM-DD-en-vivo.md`. Si hay otros ficheros nuevos en CONTEXTO/, se importan también.
4. Resume en 2 líneas lo que dice el cierre (sesión guardada, PRs). Las cifras, solo las del script.
