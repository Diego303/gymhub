---
description: Primer uso de gymhub. Crea tu carpeta de gimnasio con sus plantillas, te pregunta tus objetivos (todo opcional) y abre tu web
argument-hint: "[ruta de la carpeta]"
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs":*), AskUserQuestion
---
Vas a dejar lista la carpeta de gimnasio de la persona con gymhub. Habla en español, con frases cortas.

Situación actual:
!`node "${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs" estado`

Argumento recibido (la ruta, si la hay): «$ARGUMENTS»

Sigue estos pasos. Usa siempre el script `node "${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs" <subcomando>` y nunca escribas tú los ficheros de la carpeta de datos.

1. **Node.** Si la línea `node:` dice que necesita 20 o superior, explica cómo instalar Node.js (https://nodejs.org) y para.
2. **Elige la carpeta.**
   - Si hay argumento, esa es la carpeta (el script entiende `D:\GIMNASIO`, `~/GIMNASIO` y rutas relativas).
   - Si no, pregunta con AskUserQuestion. Opciones, en este orden: el directorio de la sesión (recomendado si el plugin está instalado para este proyecto), la carpeta configurada si ya hay una, y la carpeta por defecto. La persona puede escribir otra.
   - Si no puedes preguntar (sesión sin nadie), usa la carpeta configurada o, si no hay, el directorio de la sesión.
3. **Crea la estructura:** `configurar "<ruta>"`. Nunca sobrescribe nada: si ya existía, solo añade lo que falte.
4. **Objetivos (todo opcional).** Pregunta con AskUserQuestion, en una sola llamada:
   - cuántos días por semana quiere entrenar (3, 4 o 5; puede escribir otro número);
   - si quiere objetivos de fuerza (1RM) para algún ejercicio, por ejemplo «sentadilla 140, banca 100» (opción «Ahora no»);
   - si tiene alguna lesión o limitación que convenga recordar (opción «Ninguna»).
   Guarda lo que conteste con `ficha --dias N --objetivo "sentadilla=140" --objetivo "press banca=100" --lesion "texto"`. Lo que diga que no, no lo pongas. Si no puedes preguntar, sáltate este paso.
5. **Abre la web:** `web`.
6. **Resume** en 3 o 4 líneas: la carpeta, lo guardado en la ficha y el siguiente paso: «deja tus entrenos en `CONTEXTO/` (notas, un CSV, un export de chat o fotos) y usa `/gymhub:refresh`». Si el directorio de la sesión no es la carpeta de datos, recuerda que lo cómodo es abrir Claude Code en esa carpeta e instalar gymhub solo ahí: `claude plugin install gymhub --marketplace Diego303/gymhub --scope project`.
