---
description: Importa lo que haya en CONTEXTO/ (notas, CSV, chats, fotos), lo pasa a tu historial en Markdown y actualiza tu web en directo
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs":*), Read, AskUserQuestion, Agent
---
Vas a importar los entrenos de la persona con gymhub. **Tú normalizas; el script separa, valida, calcula y escribe.** Habla en español, con frases cortas. Mientras trabajas, la web de la persona enseña el avance sola: no hace falta que se lo cuentes lote a lote.

Usa siempre `node "${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs" <subcomando>` (en lo que sigue, «el script»). No leas ni escribas tú los ficheros de la carpeta de datos, salvo las imágenes que te indique el script, que sí lees con Read.

## Estado de la importación (ya ejecutado: `refresh preparar`)

!`node "${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs" refresh preparar`

## Reglas de normalización (FORMATO.md, se cargan siempre)

!`node "${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs" formato`

## Cómo se guarda

!`node "${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs" guia guardar`

## Lo propio de esta persona: convenciones.md y catálogo

!`node "${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs" contexto`

## Pasos

1. **Nada nuevo.** Si el estado dice «Nada nuevo en CONTEXTO/», díselo a la persona en una línea, recuerda que deje sus entrenos en `CONTEXTO/` y para.
2. **Pasada de muestreo** (solo si el estado dice `MUESTREO`):
   - Ejecuta `refresh muestra` y estudia cómo apunta esta persona: orden de las fechas, notación de series, unidades, máquinas, escala de sensaciones y abreviaturas.
   - Junta **todas** las dudas generales y pregúntalas de una vez con AskUserQuestion (como mucho 4 preguntas, con opciones concretas). Si no puedes preguntar, decide lo más probable y anótalo como duda.
   - Escribe `convenciones.md` completo con el script: `escribir convenciones.md <<'GYMHUB_FIN' … GYMHUB_FIN`, con el formato de FORMATO §4. Cada duda que se pueda generalizar se pregunta **una sola vez** y se guarda ahí.
3. **Lotes.** Para cada lote pendiente, en orden:
   - Ejecuta `refresh lote <n>`.
   - Normaliza cada elemento según FORMATO.md. Si choca con convenciones.md, manda convenciones.md. Ejercicios: usa los ids del catálogo; si falta uno, añádelo en un bloque `@@@ ejercicios` del mismo envío.
   - Guarda el lote completo: `refresh guardar <n> <<'GYMHUB_FIN' … GYMHUB_FIN`. Si responde «NO SE HA GUARDADO NADA», corrige lo que dice y reenvía el lote **entero**.
   - Las dudas concretas (una fecha rara, un ejercicio ambiguo) **no se preguntan**: decide lo más probable y añádelas en `@@@ revision`. Si descubres algo general de cómo apunta (un formato nuevo, otra máquina), actualiza convenciones.md en un bloque `@@@ convenciones`.
   - **Importaciones grandes** (más de 6 lotes): para no llenar el contexto, puedes repartir los lotes entre subagentes (herramienta Agent), de uno en uno o como mucho dos a la vez. A cada subagente pásale: la ruta del script, el número de lote, que cargue las reglas con `formato`, `guia guardar` y `contexto`, y que te devuelva solo el resultado de `refresh guardar`. Al final, revisa tú que el catálogo quede coherente (sin dos ids para el mismo ejercicio; para unificarlos, `@@@ alias`).
4. **Cierre:** `refresh cerrar`. Mueve lo importado a `CONTEXTO/procesado/`, rehace `records.md` y el «Estado actual» de FICHA.md, y avisa a la web.
5. **Resumen en el chat**, en 2 a 4 líneas:
   - lo que dice el cierre: «N sesiones nuevas (fechas) · PRs · dudas en revision.md»;
   - lo que hayas aprendido de cómo apunta (si es la primera vez);
   - lo que ignoraste y por qué, si es relevante.

   Si hay dudas, sugiere `/gymhub:revision`. Las cifras (e1RM, PRs, volumen) son las del script: no calcules ni estimes ninguna.

   Si el cierre (o el estado, cuando no hay nada nuevo) trae una línea `SUGERENCIA`, termina tu respuesta con su texto, tal cual: «¿Hacemos el repaso de la semana? → /gymhub:semana».
