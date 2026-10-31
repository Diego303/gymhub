---
description: Repaso de tu semana. gymhub calcula los datos, Claude te hace 3 preguntas y lo guarda en semanas/AAAA-Www.md (lo ves en la pestaña Semana de la web)
argument-hint: "[AAAA-Www]"
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs":*), AskUserQuestion
---
Vas a hacer con la persona el repaso de su semana. Habla en español, con frases cortas y cercanas. **Las cifras las calcula el script: no estimes ni calcules ninguna.**

Semana pedida: «$ARGUMENTS» (una semana `2026-W44` o nada para la actual).

1. **Datos.** Ejecuta `node "${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs" semana`, añadiendo la semana si se ha pedido una. Te da la semana (`AAAA-Www`), sus cifras y unos «hechos» ya redactados, cada uno con su marcador.
2. **Tres preguntas, de una en una.** Cada pregunta es una llamada distinta a AskUserQuestion, en este orden y con este texto exacto. Espera la respuesta antes de pasar a la siguiente.
   1. «¿Cómo te has sentido?». Opciones: «Con energía», «Normal», «Cansado».
   2. «¿Molestias?». Opciones: «Ninguna» y, si los datos traen molestias, una con esa zona (por ejemplo «Sí, hombro izq.»).
   3. «¿Qué priorizas la semana que viene?». Dos o tres opciones sacadas de los datos (un grupo que va corto, llegar a las sesiones del objetivo, una descarga sugerida…).

   La persona puede escribir su propia respuesta. Guárdala tal cual, en una frase. Si no puedes preguntar (sesión sin nadie), pon «(sin respuesta)».
3. **El repaso.** Como mucho 5 líneas, cada una con un marcador: `✓` bien, `★` PR, `▲` aviso, `!` molestia, `→` acción.
   - Todo apoyado en los datos: usa los «hechos» (puedes acortarlos o juntarlos), no añadas cifras nuevas.
   - La última línea es una `→` con lo que conviene la semana que viene, según la tercera respuesta y los datos.
   - Molestias: solo se registran. Si los datos dicen que se repite, «valora consultarlo». Nunca diagnostiques ni des consejo médico.
4. **Guárdalo** con el formato fijo (el script valida y añade la cabecera):

   ```
   node "${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs" semana guardar AAAA-Www <<'GYMHUB_FIN'
   ## Repaso
   - ✓ …
   - → …

   ## Preguntas
   - ¿Cómo te has sentido?: …
   - ¿Molestias?: …
   - ¿Qué priorizas la semana que viene?: …
   GYMHUB_FIN
   ```

   Si responde «NO SE HA GUARDADO NADA», corrige lo que dice y reenvía.
5. **En el chat**, 2 o 3 líneas: lo esencial de la semana y la acción. Recuerda que el repaso ya está en la pestaña Semana de la web (tecla `6`).
