# gymhub · informe de QA

Plan y matriz de pruebas: [`QA-PLAN.md`](QA-PLAN.md). Este informe se mantiene al día fase a fase.

## Resumen

| Fase | Estado |
|---|---|
| G0 · Inventario y plan | hecho (`f01a0cd`) |
| G1 · Formato, parser y catálogo | hecho: 16 bugs corregidos |
| G2 · Métricas | hecho: 5 bugs corregidos; las cifras de las 6 vistas cuadran con el cálculo a mano |
| G3 · /refresh, idempotencia y datos | pendiente |
| G4 · Plugin | pendiente |
| G5 · Web e2e | pendiente |
| G6 · Rendimiento | pendiente |
| G7 · Validación de datos reales | pendiente (necesita permiso) |

**Tests:** 165 en `pnpm test`, todos en verde (eran 91), también con `TZ=UTC`, `Europe/Madrid` y `America/Los_Angeles`.

## Bugs

Gravedad: **crítico** = número incorrecto, pérdida o corrupción de datos, o fuga de datos personales; alto; medio; bajo. Cada arreglo va en su commit `fix(...)` con un test que falla sin el arreglo (comprobado en cada caso) y pasa con él.

| Id | Gravedad | Qué pasa · cómo reproducirlo | Causa | Arreglo · commit · test |
|---|---|---|---|---|
| B01 | crítico (pérdida) | Una sesión cuyo texto original contiene `</details>` (algo copiado de una web): el original se corta y el resto aparece en las Notas | El bloque «Original» se leía hasta el primer `</details>` | Se lee hasta el último · `72791a3` · `formato.test.mjs` «un texto original que contiene…» |
| B02 | crítico (pérdida) | Nota de serie «agarre \| cerrado» → se guarda «agarre» | Las celdas se partían por cualquier `\|` y el serializador no escapaba | `\|` se escapa como `\\|` (también en el borrador de los CSV); una fila con celdas de más es un error · `6c93170` · «una «\|» dentro de una celda…», «una fila con más celdas…», «el borrador de un CSV…» |
| B03 | crítico (pérdida) | `refresh guardar` perdía las notas bajo un ejercicio, las líneas de «Ejercicios» antes del primero, el texto de «Cardio» y el párrafo antes de la primera sección | `escribirSesion` no escribía `ej.nota` y el parser tiraba las líneas sueltas | `nota` del ejercicio y `sueltas` se conservan y se escriben en su sitio · `557e734` · «el texto suelto que no es una tabla…» |
| B04 | crítico (pérdida) | Una línea «# 3 series más…» dentro de Notas o Calentamiento desaparecía | Se saltaba cualquier `# ` pensando que era el título | Solo se salta antes de la primera sección · `616643c` · «una línea que empieza por «# »…» |
| B05 | crítico (corrupción) | Títulos o textos del frontmatter con `\`, tabulador, «-5», espacios en los extremos o `"x" # comentario` cambiaban al guardar | `JSON.stringify` al escribir, pero solo se deshacía `\"` al leer; «-5» sin comillas | Comillas dobles con escapes JSON; solo sin comillas lo que se relee igual · `464cd7c` · «los textos del frontmatter no cambian…» |
| B06 | alto | Una sesión guardada con el Bloc de notas (UTF-8 con BOM) dejaba de contar («falta el frontmatter»); igual con plantillas y repasos | El BOM rompía `^---` | Se quita el BOM al leer · `e98755e` · «un fichero con BOM…» |
| B07 | crítico (pérdida) | Dos `## Observaciones`: la primera se vaciaba | Cada sección repetida reiniciaba su texto | Se juntan · `e858a9b` · «dos secciones desconocidas con el mismo título…» |
| B08 | crítico (número) | Una tabla con «peso» en vez de «carga» (o sin «reps») daba series sin carga: volumen y e1RM mal, sin aviso. Además, columnas extra («descanso») se perdían | No se comprobaban las columnas | Sin `carga`/`reps` es un error con su línea; las columnas extra se conservan y avisan · `0726d19` · «las columnas que no son del formato…» |
| B09 | medio | Los errores no decían en qué línea estaban | — | «(línea N)» del fichero o del bloque · `7a77094` · «cada error dice en qué línea está» |
| B10 | alto (número) | Una sesión con un año mal escrito (2062) contaba: racha siempre viva, «última sesión» falsa | No se comprobaba la fecha frente a hoy | Fecha posterior a mañana = error visible (no cuenta hasta corregirla) · `77420a3` · «una fecha en el futuro…» · ver decisión D2 |
| B11 | crítico (número) | `- jalón: nivel 1 = 5 kg, +5 kg por nivel` (el ejemplo de FORMATO §4) se ignoraba: las series en «nivel» no sumaban toneladas ni e1RM | El script solo entendía `- equivalencia jalón: …` | Valen las dos formas · `56fce38` · `convenciones.test.mjs` |
| B12 | medio | Dos `orden:` contradictorios o dos equivalencias distintas para la misma máquina: se elegía una en silencio | — | Aviso en `datos.json` y en `contexto` (lo que lee Claude), sin cambiar cuál se usa · `252aae4` · «si dos convenciones chocan…» |
| B13 | alto (número) | Un alias de dos ejercicios («remo») se resolvía al primero de la tabla: un objetivo de FICHA.md podía ir al ejercicio equivocado según el orden de las filas | El segundo intento de `buscar` ignoraba la marca de ambiguo | Un nombre ambiguo no se adivina (null); `/gymhub:ejercicio` ofrece candidatos · `f0df6b6` · `catalogo.test.mjs` · ver D3 |
| B14 | alto | Espacios detrás de `---` invalidaban la sesión entera; detrás de `<!-- id: … -->`, el ejercicio quedaba sin id | Las expresiones exigían el fin de línea exacto | Se toleran (sesiones, plantillas, repasos) · `5045053` · «espacios detrás de los «---»…», «espacios al final de la línea del id…» |
| B15 | medio | Con `orden: mes/día`, 03/04 se leía bien pero se le pasaba a Claude como «AMBIGUA» | Caso «md» con `ambigua: x !== y` | `ambigua: false` cuando decide la convención · `9f2466b` · «el orden de fechas de convenciones.md decide…» |
| B16 | medio | Tras arreglar el parser, las carpetas existentes seguían usando sesiones leídas con el parser viejo (caché con versión fija) | `VERSION_CACHE = 2` | La versión es un hash de `canonico.mjs` y `sesiones.mjs` · `d6e053f` · «la caché de sesiones de otra versión…» |
| B17 | alto | Un ejercicio apuntado a «0 kg» en 4 sesiones (o una asistida con más ayuda que el peso corporal) dejaba la pestaña Análisis entera en «Error al calcular esta vista» | Escala «kg» sin e1RM; `estancados` llamaba a `diasEntre(null, …)` | La escala «kg» exige carga positiva y `estancados` ignora lo que no tiene e1RM · `b48beda` · `metricas-limites.test.mjs` «un ejercicio a «0 kg»…» |
| B18 | bajo | El sueño medio podía salir «7h 60m» | Se separaban horas y minutos antes de redondear | Se redondea al minuto primero · `4b26368` · «las horas se redondean…» |
| B19 | medio | `- press-banca: 0 kg` en FICHA.md salía al 100 % y «conseguido» | División por cero | Un objetivo no positivo no es un objetivo · `90e2923` · «ninguna vista da NaN ni Infinity…» |
| B20 | crítico (número) | PR falso al apuntar en libras lo mismo que antes en kg: 220,46 lb = 100,0007 kg; 100 kg exportados como 220,5 lb = 100,02 kg. También «mejora» falsa en estancados y nueva «mejor marca» | Comparación con margen 1e-9 | Las cifras en kg se comparan con 0,1 kg de margen (el salto real mínimo es 0,5 kg) · `18aae1c` · «no hay PR falso por cambiar de unidad…» |
| B21 | bajo | La segunda sesión del día (-2) se ordenaba antes que la primera, -10 antes que -2, y dependía del idioma del sistema; afecta a qué sesión se lleva el PR, al Diario y a la rutina de hoy | `localeCompare` sobre la ruta | Orden por fecha y número de sufijo · `4ee9061` · «dos sesiones del mismo día van en su orden…» |

## Decisiones dudosas (para el autor)

- **D1 · `docs/FORMATO.md` sin versionar (bloqueante para publicar).** `main` ya está en GitHub, pero el subcomando `formato` imprime `docs/FORMATO.md`, que no está en el repo. En una instalación desde GitHub, `/gymhub:refresh` y la skill reciben «AVISO: falta docs/FORMATO.md», y Claude normaliza solo con `guardar.md`, sin las reglas de §3 (fechas, notaciones, unidades, calentamiento…). El README también enlaza `docs/FORMATO.md` y `docs/maquetas/`. Recomendación: versionar `docs/FORMATO.md` (y decidir qué pasa con las maquetas). No lo he hecho porque pediste no incluirlo.
- **D2 · Fecha futura = error.** Elegí error (la sesión no cuenta hasta corregirla y la web la enseña en la cabecera) en vez de aviso, con un día de margen por las zonas horarias. La alternativa es contarla con un aviso que la web hoy no muestra.
- **D3 · Nombre ambiguo = sin resolver.** Un objetivo de FICHA.md con un nombre ambiguo queda sin datos (0 %) en lugar de ir al primer ejercicio de la tabla. Es lo que pretendía el código (`ambiguos`), pero cambia el resultado si alguien tiene alias repetidos.
- **D4 · Mes de una semana que empieza en domingo.** El encargo de Semana dice «el mes de una semana es el de su jueves». El de QA dice «inicio + 3 días». Para semanas de lunes coinciden. Para semanas de domingo, inicio + 3 es miércoles. Se mantiene el jueves.

## Notas sobre lo no implementado

No hay código a medias de Cuerpo, Nivel, Proyección, Tu año ni del indicador de calidad de datos. Para cuando se construyan:
- Las métricas nuevas deben salir de `lib/` (la web no calcula) y entrar en `construirDatos` con su propio `try` (como hoy cada vista).
- Cualquier cambio en el parser invalida la caché solo (B16).
- El indicador de calidad de datos tiene ya sus fuentes: `datos.errores`, `datos.avisos` (columnas desconocidas, convenciones que chocan, RPE en rango…) y `revision.md`.
