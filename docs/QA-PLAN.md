# gymhub · plan de pruebas (QA)

Alcance: todo lo implementado hasta la pestaña 6 (Semana), incluida. Quedan fuera Cuerpo, Nivel, Proyección, Tu año y el indicador de calidad de datos, que no existen (no hay código a medias de ninguna de esas vistas).

Documentos de referencia: `docs/PLAN.md`, `docs/FORMATO.md`, `docs/maquetas/*.html` y `docs/notas-tecnicas.md`. El estado de cada fase y los bugs están en [`QA-INFORME.md`](QA-INFORME.md).

**Regla de oro:** los tests usan solo datos inventados en directorios de `os.tmpdir()`. Nunca se lee ni se escribe la carpeta real del usuario. Ningún test llama a un modelo.

---

## 1. Mapa de funcionalidades

### 1.1 Comandos del plugin (`commands/*.md`) → subcomandos de `bin/gymhub.mjs`

Todos los comandos llevan el prefijo `/gymhub:` y llaman a `node "${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs" <subcomando>` (`allowed-tools` limitado a ese script).

| Comando | Subcomandos | Código | Qué dice el plan |
|---|---|---|---|
| `configurar` | `estado`, `configurar <ruta>`, `ficha …` | `lib/cli.mjs`, `lib/estructura.mjs`, `lib/ficha.mjs` | PLAN §3: crea la carpeta con plantillas sin sobrescribir, pregunta objetivos y abre la web |
| `carpeta` | `carpeta [ruta]` | `lib/cli.mjs`, `lib/config.mjs` | PLAN §3: muestra o cambia la carpeta; sin estructura, ofrece crearla |
| `refresh` | `refresh preparar · muestra · lote · guardar · cerrar · estado`, `formato`, `guia`, `contexto`, `escribir` | `lib/refresh.mjs`, `lib/separar.mjs`, `lib/canonico.mjs` | PLAN §1, FORMATO §3, §6 y §7 |
| `web` | `web [vista]` | `lib/cli.mjs`, `lib/publicar.mjs`, `lib/abrir.mjs` | PLAN §2.6 |
| `panel` · `progreso` · `analisis` · `diario` | `web <vista> [filtro] [--modo] --si-hace-falta` | `lib/cli.mjs` | PLAN §3: abren la web en esa pestaña |
| `ejercicio` | `ejercicio <nombre>` | `lib/seguimiento.mjs` | PLAN §3 y §2.4b |
| `semana` | `semana [AAAA-Www]`, `semana guardar` | `lib/seguimiento.mjs`, `lib/semanas.mjs` | Encargo de la pestaña Semana |
| `revision` | `revision [marcar n]`, `corregir`, `leer` | `lib/seguimiento.mjs` | PLAN §3, FORMATO §6 |
| `discos` | `discos <kg>` | `lib/seguimiento.mjs`, `lib/discos.mjs` | PLAN §2.2 y §3 |
| `entreno` · `serie` · `fin` | `entreno`, `serie`, `fin` | `lib/vivo.mjs` | PLAN §3, §3.1 y §3.2 (opcionales) |

- **Skill** `skills/gymhub/SKILL.md` (+ `guardar.md`): principios, cómo guardar y, por pre-ejecución, `ayuda`, `formato` (imprime `docs/FORMATO.md`) y `guia guardar`.
- **Hooks:** el plugin **no tiene hooks**. Las pruebas de hooks de G4 no aplican; se comprueba que no haya ninguno declarado.
- **Cambio de ruta:** la carpeta activa es, por orden: `--carpeta`, `GYMHUB_CARPETA`, el directorio de la sesión si tiene estructura y, si no, la de la config (`lib/config.mjs › carpetaActiva`).

### 1.2 Ficheros del formato

| Fichero | Lector / escritor | Referencia |
|---|---|---|
| `sesiones/AAAA/AAAA-MM-DD[-n].md` | `canonico.leerSesion` / `escribirSesion`, `sesiones.cargarSesiones` (caché por mtime) | FORMATO §2 |
| `FICHA.md` | `ficha.leerFicha`, `ponerClave`, `ponerSeccion`, `records.actualizarEstadoFicha` | PLAN §1 |
| `convenciones.md` | `convenciones.leerEquivalencias`, `leerOrdenFechas`, `convencionesVacias` (el resto lo interpreta Claude) | FORMATO §4 |
| `ejercicios.md` | `catalogo.leerCatalogo`, `anadirFilas`, `anadirAlias` | FORMATO §5 |
| `eventos.md` | `eventos.leerEventos`, `diasDePausa` | FORMATO §3.8 |
| `records.md` | `records.escribirRecordsMd` (conserva «Marcas declaradas») | FORMATO §1 |
| `revision.md` | `refresh.guardar`, `seguimiento.dudasPendientes` | FORMATO §6 |
| `plantillas/*.md` | `plantillas.leerPlantilla` | `skills/gymhub/guardar.md` |
| `semanas/AAAA-Www.md` | `semanas.leerRepaso`, `componerRepaso` | Encargo de Semana |
| `.gymhub/procesados.json` · `generadas.json` · `importacion.json` | `refresh.mjs` | FORMATO §6 y §7 |
| `.gymhub/web/datos.js` · `version.js` · `dashboard.html` | `publicar.mjs` | PLAN §2.6 |

### 1.3 Métricas (todas en `lib/`, la web no calcula)

| Métrica | Dónde | Regla |
|---|---|---|
| kg efectivos, lb→kg (×0,4536), PC±n, nivel con equivalencia | `series.kgCarga` | FORMATO §2.1 y §3.4 |
| Tonelaje (`/lado` y `/mano` ×2, sin calentamiento ni aproximación) | `base.derivarEjercicio` | FORMATO §2.1 |
| e1RM Epley 1–10 reps (1 rep = peso) | `series.e1rm` | FORMATO §2.1 |
| Escala de progresión (kg, carga, lastre, nivel, tiempo, reps) y PRs (≥2 sesiones previas) | `base.calcularBase` | PLAN §2.2 |
| Series por grupo (1 principal, 0,5 secundario) | `base.calcularBase` | FORMATO §5 |
| Racha (se rompe con ≥4 días sin entrenar, las pausas no cuentan) | `base.calcularRacha` | PLAN §2.1 |
| Calendario 12 semanas | `vistas.calendario` | PLAN §2.1 |
| Panel: sesiones, volumen y Δ, PRs del mes, progresión, objetivos, grupos con ▲ pasado el miércoles, rutina, semana, sensaciones, descarga, Rex | `panel.mjs` | PLAN §2.1 y §2.5 |
| Progreso: mapa muscular, récords (`NUEVO` ≤7 días), bloque de 6 semanas, discos, historial | `progreso.mjs`, `records.mjs`, `discos.mjs` | PLAN §2.2 |
| Análisis: radar fuerza y volumen, ratios, aguda:crónica, disposición, predicción, estancados, lo que dicen tus datos, adherencia | `analisis.mjs` | PLAN §2.3 |
| Diario: molestias por semana con aviso «se repite», sensaciones, línea de tiempo con hitos | `diario.mjs` | PLAN §2.4 y FORMATO §3.9 |
| Ejercicios: lista (≥3 sesiones), KPIs, puntos y mejor del mes, rangos 6M/1A/Todo, mejor peso por reps, series por mes, últimas, menciones | `ejercicio.mjs` | PLAN §2.4b |
| Semana: KPIs con Δ anterior y Δ media 4, estado, racha de semanas, grupos con aviso <70 %, mes por el jueves, repaso | `semanas.mjs` | Encargo de Semana |

### 1.4 Vistas y elementos (`web/dashboard.html`)

| Vista | Elementos (id del bloque) | Maqueta |
|---|---|---|
| Común | pestañas 1–6 (`#pestanas`), cabecera (`#cabecera`, `#carpeta`), aviso de datos (`#aviso-datos`), banner de proceso (`#banner`), tooltip (`#tt`), latido `version.js` → `datos.js`, recarga sola por versión | todas |
| Panel | `p-k1…p-k4` (racha, sesiones, volumen, PRs), `p-rex`, `p-cal`, `p-prog`, `p-obj`, `p-grp`, `p-rut`, `p-sem` (esta semana, sensaciones, descarga) | `panel.html` |
| Progreso | `g-mapa`, `g-rec`, `g-blo`, `g-dis` (+ `#g-kg`), `g-his` | `progreso.html` |
| Análisis | `a-radar` (conmutador fuerza/volumen), `a-rat`, `a-carga`, `a-pred`, `a-est`, `a-datos` | `analisis.html` |
| Diario | `d-chips` (filtros), buscador, `d-mol`, `d-sens`, `d-linea` (despliegue de sesión) | `diario.html` |
| Ejercicios | `e-q` (buscador), `e-lista`, `e-cab`, `e-kpis`, `e-graf` (6M/1A/Todo), `e-tabla`, `e-mes`, `e-ult`, `e-notas` | `ejercicios.html` |
| Semana | `s-cab` (← → y «volver a esta semana»), `s-kpis`, `s-rev`, `s-grp`, `s-cump` (tira de 26 semanas), `s-qa`, `s-mes` | `semana.html` |

---

## 2. Matriz funcionalidad × tipo de prueba

U = unitaria con valores a mano · P = propiedades con PRNG con semilla · I = integración (CLI y carpeta temporal) · E = e2e en Chromium (`file://`) · V = visual (capturas de referencia) · M = manual o fuera de la automatización

| Funcionalidad | U | P | I | E | V | M |
|---|---|---|---|---|---|---|
| Parser y serializador de sesiones (ida y vuelta, entradas hostiles) | ✔ | ✔ (≥500 sesiones) | | | | |
| Validador (errores con número de línea) | ✔ | | ✔ | | | |
| Catálogo (alias, tildes, ambigüedad, fusión) | ✔ | | | | | |
| `convenciones.md` (equivalencias, orden de fechas, choques) | ✔ | | ✔ | | | |
| Métricas de las 6 vistas | ✔ | ✔ | | ✔ | | |
| Semanas ISO, W53, cambio de año, mes por el jueves | ✔ | ✔ | | ✔ | | |
| Zona horaria (UTC, Madrid, Los Ángeles) | ✔ (suite entera ×3) | | | | | |
| `/refresh`: contrato de `guardar` con salidas buenas, malas y truncadas | ✔ | | ✔ | | | |
| Idempotencia, ediciones a mano, conflicto | | | ✔ | | | |
| `datos.js` (atómico, JS válido, versión estable) | ✔ | | ✔ | ✔ | | |
| Robustez (permisos, binarios, enormes, proceso matado ×100) | | | ✔ | ✔ | | |
| Plugin: manifiesto, frontmatter, `allowed-tools`, instalación | ✔ | | ✔ | | | ✔ (instalar desde GitHub) |
| Rutas con espacios, tildes, `/mnt/d`, relativas, inexistentes | | | ✔ | | | |
| Abrir la web en WSL (`wslview`, `explorer.exe`, fallo) | ✔ (con `PATH` falso) | | | | | ✔ (navegador real) |
| Recarga en vivo, estado vacío, datos rotos, 30 min abierta | | | | ✔ | | |
| XSS en todas las vistas | | | | ✔ | | |
| Diseño adaptable 1024–1920 px, zoom 80–200 %, claro y oscuro | | | | ✔ (sin cortes ni solapes) | ✔ | ✔ (comparación con maqueta) |
| Teclado y accesibilidad básica | | | | ✔ | | |
| Rendimiento (5 años, ~1.000 sesiones, ~20.000 series) | | | ✔ | ✔ | | |
| Normalización real con Claude (personas) | | | | | | ✔ (`scripts/e2e-persona.mjs`, usa un modelo) |
| Validación de datos reales (`pnpm qa:validar`) | | | ✔ (con datos sintéticos) | | | ✔ (solo con permiso) |

---

## 3. Riesgos, de más a menos grave

1. **Publicación sin `docs/FORMATO.md`.** El subcomando `formato` imprime `docs/FORMATO.md`, que no está versionado. En un clon de GitHub (`main` ya está publicado) `/gymhub:refresh` y la skill reciben «AVISO: falta docs/FORMATO.md». Claude normaliza solo con `guardar.md`, que no trae las reglas de §3. *Decisión del autor* (§5 del informe).
2. **XSS en la web.** El tooltip común hace `innerHTML = getAttribute("data-tt")`: lo escapado una vez se desescapa al leer el atributo. Afecta a nombres de ejercicio, motivos de descarga, errores de formato, etc.
3. **Pérdida silenciosa al normalizar.** `refresh guardar` pasa la sesión de Claude por `leerSesion → escribirSesion`. Lo que no sobrevive a la ida y vuelta (notas de ejercicio, `|` dentro de una celda, columnas o líneas no reconocidas) desaparece de la sesión canónica, aunque el original se conserve.
4. **Números incorrectos con datos raros:** `0 kg` o asistidas con más ayuda que el peso corporal (escala kg sin e1RM), equivalencias de `nivel` escritas como en el ejemplo de FORMATO §4 (sin la palabra «equivalencia») que el script ignora, nombres ambiguos del catálogo que se resuelven al primero.
5. **Estado interno corrupto** (`procesados.json`, `generadas.json`): `leerJSON` devuelve el valor por defecto sin avisar, lo que provocaría reimportaciones y duplicados `-2`.
6. **CONTEXTO hostil:** un fichero sin permisos o un enlace roto tumban `refresh preparar` entero.
7. **Web sin aviso** si `datos.js` no carga o está roto (PLAN §2.6 pide un aviso discreto), y «Cargando datos…» indefinido si no existe.
8. **Zona horaria y cambios de hora** en semanas, rachas y meses.
9. **Fechas en el futuro** (un año mal escrito): dejan la racha «viva» y descuadran la última sesión.
10. **Rendimiento** con historiales de años, y una pestaña abierta mucho tiempo.

---

## 4. Qué se automatiza y qué no

**Se automatiza** (en `pnpm test:todo`):
- `pnpm test`: unitarias, propiedades e integración con `node --test` (sin dependencias). Ida y vuelta con ≥500 sesiones aleatorias de semilla fija (se imprime si falla).
- La suite unitaria se ejecuta con `TZ=UTC`, `TZ=Europe/Madrid` y `TZ=America/Los_Angeles`, y los resultados de cálculo se comparan entre zonas.
- `pnpm test:e2e`: Playwright (`@playwright/test`) en Chromium con `file://`, con datos generados por cada test.
- `pnpm test:visual`: capturas de referencia por vista en `test/visual/`, en claro y oscuro.
- `pnpm test:web`: la prueba existente en Chromium y Firefox (sin cambios).

**No se automatiza** (y por qué):
- La normalización con Claude de verdad: usa un modelo. Se prueba el contrato (validador, idempotencia, protección), las instrucciones (que la skill y el comando describen el formato) y, a mano, `scripts/e2e-persona.mjs`.
- Abrir el navegador de Windows desde WSL: se prueba la elección del programa con un `PATH` falso; abrirlo de verdad es manual.
- La instalación desde GitHub: hace falta el repo publicado con lo que haya en `main`.
- La comparación fina con las maquetas: se automatizan las capturas y la ausencia de cortes y solapes, y las diferencias se apuntan a mano en el informe.
- Edge y Chrome de Windows: `pnpm test:web --edge` existe, pero no entra en `test:todo` porque depende del equipo.
- `pnpm qa:validar` sobre la carpeta real: solo con permiso explícito.

---

## 5. Cobertura de partida (antes de G1)

`node --test --experimental-test-coverage --test-coverage-include='lib/**'` con los 91 tests de entonces (todos en verde):

| | líneas | ramas | funciones |
|---|---|---|---|
| Todo `lib/` | 93,29 % | 81,30 % | 91,87 % |
| Cálculo y parser (`canonico`, `series`, `base`, `records`, `panel`, `progreso`, `analisis`, `diario`, `ejercicio`, `semanas`, `catalogo`, `convenciones`, `eventos`, `ficha`, `vistas`, `util`) | ≥ 93,75 % en cada uno (casi todos 100 %) | 67–92 % | |
| Resto (`refresh` 74,9 %, `cli` 70,7 %, `vivo` 77,1 %, `cerrojo` 75 %, `abrir` 36,7 %, `separar` 92,4 %) | | | |

La cobertura de los subcomandos que se lanzan como proceso aparte no cuenta en esa cifra.

---

## 6. Revisión estática: sospechosos

| Id | Dónde | Sospecha | Tipo |
|---|---|---|---|
| S01 | `web/dashboard.html:177` | `tt.innerHTML = getAttribute("data-tt")`: lo escapado una vez se ejecuta | innerHTML sin escapar |
| S02 | `web/dashboard.html` (bloques) | Repasar que todo texto del usuario pase por `esc()` en cada vista | innerHTML |
| S03 | `lib/canonico.mjs › escribirSesion` | No escribe `ej.nota` ni las líneas sueltas; no escapa `|` en las celdas; `yamlValor` usa `JSON.stringify`, pero `escalar` solo deshace `\"` (barras invertidas y saltos de línea cambian) | Ida y vuelta |
| S04 | `lib/canonico.mjs` | Los errores no llevan número de línea | Claridad |
| S05 | `lib/series.mjs › escalaSerie` | `kg ≤ 0` cuenta como escala «kg» sin e1RM → `estancados` llama a `diasEntre(null, …)` y la vista Análisis entera da error | División / null |
| S06 | `lib/convenciones.mjs` | Solo entiende `- equivalencia X: …`; el ejemplo de FORMATO §4 (`- jalón: nivel 1 = 5 kg, +5 kg por nivel`) se ignora sin avisar. Tampoco avisa de convenciones que chocan | Convenciones |
| S07 | `lib/catalogo.mjs › buscar` | El segundo intento devuelve el primer id de una clave ambigua | Determinismo |
| S08 | `lib/panel.mjs › horasMinutos` | Puede dar «7h 60m» al redondear | Formato |
| S09 | `lib/panel.mjs › objetivos` | Objetivo 0 → división por cero (sale 100 %) | División por cero |
| S10 | `lib/util.mjs › leerJSON` | Un JSON de estado corrupto se trata como vacío sin avisar | catch silencioso |
| S11 | `lib/separar.mjs › ficherosContexto` | `statSync`/`readFileSync` sin `try`: un fichero sin permisos o un enlace roto tumban `preparar` | Robustez |
| S12 | `lib/refresh.mjs › moverProcesados` | Adjuntos: `dirname(f).startsWith(dirname(c))` sin separador; con un chat en la raíz de CONTEXTO arrastra adjuntos de otros chats | Lógica |
| S13 | `lib/registro.mjs › rutaSegura` | Una ruta absoluta con `..` no se normaliza antes de comprobar que está dentro | Rutas |
| S14 | `web/dashboard.html › latido` | Un `datos.js` roto (error de sintaxis) no avisa; sin `datos.js`, «Cargando datos…» para siempre | Web en vivo |
| S15 | `lib/canonico.mjs › validarBasico` | Fechas en el futuro se aceptan sin aviso | Fechas |
| S16 | `lib/eventos.mjs` | Una pausa con `hasta` anterior a `desde` se ignora sin error | Validación |
| S17 | `lib/sesiones.mjs` | La caché de sesiones guarda el resultado del parser: hay que subir `VERSION_CACHE` cada vez que cambie el parser | Caché |
| S18 | Fechas | `hoyISO`, `fechaISO(mtime)` y `generado` usan la hora local (es lo correcto); el resto de fechas se construye a mediodía local para evitar los cambios de hora. Se verifica con la suite en 3 zonas | Zona horaria |
| S19 | `datos.js` | Se escribe con `escribirAtomico` (tmp + rename) y `version.js` después: correcto. Se comprueba que `</script>`, comillas, emojis y U+2028 no lo rompen | Atómico |
| — | Rutas fijas | Solo valores por defecto documentados (`/mnt/d/GIMNASIO` en WSL, `cwd: /mnt/c` para `explorer.exe`/`powershell.exe`) y rutas de navegadores en scripts de medición. Ninguna carpeta de usuario fija | Rutas fijas |

## 7. Privacidad del repo

- **Historial:** 137 ficheros en todo `git log --all`. Todos son código, documentación o fixtures sintéticos.
- **Patrones buscados** en `git log --all -p`: correos, teléfonos, `from_id`, rutas de la carpeta real y nombres. Resultado:
  - el autor de los commits y el usuario de GitHub en las instrucciones de instalación: es intencionado y público;
  - «Lucía», remitente inventado del export de Telegram de la persona 1.
- **Sin datos reales de entrenamiento.** No ha hecho falta tocar nada.
- **`.gitignore`:** ignora `node_modules/`, `*.log`, `.DS_Store` y `tests/.tmp/`. Se añaden los resultados de Playwright (`test-results/`, `playwright-report/`) al configurarlo.
