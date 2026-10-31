# gymhub: notas técnicas

> Hallazgos de la Fase 0 y decisiones que se apartan del plan (`docs/PLAN.md`).
> Versión verificada: **Claude Code 2.1.316**, WSL2 con Ubuntu 22.04 (red en modo NAT), Node 24.21 y pnpm 12.6.
> Navegadores: Edge 156, Chrome 156, Brave 1.98 (Chromium 156, el predeterminado de esta máquina) y Firefox 157 (la versión de Linux que trae Playwright: no hay Firefox de Windows instalado).
> Fecha: 2026-10-31.

## 0. Cómo se ha verificado

1. Lectura de `huddle/docs/notas-tecnicas.md` (empaquetado e instalación) y de la referencia de plugins de esta versión: la skill `plugin-authoring` y su declaración de tipos (`claude-code.d.ts`).
2. Un plugin de prueba, la **sonda** (`tests/sonda/plugin/`), cargado con `--plugin-dir`:
   - en sesiones `claude -p` con `--output-format stream-json`, leyendo además el transcript para ver la expansión exacta de cada comando;
   - en una sesión **interactiva** real, en tmux, para ver el autocompletado, el prefijo y los permisos en modo `auto`.
3. Una instalación con alcance de proyecto en una carpeta temporal, con un `CLAUDE_CONFIG_DIR` aislado. Tu configuración de Claude Code no ha cambiado: lo comprobé con `sha1sum` antes y después.
4. La web: una página de prueba (`tests/sonda/web/`) abierta sin ventana en Edge, Chrome y Firefox, con un perfil temporal propio, leyendo su consola. Después, una apertura real en tu navegador predeterminado (Brave) con el comando de la sonda, y la recarga en vivo comprobada en esa pestaña por el título de la ventana.

Las sesiones de prueba, sus transcripts y las carpetas temporales se han borrado. Queda `%LOCALAPPDATA%\Temp\gymhub-sonda`, que es la página que se abrió en Brave; se puede borrar sin más.

## 1. Las suposiciones del plan

| Suposición | Resultado | Qué cambia |
|---|---|---|
| Un fichero por comando en `commands/` | ✔ Funciona. Esta versión los trata como skills | — |
| Prefijo de los comandos | ✔ **Sí hay prefijo**: `/gymhub:refresh` (§2.3) | Se documenta en el README. Escribir `/refresh` + Enter se autocompleta; con argumentos hace falta el prefijo o Tab |
| Skill con las reglas de `FORMATO.md` | ✔ Se elige sola por su descripción, y la preejecución con `node` inyecta `FORMATO.md` | `FORMATO.md` sigue en `docs/` y lo imprime el script (§2.4) |
| Instalación con alcance de proyecto | ✔ `--scope project` lo activa solo en la carpeta de datos; fuera sale «disabled» | El marketplace sí queda apuntado en la config de usuario (§2.5) |
| Scripts que calculan, sin dependencias | ✔ Node sin paquetes, llamado desde los comandos con permiso acotado al script | **Requisito nuevo para el usuario: Node.js 20 o superior** (§2.6) |
| Abrir la web en Windows desde WSL | ✔ `explorer.exe` + `wslpath -w` (no hay `wslview`) | La pestaña pedida no puede viajar en el ancla `#…` (§2.7) |
| Recargar `datos.js` con `file://` | ✔ En Edge, Chrome, Brave y Firefox | Con el diseño del plan (releer `datos.js` cada 2 s) **una medida llegó a 2,48 s**. Cambia a un latido (§2.8) |
| Plan B: servidor estático | No hace falta | Queda solo documentado |

## 2. Detalle

### 2.1 Formato del plugin

```
.claude-plugin/plugin.json        { name, version, description, author, license }
.claude-plugin/marketplace.json   { name, owner, plugins: [{ name: "gymhub", source: "./" }] }
commands/<nombre>.md              un comando por fichero: frontmatter + instrucciones para Claude
skills/gymhub/SKILL.md            la skill de normalización
bin/, lib/                        los scripts (Node), que el plugin lleva consigo
```

- **Sin módulo de hooks.** gymhub no dibuja nada en Claude Code ni necesita eventos, así que no usa el sistema de mods de Huddle (`hooks/hooks.json` + `register.tsx`).
- `claude plugin details` lista los comandos como skills: en esta versión, comandos y skills son lo mismo. El coste fijo por sesión es solo la descripción de cada uno (menos de 20 tokens por comando). El cuerpo se paga al invocarlo.
- `claude plugin validate .` pasa. Con `--profile directory` (el catálogo público de plugins) exige además un README y un LICENSE (o `license` en `plugin.json`), y recomienda un icono cuadrado (`.claude-plugin/icon.png`, de 512 a 2048 px).

### 2.2 Qué se expande en un comando

Comprobado en el transcript, invocando `/gymhub:<cmd> alfa beta`:

| Escrito en el `.md` | Resultado |
|---|---|
| `$ARGUMENTS` | `alfa beta` |
| `$0`, `$1`, `$ARGUMENTS[0]` | Posicionales **contando desde 0**: `$0` = `alfa` y **`$1` = `beta`** (el segundo) |
| Sin `$ARGUMENTS` en el cuerpo | Los argumentos se añaden al final como `ARGUMENTS: alfa beta` |
| `${CLAUDE_PLUGIN_ROOT}` | ✔ La carpeta del plugin. También vale dentro de `allowed-tools` y de `` !`…` `` |
| `${CLAUDE_PLUGIN_DATA}` | ✔ `~/.claude/plugins/data/<plugin>-<marketplace>/` (con `--plugin-dir`, `…-inline`). La carpeta se crea al expandirla |
| `${CLAUDE_SESSION_ID}` | ✔ |
| `${CLAUDE_SKILL_DIR}` | Solo en las skills |
| `` !`orden` `` | ✔ Se ejecuta antes de enviar el mensaje y su salida ocupa su lugar. **Tiene que ir detrás de un espacio o al principio de línea**: en `X=!`…`` se queda tal cual. Necesita la orden en `allowed-tools`. Si falla, el comando no llega a ejecutarse y el error se le muestra al usuario |
| `` !`cat "${CLAUDE_PLUGIN_ROOT}/docs/FORMATO.md"` `` | ✘ **Bloqueado** aunque `cat` esté permitido: «Claude Code may only concatenate files from the allowed working directories» |
| `` !`node "${CLAUDE_PLUGIN_ROOT}/bin/x.mjs" …` `` | ✔ Funciona |
| `@${CLAUDE_PLUGIN_ROOT}/docs/FORMATO.md` | ✘ No se expande en los comandos |
| `allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs":*)` | ✔ Ese script se ejecuta sin preguntar, tanto en la preejecución como en las llamadas `Bash` que hace Claude durante el turno. Cualquier otro `node` (por ejemplo `node -e …`) sigue pidiendo aprobación |
| `model: haiku` | ✔ Se aplica solo a ese comando: tu modelo por defecto es opus y respondió Haiku |
| Heredoc al script | ✔ `node "…/gymhub.mjs" guardar <<'FIN' … FIN` llega intacto (tablas, comillas invertidas, `$HOME`, `; && \|`) y sin pedir permiso extra |

### 2.3 El prefijo

- Los comandos se registran como **`gymhub:<nombre>`**. Ninguno choca con los 73 integrados (con el prefijo no podrían chocar).
- **En `-p`**, `/refresh` no existe («isn't a command in this session»); Claude lo rescata llamando a la skill `gymhub:refresh`.
- **En interactivo:**
  - Al escribir `/refresh` el menú propone `/gymhub:refresh`, y Enter lo ejecuta.
  - `/refresh uno dos` da «Unknown command: /refresh»: con argumentos no hay rescate.
  - Tab completa: `/refre` + Tab → `/gymhub:refresh `, y después se escriben los argumentos.
- **Alternativas sin prefijo, descartadas:**
  1. Comandos registrados en código, como en Huddle (`$.command.register`), que van sin prefijo. Un hook `command.run` no puede cambiar el nombre del comando, y `$.command.run` se rechaza dentro de un hook que retiene el turno: haría falta un temporizador (como `encolarPrompt` en Huddle) y depender de la API de mods, que esta versión declara en acceso anticipado y cambia entre versiones.
  2. Comandos «envoltorio» en `.claude/commands/` de la carpeta de datos: salen duplicados en el menú y se quedan viejos al actualizar el plugin.
- **Decisión:** prefijo, documentado en el README con el truco de Tab.
- **`/gym` → `/gymhub:web` (propuesta).** `/gymhub:gym` es redundante, y al escribir `/gym` el menú muestra *todos* los comandos (todos empiezan por `gymhub:`). `/web` lleva a `/gymhub:web` sin ambigüedad.

### 2.4 La skill

- `skills/gymhub/SKILL.md`: Claude la carga sola cuando el tema encaja con su descripción (probado con «quiero normalizar este entreno: banca 3x5 80»).
- `${CLAUDE_PLUGIN_ROOT}` y `${CLAUDE_SKILL_DIR}` se expanden, y `` !`node "${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs" formato` `` inyecta `FORMATO.md` entero, de forma determinista. Como `cat` y `@` no sirven con ficheros del plugin (§2.2), **`/refresh` y la skill cargan `FORMATO.md` (y el `convenciones.md` del usuario) a través del script.** Así `FORMATO.md` sigue siendo uno solo, en `docs/`.
- **Permiso:** cuando es Claude quien carga una skill con `allowed-tools`, la herramienta `Skill` pide permiso («Execute skill: gymhub:gymhub»):
  - en `-p` falla con ese mensaje, sin más explicación;
  - en interactivo con modo `auto`: «Allowed by auto mode · 1 tool allowed»;
  - en modo manual se pregunta una vez.
- Hecho menor: la skill aparece en el menú como `/gymhub:gymhub`. En la Fase 1 se decide si se oculta del menú.

### 2.5 Instalación

- Línea única, la que documenta el sistema (y la que acabó usando Huddle):
  - en el prompt: `/plugin install gymhub --marketplace <usuario>/gymhub`, eligiendo el alcance de proyecto;
  - desde la shell, en la carpeta de datos: `claude plugin install gymhub --marketplace <usuario>/gymhub --scope project`.
- Con `--scope project` se escribe `<carpeta>/.claude/settings.json` → `{"enabledPlugins": {"gymhub@gymhub": true}}`. **El marketplace se apunta en la config de usuario** (`extraKnownMarketplaces`), e `installed_plugins.json` guarda la ruta del proyecto.
- Desde otra carpeta, `claude plugin list` muestra `Scope: project · ✘ disabled`: el resto de sesiones quedan limpias, como pide el plan.
- Un marketplace de carpeta se lee de la propia carpeta («Read from»). Uno de GitHub se copia a `~/.claude/plugins/cache/…` y se actualiza con `claude plugin update`.
- La instalación real desde GitHub queda para la Fase 8.

### 2.6 Los scripts: Node sin dependencias

- **Por qué Node:** es lo que apunta el plan (scripts, `package.json` con pnpm), los comandos lo invocan sin fricción (§2.2) y se prueba con `node --test`. No se usa ningún paquete en tiempo de ejecución, solo `node:fs`, `node:path`, `node:crypto`… **Para el usuario es un requisito nuevo: Node.js 20 o superior.** `/configurar` lo comprobará y explicará cómo instalarlo. Aquí se prueba con Node 24 (no hay un Node 20 instalado para comprobar el mínimo).
- **Alternativa sin Node:** un mod de esta versión puede ofrecer herramientas propias que Claude llama (`$.tool.register` → `mcp__gymhub__<nombre>`), con el código ejecutándose dentro de Claude Code. Se descarta por ahora:
  - la API está en acceso anticipado y cambia entre versiones;
  - `$.process` solo existe en la CLI (no en la app de escritorio);
  - `$.fs` no tiene `rename` ni `delete`, y no lee ficheros de más de 4 MiB;
  - los tests solo corren con `claude plugin test`;
  - casi todos los comandos de gymhub son turnos de Claude, que es justo lo que hacen bien los comandos en Markdown.
- **Toda la lectura y escritura de la carpeta de datos pasa por `bin/gymhub.mjs`.** Claude Code limita `Read`, `ls` o `cat` a los directorios de trabajo de la sesión (en las pruebas se bloqueó `ls ~/.claude/skills`). Si el script entrega el texto de `CONTEXTO/` por su salida y recibe las sesiones normalizadas por heredoc:
  - gymhub funciona desde cualquier carpeta, incluso instalado a nivel de usuario;
  - el propio script valida cada sesión y aplica las protecciones (nunca sobrescribe lo editado a mano, nunca pierde el original).

### 2.7 Abrir la web

- En esta máquina no hay `wslview`: se usa `explorer.exe` con la ruta de `wslpath -w`, lanzado sin esperar y con `cwd` en `/mnt/c`. Abrió la página en el navegador predeterminado (Brave). `explorer.exe` devuelve 1 aunque abra bien, así que no se mira su código de salida. En Linux, `xdg-open`; en macOS, `open`.
- `explorer.exe` recibe una ruta de fichero, no una URL, así que **el ancla `#progreso` no se puede pasar de forma fiable**. Propuesta: la pestaña pedida viaja en los datos (`navegar: {id, vista, filtro}`). La página la aplica al abrirse y, si ya estaba abierta, en el siguiente latido. El ancla sigue valiendo dentro de la página (favoritos, recargar, teclas `1`–`5`).
- Una página `file://` no puede escribir ficheros, así que **el script no puede saber si la web ya está abierta**. Qué hace cada comando de vista (cambiar la pestaña abierta, abrir otra o las dos cosas) se decide en la Fase 4.
- **Carpeta dentro de WSL** (`~/…`): Edge la abre por `\\wsl.localhost\<distro>\…` y la recarga va igual de rápida (máximo 1,09 s). Se mantiene el aviso del plan, pero como recomendación, no como error.

### 2.8 Recarga en vivo con `file://`

Medido con `tests/sonda/web/medir.mjs`, desde que el script publica hasta que la página lo ve. Las horas son del reloj de WSL (§2.9).

| Navegador | Diseño del plan: `datos.js` cada 2 s | Latido de 1 s | Latido de 0,5 s (proceso activo) | Fichero a medias o ausente |
|---|---|---|---|---|
| Edge 156 | máx. **2,48 s** (5 medidas) | máx. 0,95 s | máx. 0,68 s | se ignora, conserva lo último; vuelve en ≤ 0,7 s |
| Chrome 156 | — | máx. 1,07 s | máx. 0,57 s | ídem |
| Firefox 157 (Linux) | — | máx. 1,04 s | máx. 0,47 s | ídem |
| Edge, carpeta dentro de WSL | — | máx. 1,09 s | máx. 0,83 s | ídem |
| Brave 1.98, la pestaña real, con ventana | — | ≤ 1,2 s (incluye ~0,4 s de PowerShell para leer el título) | — | — |

**Mecanismo adoptado:**

1. **Latido:** la página inserta `<script src="version.js?t=…">` cada 1 s, o cada 0,5 s si `proceso.activo`. `version.js` es una línea, `window.GYMHUB_VERSION = "…"`. Solo si la versión cambia, carga `datos.js?t=…`. Así se cumple el ≤ 2 s con margen, y no se vuelve a interpretar un `datos.js` de varios MB cada pocos segundos.
2. **Publicar:** primero `datos.js` y después `version.js`, cada uno con un temporal en la misma carpeta + `rename` (atómico). Cuando la página ve una versión nueva, `datos.js` ya está completo.
3. **La página guarda su propia copia.** Antes de cargar pone `window.GYMHUB = null`. Si al terminar sigue a `null`, o trae otra versión, el fichero estaba a medias: se ignora y se reintenta en el siguiente latido.
   - Ojo: un error dentro de un script `file://` llega como «Script error.», sin nombre de fichero, así que no sirve `window.onerror`.
4. **Pestaña en segundo plano:** los navegadores frenan los temporizadores en las pestañas ocultas. Con `visibilitychange` se lee en cuanto vuelves a la pestaña.
5. `datos.js` mantiene la forma del plan: `window.GYMHUB = {version, generado, …datos.json, proceso, vivo}`.

### 2.9 Los relojes de WSL y de Windows

- **El reloj de Windows va unos 6,5 s por delante del de WSL** (Huddle midió 7 s). Las mediciones de arriba usan solo el reloj de WSL.
- Consecuencia: la página no puede comparar su `Date.now()` con una hora escrita por el script. Afecta a la cuenta atrás del descanso (§3.2 del plan, Fase 7). Dos opciones:
  - que el script mida el desfase una vez (`powershell.exe … UtcNow`, ~0,4 s) y publique el inicio del descanso en hora de Windows;
  - que la página cuente desde que recibió la versión, con un error igual al retraso del latido (≤ 1 s).
- Las cifras con fecha (rachas, «PR en las últimas 24 h», «hace 3 h») las calcula el script en su reloj, así que no les afecta.

### 2.10 Para las fases de web

- `tests/sonda/web/medir.mjs` sirve para comprobar el ≤ 2 s de la regla 12 con la web de verdad.
- Capturas para comparar con las maquetas: Edge o Chrome sin ventana con `--screenshot`.
- Para clics y teclas: WSL está en modo NAT, así que el puerto de depuración de un navegador de Windows no se alcanza desde WSL. Se usará Playwright como dependencia de desarrollo (pnpm) con los Chromium y Firefox que ya hay en `~/.cache/ms-playwright`.

## 3. Cambios al plan (propuesta)

| # | Plan | Propuesta |
|---|---|---|
| 1 | Comandos `/refresh`, `/gym`… | **`/gymhub:refresh`**, `/gymhub:serie`… (prefijo obligatorio, documentado en el README; Tab lo completa) |
| 2 | `/gym` abre la web | **`/gymhub:web`** |
| 3 | Scripts sin especificar | **Node ≥ 20 sin dependencias**, con un único punto de entrada `bin/gymhub.mjs <subcomando>` y permiso acotado a ese script en cada comando |
| 4 | `/refresh` y la skill cargan `FORMATO.md` | Lo cargan con `` !`node … formato` ``. `FORMATO.md` sigue en `docs/` |
| 5 | Claude escribe en la carpeta de datos | Todo pasa por el script (texto por su salida, sesiones por heredoc): funciona desde cualquier carpeta y el script aplica las protecciones |
| 6 | Releer `datos.js` cada 2 s (1 s en proceso) | **Latido con `version.js` cada 1 s (0,5 s en proceso)** y `datos.js` solo cuando cambia; `visibilitychange` |
| 7 | Comandos que abren `dashboard.html#analisis?modo=volumen` | La vista viaja en los datos (`navegar`); el ancla solo funciona dentro de la página |
| 8 | Cuenta atrás desde `descanso_inicio` | Corregida por el desfase de relojes de WSL (§2.9) |
| 9 | README: `/plugin marketplace add` + `/plugin install gymhub@gymhub` | `/plugin install gymhub --marketplace <usuario>/gymhub` con alcance de proyecto; requisito Node ≥ 20 |
| 10 | Tests sin especificar | `node --test` mediante `pnpm test`; `pnpm lint` = `claude plugin validate .` + una comprobación de que `dashboard.html` no hace peticiones de red |

Estructura del repo adaptada:

```
gymhub/
├─ .claude-plugin/     plugin.json, marketplace.json (icon.png opcional)
├─ commands/           un .md por comando → /gymhub:<nombre>
├─ skills/gymhub/      SKILL.md (carga FORMATO.md y convenciones.md con el script)
├─ bin/gymhub.mjs      punto de entrada de los scripts: gymhub.mjs <subcomando> …
├─ lib/                config, separar, canonico, derivar, analisis, diario, ejercicio, catalogo,
│                      publicar, discos, calentamiento, notificar (ESM, .mjs)
├─ web/dashboard.html  plantilla única
├─ templates/GIMNASIO/
├─ tests/              *.test.mjs, fixtures/personas/, sonda/
├─ docs/               PLAN.md, FORMATO.md, notas-tecnicas.md, maquetas/
└─ package.json        packageManager pnpm · test: node --test · lint
```

## 4. Pendiente o no verificable aquí

- **Firefox de Windows:** no está instalado. Se probó el motor de Firefox con la versión de Linux de Playwright, sobre la misma carpeta de Windows (`/mnt/c/…`).
- **Node 20:** no hay uno instalado para comprobar el mínimo. Se escribe solo con API estables y se prueba con Node 24.
- **Si la web ya está abierta:** se decide en la Fase 4 (§2.7).
- **Permiso de la skill** y si se oculta del menú: en la Fase 1 (§2.4).
- **Instalación real desde GitHub:** en la Fase 8, con permiso.
- **Subagentes en paralelo para importaciones grandes:** existe la herramienta `Agent`; cómo heredan el permiso acotado del script se probará en la Fase 3.

## 5. Decisiones de la Fase 1

- **Un solo script, `bin/gymhub.mjs <subcomando>`.** Comprueba Node ≥ 20 antes de cargar nada. Los subcomandos viven en `lib/` y se registran en `lib/registro.mjs`, con importaciones estáticas: un `import()` dinámico con `await` en un ciclo de módulos se bloquearía.
- **Variables para probar sin tocar nada real:**
  - `GYMHUB_CONFIG`: otra ruta para la config;
  - `GYMHUB_CARPETA`: otra carpeta de datos para una sola orden;
  - `GYMHUB_NO_ABRIR=1`: no abre el navegador;
  - `GYMHUB_HOY=AAAA-MM-DD`: fija «hoy» para los cálculos.

  También se respeta `XDG_CONFIG_HOME`.
- **`configurar <ruta>` exige la ruta.** La elige Claude con la persona (el directorio de la sesión, la configurada o la de por defecto: `/mnt/d/GIMNASIO` en WSL y `~/GIMNASIO` en el resto), así que el script nunca crea una carpeta que nadie ha pedido.
  - Nunca sobrescribe: si la carpeta ya existe, solo añade lo que falte.
  - Rechaza la carpeta del propio plugin.
  - Avisa si, en WSL, la carpeta está fuera de `/mnt/<letra>`.
- **Edición de ficheros de la persona:**
  - `ficha` cambia FICHA.md por secciones (días, objetivos, peso, lesiones) y no toca los ejemplos comentados de la plantilla.
  - `escribir <ruta>` solo acepta FICHA.md, convenciones.md, revision.md, `plantillas/*.md` y `semanas/AAAA-Www.md`, y guarda la versión anterior en `.gymhub/copias/`.
  - Las sesiones solo se escriben con la importación (Fase 3).
  - `leer` no sale de la carpeta de datos.
- **FICHA.md** añade al ejemplo del plan tres secciones: `Datos` (peso corporal, sueño objetivo, umbral de la racha), `Referencias de fuerza` y `Rangos de equilibrio`, con los valores por defecto del plan. Las series objetivo admiten grupos agregados: `espalda`, `pierna`, `brazos` y `core`.
- **Catálogo precargado:** 125 ejercicios con alias en español e inglés, sin alias ambiguos (lo comprueba un test), y un ejercicio principal por patrón del radar. **Fusión:** si un alias coincide con otro id, ese id se une al ejercicio (FORMATO §3.7).
- **Tests:** `node --test` con la lista explícita de ficheros (`scripts/test.mjs`), porque Node 20 no admite globs. `pnpm lint` = `scripts/comprobar-web.mjs` (la web no puede hacer peticiones de red y solo carga `datos.js` y `version.js`) + `claude plugin validate .`.
- **`docs/FORMATO.md` no está versionado** (decisión tuya). En este repo funciona, pero un plugin instalado desde GitHub no lo tendría: `formato` lo avisa y la skill normalizaría solo con su resumen. Hay que versionarlo antes de publicar.
- **Prueba real:** `/gymhub:configurar <tmp>/GIMNASIO` y `/gymhub:carpeta` (mostrar y cambiar), en sesiones `claude -p` con la config aislada. Sin nadie a quien preguntar, se salta los objetivos. Ante una carpeta sin estructura, no la cambia y lo dice.

## 6. Decisiones de la Fase 2

- **Parser propio** (`lib/canonico.mjs`), sin dependencias: un YAML mínimo para el frontmatter (escalares, comentarios `# …`, comillas, `null` y la lista de `molestias`) y tablas Markdown leídas por el nombre de la columna. Nunca lanza: los problemas que impiden calcular van a `errores`, y la sesión se aparta del cálculo y se informa; los demás van a `avisos`. Escribir y volver a leer una sesión da lo mismo (lo comprueba un test).
- **Cifras por serie** (`lib/series.mjs`):
  - **e1RM:** Epley, de 1 a 10 repeticiones, solo en series de trabajo; con 1 repetición es el propio peso.
  - **lb:** se pasa a kg con 0,4536.
  - **`/lado` y `/mano`:** cuentan doble en el volumen. El e1RM es el de la carga escrita (por mano o por lado), para que la progresión sea comparable.
  - **`8/8` (por lado):** el volumen suma los dos lados y el e1RM usa el menor.
  - **`PC±n`:** usa el peso corporal de la sesión, el último anotado o el de FICHA.md. Sin ninguno, no hay kg y el ejercicio progresa en su escala de «lastre».
  - **`nivel n`:** solo tiene kg con una línea de `convenciones.md` como `- equivalencia jalón al pecho: nivel 1 = 5 kg, +5 kg por nivel`.
- **Escala de cada ejercicio:** la más frecuente en sus series de trabajo: kg (con e1RM), lastre, nivel, tiempo o repeticiones. Los récords, los PRs y las gráficas de ese ejercicio usan esa escala.
- **PR:** una sesión supera el mejor valor anterior de su ejercicio y el ejercicio ya tiene al menos dos sesiones previas. Así las primeras sesiones de un ejercicio no se cuentan como PR.
- **Racha:** cuenta los días de entreno seguidos. Se rompe cuando hay `racha_umbral_dias` (4) días o más sin entrenar entre dos sesiones, o desde la última hasta hoy (sin contar hoy). Los días de una pausa declarada no cuentan como días sin entrenar.
- **`eventos.md`**, fichero nuevo en la carpeta de datos, para lo que no es una sesión: pausas, cambios de programa e hitos (FORMATO §3.8). Ejemplo: `- 2024-08-01 → 2024-08-15 · pausa · vacaciones`. Es fuente de verdad, así que no puede vivir en `.gymhub/`.
- **records.md** se rehace entero salvo «Marcas declaradas». **FICHA.md** solo se toca en su sección «Estado actual». Las dos cosas pasan solo al cerrar un `/gymhub:refresh` (o con `derivar --md`), nunca al publicar.
- **Caché:** `.gymhub/cache-sesiones.json` guarda cada sesión ya leída junto con su `mtime` y su tamaño. Así no se vuelven a leer cientos de ficheros en `/mnt/d` cada vez.
