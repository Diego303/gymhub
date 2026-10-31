---
description: Repasa contigo, una a una, las dudas pendientes de la importación (revision.md)
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs":*), AskUserQuestion
---
Vas a repasar con la persona las dudas que dejó la importación. Habla en español, con frases cortas.

Dudas pendientes:
!`node "${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs" revision`

Para cada duda, en orden (como mucho 8 en esta ronda):

1. Si nombra una sesión, léela con `node "${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs" leer <ruta>` para tener el contexto. El texto original está al final.
2. Pregunta con AskUserQuestion, con la decisión tomada como primera opción («Está bien así») y una o dos alternativas concretas. La persona puede escribir otra cosa.
3. Según la respuesta:
   - **Está bien:** `revision marcar <n> --nota "confirmado"`.
   - **Hay que corregir la sesión:** escribe la sesión completa corregida y guárdala con `corregir <ruta> <<'GYMHUB_FIN' … GYMHUB_FIN`. Valida el formato y guarda copia de la anterior; el original se conserva. Después, `revision marcar <n> --nota "<qué cambió>"`.
   - **Dos sesiones del mismo día que son la misma:** corrige la buena con todo y deja la otra como está; anótalo en la nota para que la persona la borre si quiere. Tú no borras ficheros.
   - **Era una convención** (una forma de apuntar que se repetirá): actualiza `convenciones.md` con `leer convenciones.md` + `escribir convenciones.md`, para no volver a preguntarlo.
4. Al final, resume en 2 o 3 líneas qué se ha resuelto y cuántas dudas quedan.

Si no hay dudas pendientes, dilo en una línea.
