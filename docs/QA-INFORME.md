# gymhub · informe de QA

Plan y matriz de pruebas: [`QA-PLAN.md`](QA-PLAN.md). Este informe se mantiene al día fase a fase.

## Resumen

| Fase | Estado |
|---|---|
| G0 · Inventario y plan | hecho (`f01a0cd`) |
| G1 · Formato, parser y catálogo | hecho: 16 bugs corregidos |
| G2 · Métricas | hecho: 5 bugs corregidos; las cifras de las 6 vistas cuadran con el cálculo a mano |
| G3 · /refresh, idempotencia y datos | hecho: 7 bugs corregidos; contrato, idempotencia, ediciones a mano y 100 procesos matados sin corrupción |
| G4 · Plugin | hecho: 1 bug corregido; el plugin no tiene hooks (esas pruebas no aplican) |
| G5 · Web e2e | hecho: 4 bugs corregidos (uno de seguridad); cifras, recarga en vivo, XSS, diseño, teclado y capturas de referencia |
| G6 · Rendimiento | hecho: 1 bug corregido (3 s → 1,3 s); todo dentro de los límites con 5 años |
| G7 · Validación de datos reales | `pnpm qa:validar` hecho y probado con una carpeta inventada; **sin ejecutar sobre tus datos: necesita tu permiso** |

**Tests:** 198 en `pnpm test` (eran 91) y 31 en Playwright (19 e2e y 12 capturas), todos en verde, también con `TZ=UTC`, `Europe/Madrid` y `America/Los_Angeles`.

### Scripts

| Script | Qué ejecuta |
|---|---|
| `pnpm test` | `node --test`: parser, métricas, /refresh, plugin, CLI. Con `--cobertura`, la de `lib/` |
| `pnpm test:e2e` | Playwright en Chromium (`file://`): cifras de las 6 vistas, recarga en vivo, XSS, diseño adaptable, teclado y rendimiento de la web |
| `pnpm test:visual` | Capturas de referencia por vista en `test/visual/`, claro y oscuro |
| `pnpm test:rendimiento` | 5 años inventados: métricas < 2 s, `datos.js` < 1 s y < 3 MB |
| `pnpm test:todo` | Todo: `pnpm test` en UTC (con cobertura), Madrid y Los Ángeles, rendimiento, lint, `test:web` (Chromium y Firefox), `test:e2e` y `test:visual` |
| `pnpm qa:validar -- --datos <ruta>` | G7: validación de solo lectura de una carpeta (recuentos y fichero:línea) |

### Cómo se ha probado lo que no se puede automatizar

- **Normalización con Claude:** se prueban el contrato (validador, idempotencia, protección) y las instrucciones (la skill y `/refresh` cargan formato, guía y contexto; los ejemplos de la skill pasan el validador). La normalización real con un modelo sigue en `scripts/e2e-persona.mjs`, a mano.
- **Abrir el navegador de Windows:** se prueba la elección del programa con un `PATH` falso (`wslview`, `explorer.exe` + `wslpath -w` y el fallo de los dos). Abrirlo de verdad, a mano.
- **Instalación desde GitHub:** se prueba la instalación con alcance de proyecto desde el repo local, en una config de Claude aislada. Desde GitHub depende de lo que haya en `main` (ver D1).
- **Un test intermitente investigado.** «Pestaña abierta mucho rato» falló una vez al ir en paralelo con otros. No se ha vuelto a reproducir en más de 20 pasadas (15 con `--repeat-each=3` y 4 workers, más las de `test:todo`). Las medidas (scripts, nodos y memoria antes y después) van en el mensaje del test por si vuelve a pasar. No se han añadido reintentos.

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
| B22 | medio | Si Claude fechaba una sesión a más de 2 meses de la fecha de su mensaje o fichero, entraba sin duda (FORMATO §3.2 pide revisarlo) | No se comprobaba | Duda en revision.md con la fecha de origen · `b13a335` · `refresh-contrato.test.mjs` «fechas cambiadas…» |
| B23 | alto | Un enlace roto o un fichero sin permiso en CONTEXTO/ tumbaban `refresh preparar` con un error de Node, y la web se quedaba para siempre en «Separando CONTEXTO/…» | `statSync`/`readFileSync` sin control | Se dejan en su sitio, se avisa de cuáles y por qué y se importa el resto; si separar falla, el banner se cierra · `f02a407` · `refresh-robustez.test.mjs` |
| B24 | medio | Un `.txt` (o un fichero sin extensión) binario se le pasaba a Claude como texto basura | — | Imagen por sus primeros bytes, o binario apartado (se archiva intacto) · `0c52c34` · «un binario con extensión de texto…» |
| B25 | alto | Una orden matada a mitad dejaba `.gymhub/cerrojo`: la siguiente esperaba 60 s y fallaba, durante 10 minutos | El cerrojo no sabía de quién era | Guarda el pid; si ese proceso no existe, se quita en el acto · `5deda6e` · «un cerrojo que dejó un proceso muerto…» |
| B26 | crítico (número) | Un ejercicio con U+2028 en el nombre no se reconocía y sus series se sumaban al ejercicio anterior; un título con U+2028 desaparecía | «.» no casa con U+2028/U+2029 | Bandera `s` en el parser y escape al escribir · `94817cb` · «un título con U+2028…» y el generador de propiedades |
| B27 | medio | Archivar un chat terminado de la raíz de CONTEXTO/ se llevaba las fotos de otro chat a medias, que en la siguiente importación quedaba sin imágenes | `startsWith` sobre carpetas | Cada adjunto se archiva con su propio chat · `925387c` · «al archivar un chat terminado…» |
| B28 | medio | Un `procesados.json` o `generadas.json` dañado desde fuera se trataba como vacío en silencio | `leerJSON` devuelve el valor por defecto | Copia en `.gymhub/copias/`, aviso y se empieza de cero · `f4964a0` · «un procesados.json o generadas.json dañado…» |
| B29 | medio | En WSL sin wslview ni wslpath, `/gymhub:web` fallaba con «spawnSync wslpath ENOENT»; con wslpath pero sin explorer.exe decía «abierta» y el proceso se rompía después (igual sin xdg-open en Linux) | No se comprobaba qué había; el error de `spawn` no se escuchaba | Se comprueba antes y, si no se puede, se da la ruta para abrirla a mano · `5874619` · `abrir.test.mjs` |
| B30 | crítico (seguridad) | XSS: un nombre de ejercicio, un motivo de descarga o un error de formato con `<img src=x onerror=…>` se ejecutaba al pasar el ratón por un tooltip | `tt.innerHTML = getAttribute("data-tt")`: leer el atributo deshace el escape | El tooltip escapa todo y solo permite `<br>` y `<b>` · `8b1af89` · `tests/e2e/xss.spec.mjs` (HTML en catálogo, títulos, notas, zonas, programa, hitos, repaso y errores; 6 vistas y todos sus tooltips) |
| B31 | medio | Un `datos.js` a medias o dañado no avisaba; sin `datos.js`, «Cargando datos…» para siempre (PLAN §2.6 pide aviso) | — | Se queda el último estado bueno con un aviso que se va al volver a publicar; sin datos, instrucciones · `0a32a95` · `tests/e2e/vivo.spec.mjs` |
| B32 | medio | El buscador de Ejercicios distinguía tildes («jalon», «cuadriceps») y no buscaba por alias («bench», «squat») | `toLowerCase().includes` sin quitar tildes; la lista no llevaba alias | Sin tildes ni mayúsculas, por nombre, grupo, id o alias · `6d16df7` · `tests/e2e/vistas.spec.mjs` «Ejercicios…» |
| B33 | bajo | La tira de 26 semanas (pestaña Semana) se salía de su tarjeta a ~800 px CSS: 1024 px al 125 %, 1280 al 150 %, 1440 al 200 % | Rejilla fija de 13 × 16 px | Celdas de 8 a 16 px, cuadradas · `93ab1c7` · `tests/e2e/adaptable.spec.mjs` |
| B34 | medio | Con 5 años (~1.000 sesiones, ~20.000 series), recalcular todo tardaba 3 s (límite 2 s); la pestaña Semana sola, 2 s | La intensidad de cada semana filtraba todo el historial con `diasEntre` (2 `Date` por comparación, más de un millón de veces); las menciones compilaban una expresión por frase | e1RM vigente en caché y fechas comparadas como cadenas; una expresión por ejercicio · `4f4db69` · `pnpm test:rendimiento` y `tests/e2e/rendimiento.spec.mjs` |

## Comparación con las maquetas (G5)

Capturas de la web real con el fixture «mini» frente a `docs/maquetas/*.html`, a 1280 px. La estructura, el orden de los bloques, la rejilla, los colores y la tipografía coinciden en las 6 vistas. Diferencias (ninguna rompe nada; son para que decidas):

- **Todas:** la web real es más ancha (la maqueta se queda en unos 760 px) y la cabecera lleva las 6 pestañas y la carpeta. La maqueta del Panel no tiene pestañas, pero PLAN §2 las pide.
- **Panel:**
  - El pie no tiene «próximo: lun · empuje».
  - La tarjeta de Rex solo enseña «serie 3 de 5 · descanso 1:45» con un entreno en vivo, como pide PLAN §2.5.
- **Análisis:** un patrón sin datos (n/d) se dibuja en el centro del radar. La maqueta no tiene ese caso. El tooltip dice «n/d».
- **Diario:** las sesiones sin sensaciones ni sueño muestran «pre — · post — · sueño —». La maqueta solo enseña los que hay.
- **Ejercicios:** con poco historial, el rango por defecto (1A) aprieta todos los puntos contra el borde derecho. «Todo» se ve mejor.
- **Semana:** una variación de 0 % sale como «▲ 0 %» en verde.

## Rendimiento (G6)

5 años inventados (1.036 sesiones, 20.720 series de trabajo), en este equipo (WSL2):

| Medida | Resultado | Límite |
|---|---|---|
| Métricas completas en frío (leer 1.036 ficheros, validar, todas las vistas) | 1,27 s | 2 s |
| Métricas completas con la caché de sesiones | 0,69–0,79 s | 2 s |
| Publicar `datos.js` | 0,10 s (1.466 KB) | 1 s |
| Carga inicial de la web (Panel pintado) | 268 ms | — |
| Primera pintura de cada vista | 11–33 ms | 200 ms |
| Cambiar de pestaña | 8–20 ms | 100 ms |
| Latido sin cambios de versión | no relee `datos.js`; sin tareas de más de 50 ms | — |
| Pestaña abierta con latido de 0,5 s y datos cambiando (45 s; `GYMHUB_RATO_S=1800` para la media hora) | sin `<script>` acumulados, DOM estable, memoria +< 3 MB | — |

## Decisiones dudosas (para el autor)

- **D1 · `docs/FORMATO.md` sin versionar (bloqueante para publicar).** `main` ya está en GitHub, pero el subcomando `formato` imprime `docs/FORMATO.md`, que no está en el repo. En una instalación desde GitHub, `/gymhub:refresh` y la skill reciben «AVISO: falta docs/FORMATO.md», y Claude normaliza solo con `guardar.md`, sin las reglas de §3 (fechas, notaciones, unidades, calentamiento…). El README también enlaza `docs/FORMATO.md` y `docs/maquetas/`. Recomendación: versionar `docs/FORMATO.md` (y decidir qué pasa con las maquetas). No lo he hecho porque pediste no incluirlo.
- **D2 · Fecha futura = error.** Elegí error (la sesión no cuenta hasta corregirla y la web la enseña en la cabecera) en vez de aviso, con un día de margen por las zonas horarias. La alternativa es contarla con un aviso que la web hoy no muestra.
- **D3 · Nombre ambiguo = sin resolver.** Un objetivo de FICHA.md con un nombre ambiguo queda sin datos (0 %) en lugar de ir al primer ejercicio de la tabla. Es lo que pretendía el código (`ambiguos`), pero cambia el resultado si alguien tiene alias repetidos.
- **D4 · Mes de una semana que empieza en domingo.** El encargo de Semana dice «el mes de una semana es el de su jueves». El de QA dice «inicio + 3 días». Para semanas de lunes coinciden. Para semanas de domingo, inicio + 3 es miércoles. Se mantiene el jueves.
- **D5 · Margen de 0,1 kg al comparar cifras en kg** (B20). Quita los PR falsos por redondeo de libras. A cambio, una mejora real de menos de 0,1 kg de e1RM (imposible con discos) no cuenta como PR.
- **D6 · Binarios con extensión de texto** (B24). Se apartan como multimedia y se archivan intactos en `procesado/`, sin pasarlos a Claude. Si es una foto sin extensión, va como imagen.
- **D7 · Buscador de Ejercicios por alias** (B32). PLAN §2.4b dice «por nombre o grupo». Lo he ampliado a alias porque el encargo de QA pide sinónimos.
- **D8 · Columnas obligatorias de una tabla de series** (B08). Sin `carga` o sin `reps`, la sesión es un error (no cuenta hasta corregirla). Antes contaba con las series vacías.

## G7 · Tus datos reales (pendiente de tu permiso)

`pnpm qa:validar -- --datos <ruta>`:
- copia a un temporal lo que hace falta (sesiones/, plantillas/, semanas/ y los `.md` de la raíz; no copia `CONTEXTO/` ni `.gymhub/`);
- valida cada sesión con el catálogo de tu carpeta y su ida y vuelta;
- lista ejercicios fuera del catálogo, líneas no reconocidas, fechas raras, duplicadas, saltos de más del 30 % y mezcla de kg y lb;
- al final comprueba que el original no ha cambiado (tamaño, fecha y hash de cada fichero).

El informe solo lleva recuentos y `fichero:línea`: ni notas, ni títulos, ni pesos. Está probado con una carpeta inventada (`tests/qa-validar.test.mjs`). **No lo he ejecutado sobre tu carpeta.** Cuando me des permiso, lo lanzo en solo lectura y te paso el resultado.

## Notas sobre lo no implementado

No hay código a medias de Cuerpo, Nivel, Proyección, Tu año ni del indicador de calidad de datos. Para cuando se construyan:
- Las métricas nuevas deben salir de `lib/` (la web no calcula) y entrar en `construirDatos` con su propio `try` (como hoy cada vista).
- Cualquier cambio en el parser invalida la caché solo (B16).
- El indicador de calidad de datos tiene ya sus fuentes: `datos.errores`, `datos.avisos` (columnas desconocidas, convenciones que chocan, RPE en rango…) y `revision.md`.
