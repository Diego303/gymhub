# Sonda de la Fase 0

Herramientas con las que se verificó lo que cuenta `docs/notas-tecnicas.md`. No forman parte del plugin.

## `plugin/`: formato de comandos y skills

Un plugin mínimo, `gymhub-sonda`, para cargarlo con `--plugin-dir`:

```bash
claude --plugin-dir tests/sonda/plugin
```

- `/gymhub-sonda:web`: publica una versión nueva de un `datos.js` de prueba junto a `prueba.html` y, la primera vez (o con `abrir`), abre la página en el navegador. En WSL usa `wslview` si existe y, si no, `explorer.exe`. Repite el comando con la página abierta: la versión cambia sola en un segundo, sin recargar.
  - `GYMHUB_SONDA_DIR=<carpeta>` cambia la carpeta (por defecto, la temporal de Windows en WSL).
  - `GYMHUB_NO_ABRIR=1` publica sin abrir el navegador.
- `/gymhub-sonda:expansion a b`: enseña cómo se expanden `$ARGUMENTS`, `$0`/`$1`, `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}` y la preejecución `` !`…` ``.
- La skill `gymhub-sonda:sonda` carga un `FORMATO.md` de prueba con el script.

## `web/`: recarga de `datos.js` con `file://`

```bash
node tests/sonda/web/medir.mjs edge    <carpeta> [rondas]
node tests/sonda/web/medir.mjs chrome  <carpeta> [rondas]
node tests/sonda/web/medir.mjs firefox <carpeta> [rondas]
```

- Abre `prueba.html` en el navegador sin ventana, con un perfil temporal propio que se borra al terminar, y lee la consola de la página.
- Publica versiones nuevas con el latido normal (1 s) y con un proceso activo (0,5 s), y mide cuánto tarda la página en verlas. Después prueba un `datos.js` a medio escribir y un `datos.js` que desaparece.
- Todas las horas son del reloj de WSL, porque el de Windows va desfasado (ver las notas, §2.9).
- La carpeta debe ser accesible desde el navegador: en WSL, mejor una de Windows (`/mnt/c/...`).
- Rutas de los navegadores: las estándar de Windows. Se cambian con `GYMHUB_EDGE`, `GYMHUB_CHROME` y `GYMHUB_FIREFOX`. Sin Firefox de Windows, usa el de Playwright si está en `~/.cache/ms-playwright`.
