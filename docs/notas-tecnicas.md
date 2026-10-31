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

## 7. Decisiones de la Fase 3 (`/gymhub:refresh`)

- **Separar es determinista** (`lib/separar.mjs`): corta el material en elementos, no lo interpreta.
  - **Texto:** se corta por líneas que empiezan con una fecha (o por cabeceras que la contienen), en cualquier formato: `12/03/23`, `16-03-23`, `2025-09-08`, `3/14`, `Lunes 3 marzo 2025`, `March 14th, 2025`, `Día 12 - marzo`, `29 oct`. Notaciones de series como `5/5/5/3` o `10/8/6` no cuentan como fecha.
    - **Fechas ambiguas** (`03/04`): se resuelven con `convenciones.md`; si no, con las fechas sin ambigüedad del mismo fichero, o con un mes en el nombre del fichero (`april-2025.txt`). Si sigue sin resolverse, se marca AMBIGUA y decide Claude.
    - **Sin año:** el del nombre del fichero, el de las primeras líneas o el de la fecha del fichero.
  - **Telegram:** el export JSON (`result.json`) y el HTML. **WhatsApp:** el `.txt` exportado. Cada mensaje es un elemento, y la multimedia sin texto se ignora sola (y se cuenta). Las fotos de un chat van con su mensaje.
  - **CSV:** las columnas se reconocen por su nombre, en español o en inglés. Cada día es un elemento con un **borrador determinista** en el formato estándar (cargas, repeticiones, RPE y tiempo ya puestos); Claude solo pone los ids, el tipo y lo que falte.
  - **Imágenes:** las lee Claude con Read y quedan como mucho con `confianza: media`. Los demás formatos van como «otro», para que Claude decida.
  - **Identidad:** cada elemento es el hash de su texto normalizado. En los mensajes de chat entran también la fecha y la hora, porque «hoy pierna» se repite.
- **Lotes:** por meses, de 25 elementos como mucho, guardados en `.gymhub/importacion.json`. Se reanudan: un `refresh preparar` con una importación a medias continúa donde se quedó.
- **Pasada de muestreo:** con más de 20 elementos nuevos y `convenciones.md` todavía vacío. `refresh muestra` enseña unos 30 elementos repartidos en el tiempo; Claude escribe `convenciones.md` y pregunta las dudas generales de una vez.
- **`refresh guardar <n>`:** lo que propone Claude se recibe en bloques `@@@` (`skills/gymhub/guardar.md`), por heredoc o, si el heredoc no pasa, con `--fichero`. **Todo o nada:**
  - todos los elementos del lote tienen que quedar en una sesión, un «ignorar» con motivo o un bloque que no es sesión (plantilla, marcas, evento);
  - cada sesión se valida contra FORMATO y contra el catálogo (los ejercicios nuevos van en `@@@ ejercicios` en el mismo envío).

  Si algo falla, no se escribe nada y el script dice qué corregir.
- **Nada se pierde y nada se pisa:**
  - El **original** de cada sesión lo pone el script, exacto, a partir de sus elementos, igual que la **fuente**.
  - Una sesión existente **nunca se sobrescribe**. Si es idéntica, se omite; si es distinta, va a `AAAA-MM-DD-2.md` y se anota la duda en `revision.md`.
  - Solo se reemplaza una sesión generada por gymhub que nadie ha tocado (su hash en `.gymhub/generadas.json`) y que sale de los mismos elementos, es decir, una reimportación. Lo editado a mano, nunca.
  - Al **cerrar**, cada fichero de `CONTEXTO/` con todos sus elementos procesados se mueve, intacto, a `CONTEXTO/procesado/AAAA-MM-DD/`, y las subcarpetas que se quedan vacías se quitan.
- **Web viva:** el banner de proceso se actualiza al empezar cada lote (`refresh lote`) y al guardarlo (que además recalcula `datos.json` y publica `datos.js`). Al cerrar: «Listo · N sesiones nuevas · N PRs · N dudas», con los PRs nuevos de esta importación.
- **Cerrojo:** `.gymhub/cerrojo` (con `mkdir`, que es atómico) para que dos órdenes no escriban a la vez, por ejemplo dos subagentes con lotes distintos.
- **Subagentes:** el comando permite repartir los lotes entre subagentes cuando hay más de 6, para no llenar el contexto. No se ha probado todavía con una importación grande (eso queda para la importación real de la Fase 8).
- **Personas sintéticas** (`tests/fixtures/personas/`): las 5 de PLAN §4, cada una con su `CONTEXTO/`, sus sesiones esperadas (`esperado.mjs`) y su `convenciones.md`. El test separa, guarda lo esperado lote a lote, cierra y comprueba que no queda nada en `CONTEXTO/`, que cada sesión guarda su original y que repetir `/refresh` no duplica nada.
- **Con Claude de verdad** (`scripts/e2e-persona.mjs <persona>`): importa la persona con `claude -p` y `/gymhub:refresh` en una carpeta temporal, y compara ejercicio a ejercicio con lo esperado. Resultados en el §7.1.

### 7.1 Importación real con Claude (2026-10-31)

Con `scripts/e2e-persona.mjs` y el modelo por defecto (Opus), en carpetas temporales y sin nadie que conteste preguntas (`claude -p`):

| Persona | Tiempo | Coste | Sesiones | Ejercicios idénticos a lo esperado | Notas |
|---|---|---|---|---|---|
| 1 · telegráfica (es, máquinas, lb, `12'5`, Telegram) | 65–140 s | 0,49–0,82 USD | 7/7 | 21/21 y 20/21 en dos ejecuciones | En la segunda, «laterales 5 lb» quedó sin `/mano`: es interpretable. Las dudas de verdad (¿el remo es por mano?, ¿el 8/10 es antes o después?) fueron a `revision.md` |
| 2 · inglés (lb, RPE, mes/día, superseries) | 54 s | 0,43 USD | 4/4 | 14/14 | «4/4 skipped, sick» quedó como pausa |
| 3 · CSV de una app | 31 s | 0,36 USD | 3/3 | 9/9 | Añadió los nombres de la app como alias |
| 4 · plantillas (prescrito/hecho, RIR, 1-5) | 71 s | 0,51 USD | 2/2 + 3 plantillas | 6/6 | Buscó el formato de plantilla, que ahora va en la guía |
| 5 · calistenia y cardio (WhatsApp) | 43 s | 0,39 USD | 5/5 | 8/8 | Creó `pino-pared` en el catálogo |

En todas: `CONTEXTO/` vacío al terminar (todo en `procesado/`), `convenciones.md` escrito y las dudas concretas en `revision.md`. En la primera ejecución de la persona 1, Claude contó que un apóstrofo bloqueaba un heredoc. No se pudo reproducir: las pruebas con `12'5` y `didn't` dentro del heredoc pasan. Aun así, queda la alternativa `--fichero`.

## 8. Decisiones de la Fase 4 (web base, Panel y Rex)

- **`web/dashboard.html`**, un solo fichero (unos 28 KB) con HTML, CSS y JS. Sin librerías, sin CDN y sin fuentes externas; `pnpm lint` falla si aparece una URL de red, un `<link>`, `fetch` o un `src` que no sea `datos.js` o `version.js`. Usa las variables de color de las maquetas en claro y oscuro (`prefers-color-scheme`). Ancho máximo de 980 px; por debajo de 700 px, una sola columna.
- **La página no calcula:** `lib/panel.mjs` prepara cada cifra del Panel (KPIs, calendario, progresión con su eje, objetivos, series por grupo con su estado, rutina, semana, sensaciones, descarga y Rex). La página solo da formato (coma decimal) y dibuja el SVG.
- **Repintado por bloques:** cada bloque guarda el JSON que pintó y solo se repinta si cambia. La pestaña, los filtros (en el `#ancla`) y el scroll se conservan.
- **Pestañas:** clic, teclas `1`–`5` y `#ancla` (`#progreso`, `#analisis?modo=volumen`, `#ejercicios/press-banca`).
  - Los comandos de vista escriben `navegar` en los datos; la pestaña abierta cambia en ≤ 1 s.
  - Una página `file://` no puede avisar de que está abierta, así que esos comandos solo abren otra pestaña si gymhub no ha abierto la web en las últimas 12 h (`.gymhub/abierta.json`). Si no la tienes abierta, `/gymhub:web`.
  - Si la página se abre con `#ancla`, manda el ancla.
- **Banner de proceso:** «Normalizando · lote 7 de 18 (2024-03) · 41 %», con su barra, mientras hay un proceso activo, y «Listo · …» durante 10 minutos al terminar. Si `datos.js` no se puede leer dos veces seguidas, sale un aviso discreto bajo la cabecera.
- **Panel, decisiones de detalle:**
  - **Volumen:** se compara con la semana anterior **hasta el mismo día** de la semana, porque a mitad de semana compararla entera daría siempre en negativo.
  - **Progresión:** el principal más reciente con al menos 2 sesiones en kg, o el que se elija con `/gymhub:ejercicio` (`.gymhub/panel.json`).
  - **Rutina de hoy:** la sesión de hoy si ya está; si no, la plantilla con `dia:` de hoy; si no, el tipo que más veces sigue al último entrenado en las 12 últimas semanas.
  - **Grupos:** a dos columnas si hay más de 6.
  - **Descarga sugerida:** 3 semanas seguidas con RPE medio ≥ 8,5, o al menos 2 principales sin mejorar su e1RM en 4 semanas frente a las 8 anteriores.
- **Rex** (SVG pixelado, el sprite de la maqueta). Prioridad de estados:
  1. levantando / descansando (con un entreno en vivo, Fase 7);
  2. PR en las últimas 24 h: salta con `✦`;
  3. entreno de hoy hecho, o semana cumplida: reposo, con el ojo cerrado, `z` y la mancuerna en el suelo;
  4. «¡Hoy toca …!»: la mancuerna sube y baja, como en la maqueta.

  Nivel: 1 + 1 por cada 25 sesiones. Respeta `prefers-reduced-motion`.
- **Comprobado con la web de verdad** (regla 12):
  - **Capturas:** con `scripts/captura.mjs` (Edge sin ventana), en claro, en oscuro y a 560 px, comparadas con `docs/maquetas/panel.html`.
  - **`tests/web/medir-web.mjs` en Edge de Windows:** cada cambio se ve en 0,1–0,86 s, y un `/refresh` sintético de 3 lotes se ve avanzar en el banner hasta «Listo · 3 sesiones nuevas».
  - **`pnpm test:web`** (`tests/web/interaccion.mjs`, Playwright, en Chromium y Firefox): pestañas por clic y teclas, `#ancla`, navegación pedida por un comando (0,5–0,8 s), datos nuevos sin recargar y sin volver arriba, tema oscuro, móvil sin scroll horizontal y ninguna petición fuera de `file://`.
- **Herramientas de desarrollo:** `playwright-core` como dependencia de desarrollo (pnpm), que usa los navegadores de `~/.cache/ms-playwright`. En esta máquina el Chromium de Linux no encuentra `libnspr4`; en vez de instalar paquetes del sistema, la prueba le pasa las librerías que trae el Firefox de Playwright (`LD_LIBRARY_PATH`). `pnpm demo <carpeta>` crea una carpeta con el historial sintético de 2 años (`tests/fixtures/historial.mjs`).

## 9. Decisiones de la Fase 5 (Progreso)

- **Mapa muscular:** la silueta de la maqueta (frente y espalda), con una zona por cada grupo de FORMATO §5. Se añaden antebrazo, aductor y espalda alta, que la maqueta dejaba en gris. Cinco tonos según las series de la semana (0, 4, 8, 12 y 16 o más) y un tooltip por zona. «Olvidados»: los grupos que la persona quiere trabajar (sus series objetivo de FICHA.md) que van por debajo de 4 series, como mucho 3.
- **Pared de récords:** el mejor de cada ejercicio (principales primero) con su fecha corta. «Nuevo» si es de los últimos 7 días; entonces aparece un Rex pequeño que salta. Debajo, los PRs del mes y del año.
- **Escala «carga»** (corrección de la Fase 2): una serie con kg pero de más de 10 repeticiones no tiene e1RM (Epley solo vale hasta 10). Antes eso daba un récord de «0 kg e1RM»; ahora ese ejercicio progresa por su mejor carga × repeticiones.
- **Bloque:** las 6 últimas semanas de calendario.
  - **Intensidad:** el % medio del e1RM vigente (el mejor de las 12 semanas anteriores) en las series de trabajo de los ejercicios principales.
  - **Volumen:** las toneladas, normalizadas a la semana más alta.
  - **Etiqueta:** `SEM n` si las sesiones traen `semana_programa`; si no, `S` y la semana ISO. «desc.» si el volumen queda por debajo del 70 % y la intensidad del 72 %.
- **Calculadora de discos:** la tabla de la barra a 300 kg (en pasos del doble del disco más pequeño) viene **precalculada** en `datos.js`, con los colores de la maqueta, así que la página solo la consulta. Avisa si un peso no sale exacto con los discos de la config y propone el más cercano. El valor inicial es el último de `/gymhub:discos` (`.gymhub/discos.json`) o 100 kg.
- `Esc` quita el foco de un campo, para que las teclas `1`–`5` vuelvan a cambiar de vista.
- **Comprobado:**
  - capturas en claro, en oscuro y a 560 px frente a `docs/maquetas/progreso.html`;
  - `pnpm test:web`, que escribe pesos en la calculadora y comprueba los discos, el aviso de «no sale exacto» y el de fuera de rango, y los tooltips del mapa;
  - tests de las cifras (`tests/progreso.test.mjs`).

## 10. Decisiones de la Fase 6 (Análisis, Diario y Ejercicios)

- **`lib/analisis.mjs`**, con la tabla del plan. Cada métrica devuelve `n/d` con su motivo cuando faltan datos.
  - **Radar de fuerza:** el ejercicio de referencia de cada patrón es el principal del catálogo; si la persona no hace ninguno, su ejercicio más frecuente del patrón en kg (también para banca:remo). Las dominadas lastradas entran con el peso corporal. Un patrón sin datos sale `n/d` en su eje.
  - **Hace 3 meses:** el mismo cálculo con la ventana que termina hace 12 semanas.
  - **Disposición:** sueño de la sesión de hoy o de ayer (40 %), RPE de 7 días como (10 − RPE) × 25 (30 %), y la última sensación pre de 7 días (30 %). La página dice qué componentes entraron.
  - **Predicción:** mínimos cuadrados sobre el mejor e1RM de cada semana (al menos 6 semanas). El punto de partida es el mayor entre la recta hoy y la mejor de las 2 últimas semanas. Además de estancado y «> 1 año», «conseguido» si ya se ha llegado.
  - **Estancados:** escala kg, al menos 4 sesiones, entrenado en las últimas 4 semanas y sin superar su mejor e1RM desde hace 4 semanas o más.
  - **Lo que dicen tus datos:** el e1RM relativo de cada ejercicio frente a la media de sus 5 sesiones anteriores (desde la 4.ª), promediado por sesión, comparado entre grupos (sueño, franja horaria, días de descanso). Con n ≥ 30 y ≥ 10 por grupo, como mucho dos hallazgos y siempre con su n.
- **`lib/diario.mjs`:**
  - **Molestias:** una fila por zona y lado, 12 celdas con el peor estado de la semana; una semana sin menciones queda vacía, no «bien».
  - **Aviso de repetición:** las últimas menciones seguidas de la zona con molestia o dolor, 3 o más, la última en las 4 semanas anteriores.
  - **Hitos:** inicio o cambio de programa, primera vez de un ejercicio (salvo en la primera sesión del historial), pausas e hitos de `eventos.md`.
  - **En la web:** la línea de tiempo enseña 40 entradas y «ver más». `/gymhub:diario <zona|ejercicio>` aplica el chip de la zona o, si no es una zona, lo busca como texto.
- **`lib/ejercicio.mjs`:** la ficha de cada ejercicio con 3 sesiones o más. Los ejes de cada rango (6M, 1A, Todo) vienen calculados; la página solo filtra los puntos por fecha. Para los ejercicios sin e1RM (nivel, lastre sin peso corporal, tiempo, carga a más de 10 repeticiones), el gráfico usa su escala.
  - **Mejor marca:** la carga más alta.
  - **Variación de 12 meses:** el mejor de las últimas 8 semanas frente al de ±4 semanas de hace un año.
  - **Frecuencia:** sesiones de los últimos 12 meses ÷ 12.
  - **En tus notas:** frases que nombran el ejercicio por su nombre, su id o un alias de 4 letras o más.
- **Decimales con coma** en todo lo que se muestra (`decimalEs`). El formato estándar sigue guardando el punto.
- **Persona sintética de 2 años con cifras verificadas a mano** (`tests/fixtures/dosanios.mjs` + `tests/analisis.test.mjs`): progresiones lineales conocidas y ejercicios estancados a propósito. Las cuentas van en los comentarios del test: radar de fuerza y volumen, los tres ratios, A:C = 9081,25 ÷ (36212,5 ÷ 4) = 1,00, predicciones con su fecha (por ejemplo, sentadilla a 0,58 kg/sem → 13 may 2027), estancados de 103 semanas, disposición de 60, adherencia del 100 % y la ficha de press banca (+27,4 % en 12 meses, 4,3 al mes). Hacerlas a mano destapó tres errores **en mis cuentas**, no en el código. También hay casos `n/d` con solo 4 sesiones.
- **Comprobado:**
  - capturas de las tres vistas frente a sus maquetas (en claro, en oscuro y a 560 px);
  - `pnpm test:web` en Chromium y Firefox: conmutador fuerza/volumen en el `#ancla`, chips y buscador del Diario, desplegar una sesión, filtro pedido por un comando, elegir ejercicio, rangos y el enlace de una fecha al Diario.

## 11. Decisiones de la Fase 7 (comandos de seguimiento y registro en vivo)

- **`/gymhub:semana [AAAA-Www|anterior]`:** el script (`semana`) prepara el borrador con todas las cifras: sesiones, series, volumen frente a la semana anterior, PRs, RPE, sueño, sensaciones, series por grupo frente a FICHA.md, molestias, A:C, descarga y estancados. Claude copia las cifras tal cual, añade 2 a 4 viñetas en «Qué ajustar» y lo guarda con `escribir semanas/AAAA-Www.md` (con copia si ya existía). Sin argumento, la semana actual; si todavía está vacía, la anterior.
- **`/gymhub:ejercicio <nombre>`:** busca por nombre, alias, id o parte del nombre entre los ejercicios con historial. Si el alias exacto no tiene historial y solo hay uno parecido que sí lo tiene, se queda con ese («remo» → remo con mancuerna). Imprime el resumen, deja la gráfica del Panel en ese ejercicio (`.gymhub/panel.json`) y lleva la web a `#ejercicios/<id>`.
- **`/gymhub:revision`:** `revision` numera las dudas y señala las sesiones de esa fecha; `revision marcar <n> --nota` las cierra. Para arreglar una sesión, `corregir <ruta>`:
  - valida la sesión y guarda copia de la anterior;
  - conserva el original;
  - la saca de `generadas.json`, de modo que pasa a contar como editada a mano y ya no se reemplaza nunca.

  Una duda que era una convención se guarda en `convenciones.md`. Claude no borra ficheros.
- **`/gymhub:discos <kg>`:** discos por lado con la barra y los discos de la config. La calculadora de la web se pone en ese valor (`.gymhub/discos.json` y `navegar`).
- **Registro en vivo** (opcional): `/gymhub:entreno [plantilla]`, `/gymhub:serie "…"` y `/gymhub:fin`.
  - **Entreno:** la rutina es la plantilla pedida o la de hoy. Enseña el calentamiento de §3.1 para el primer ejercicio con barra (barra × 10, 50 % × 5, 70 % × 3, 85 % × 1, redondeado al disco) y el prehab de FICHA.md.
  - **Serie:** el texto se guarda **tal cual** en `CONTEXTO/AAAA-MM-DD-en-vivo.md`, que luego importa `/gymhub:refresh` como cualquier otro elemento. El script solo marca la casilla del ejercicio que identifica Claude y arranca el descanso (el de la plantilla o `descanso_s_por_defecto`).
  - **Fin:** pide la sensación y las notas y lanza el flujo de `/refresh`.
  - **Panel:** la rutina sale «en curso» con sus casillas, y Rex pasa a «levantando» o a «descansando» con la cuenta atrás.
- **Cuenta atrás y relojes** (§2.9): el script guarda el inicio del descanso en su reloj (WSL) y el desfase con Windows, medido una vez por hora con PowerShell (`.gymhub/reloj.json`). La página resta el desfase. Fuera de WSL el desfase es 0.
- **Aviso de fin de descanso:** un proceso suelto que espera los segundos del descanso y muestra un toast de Windows (WinRT desde PowerShell, como en Huddle). En macOS, `osascript`; en Linux, `notify-send`. Se desactiva con `aviso_descanso: false` en la config o con `GYMHUB_NO_AVISO=1`. **No se ha lanzado un toast real** en estas pruebas, para no llenarte de avisos; lo cubren los tests con el aviso desactivado.
- `--` en la línea de órdenes del script: lo que va detrás es texto, aunque empiece por `--`.
- **Prueba real:** `/gymhub:semana` y `/gymhub:ejercicio banca` en sesiones `claude -p` sobre una demo sintética. El fichero de la semana lleva las cifras del script y los ajustes de Claude, y la web quedó en `#ejercicios/press-banca`.
