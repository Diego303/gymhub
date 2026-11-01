// G4 · El plugin: manifiestos, comandos y skill donde y como los espera Claude Code (frontmatter,
// descripciones, allowed-tools mínimos), sin hooks, los ejemplos de la skill pasan el validador,
// rutas raras en los comandos y la instalación con alcance de proyecto.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { RAIZ, temporal, cli } from "./ayuda.mjs";
import { SUBCOMANDOS } from "../lib/registro.mjs";
import "../lib/cli.mjs";
import { leerBloques } from "../lib/refresh.mjs";
import { leerSesion, validarSesion, TIPOS_SERIE } from "../lib/canonico.mjs";
import { leerPlantilla } from "../lib/plantillas.mjs";
import { leerEventos } from "../lib/eventos.mjs";
import { CAT } from "./fixtures/ayuda-metricas.mjs";

const leer = (...p) => readFileSync(join(RAIZ, ...p), "utf8");
const frontmatter = (t) => Object.fromEntries((t.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "").split("\n").map((l) => l.match(/^([\w-]+):\s*(.*)$/)).filter(Boolean).map((m) => [m[1], m[2]]));
const SCRIPT = 'Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs":*)';
const PERMITIDAS = new Set([SCRIPT, "Read", "AskUserQuestion", "Agent"]);
const COMANDOS = readdirSync(join(RAIZ, "commands")).filter((n) => n.endsWith(".md"));
const herramientas = (fm) => (fm["allowed-tools"] ?? "").split(/,\s*(?=[A-Z])/).map((x) => x.trim()).filter(Boolean);
const claude = (() => { try { execFileSync("claude", ["--version"], { stdio: "ignore" }); return true; } catch { return false; } })();

test("manifiestos: plugin.json y marketplace.json válidos y coherentes", () => {
  const p = JSON.parse(leer(".claude-plugin/plugin.json"));
  const m = JSON.parse(leer(".claude-plugin/marketplace.json"));
  assert.equal(p.name, "gymhub");
  assert.match(p.version, /^\d+\.\d+\.\d+$/);
  assert.equal(p.version, JSON.parse(leer("package.json")).version);
  assert.ok(p.description && p.license === "MIT");
  assert.equal(m.plugins.length, 1);
  assert.deepEqual([m.plugins[0].name, m.plugins[0].source], ["gymhub", "./"]);
  assert.equal(p.hooks, undefined, "el plugin no declara hooks");
  assert.equal(existsSync(join(RAIZ, "hooks")), false, "no hay carpeta hooks/: las pruebas de hooks de G4 no aplican");
});

test("cada comando: descripción, allowed-tools mínimos (solo el script y lo imprescindible) y subcomandos que existen", () => {
  assert.ok(COMANDOS.length >= 15);
  for (const n of COMANDOS) {
    const t = leer("commands", n);
    const fm = frontmatter(t);
    assert.ok(fm.description && fm.description.length >= 20 && fm.description.length <= 200, `${n}: descripción`);
    const hs = herramientas(fm);
    assert.ok(hs.includes(SCRIPT), `${n}: el script`);
    for (const h of hs) assert.ok(PERMITIDAS.has(h), `${n}: herramienta de más «${h}»`);
    if (fm.model) assert.ok(["haiku", "sonnet"].includes(fm.model), `${n}: modelo`);
    // Las pre-ejecuciones (!`…` detrás de un espacio o al principio de línea, como las lee Claude Code) solo llaman al script
    for (const m of t.matchAll(/(?:^|\s)!`([^`]+)`/gm)) assert.match(m[1], /^node "\$\{CLAUDE_PLUGIN_ROOT\}\/bin\/gymhub\.mjs" /, `${n}: pre-ejecución ${m[1]}`);
    // Cada subcomando que se cita existe
    for (const m of t.matchAll(/gymhub\.mjs"\s+([a-z]+)/g)) assert.ok(SUBCOMANDOS[m[1]], `${n}: subcomando «${m[1]}» no existe`);
  }
});

test("la skill: nombre, descripción y allowed-tools; sus subcomandos existen", () => {
  const t = leer("skills/gymhub/SKILL.md");
  const fm = frontmatter(t);
  assert.equal(fm.name, "gymhub");
  assert.ok(fm.description.length > 50);
  assert.deepEqual(herramientas(fm), [SCRIPT, "Read"]);
  for (const m of t.matchAll(/gymhub\.mjs"\s+([a-z]+)/g)) assert.ok(SUBCOMANDOS[m[1]], m[1]);
  for (const sub of ["leer", "escribir", "contexto", "ejercicio", "semana", "web", "formato", "guia"]) assert.ok(SUBCOMANDOS[sub], sub);
});

test("los ejemplos de la skill (guardar.md) pasan el validador del formato", () => {
  const t = leer("skills/gymhub/guardar.md");
  const heredoc = t.match(/<<'GYMHUB_FIN'\n([\s\S]*?)\nGYMHUB_FIN/)[1];
  const bloques = leerBloques(heredoc);
  assert.deepEqual(bloques.map((b) => b.tipo), ["sesion", "ignorar", "revision"]);
  const s = leerSesion(bloques[0].cuerpo);
  assert.deepEqual(validarSesion(s, CAT), []);
  assert.equal(s.ejercicios[0].series[0].carga.valor, 80);
  assert.equal(bloques[1].motivo, "mensaje sin entreno («buenos días»)");
  // La plantilla de ejemplo
  const pl = leerPlantilla(t.match(/```markdown\n([\s\S]*?)```/)[1], "pierna-a.md", CAT);
  assert.deepEqual([pl.nombre, pl.tipo, pl.dia, pl.ejercicios.length, pl.ejercicios[0].id, pl.ejercicios[0].series, pl.ejercicios[0].descanso_s], ["Pierna A", "pierna", 0, 2, "sentadilla", 5, 180]);
  // Los eventos de ejemplo
  const ev = leerEventos([...t.matchAll(/`(- \d{4}-\d{2}-\d{2}[^`]*)`/g)].map((m) => m[1]).join("\n"));
  assert.deepEqual(ev.errores, []);
  assert.deepEqual(ev.eventos.map((e) => [e.tipo, e.desde, e.hasta]), [["pausa", "2024-08-01", "2024-08-15"], ["programa", "2025-01-07", "2025-01-07"]]);
  // Las cargas que cita la skill son válidas
  for (const c of ["80 kg", "185 lb", "20 kg/mano", "PC+10 kg", "nivel 7"]) assert.ok(t.includes(`\`${c}\``), c);
});

const formatoVersionado = (() => { try { return execFileSync("git", ["ls-files", "docs/FORMATO.md"], { cwd: RAIZ }).toString().trim() !== ""; } catch { return false; } })();
test("FORMATO.md (lo que carga /refresh) coincide con el parser: columnas y tipos de serie",
  { skip: !existsSync(join(RAIZ, "docs/FORMATO.md")) ? "falta docs/FORMATO.md" : !formatoVersionado ? "D1: docs/FORMATO.md no está versionado; en un clon de GitHub /refresh normaliza sin sus reglas" : false }, () => {
    const f = leer("docs/FORMATO.md");
    assert.match(f, /\| # \| tipo +\| carga \| reps \| rpe \| rir \| nota +\|/);
    const tipos = f.match(/\| `tipo` \| (.*) \|/)[1].match(/`([a-z_]+)`/g).map((x) => x.slice(1, -1));
    assert.deepEqual(tipos, TIPOS_SERIE);
  });

test("ni la skill, ni los comandos, ni las plantillas, ni la web citan datos reales", () => {
  const ficheros = [...COMANDOS.map((n) => ["commands", n]), ["skills/gymhub/SKILL.md"], ["skills/gymhub/guardar.md"], ["web/dashboard.html"],
    ...readdirSync(join(RAIZ, "templates/GIMNASIO"), { recursive: true }).filter((n) => n.endsWith(".md")).map((n) => ["templates/GIMNASIO", n])];
  for (const f of ficheros) {
    const t = leer(...f).replaceAll("Diego303/gymhub", "<repositorio público>"); // el repo de la instalación es público a propósito
    assert.doesNotMatch(t, /diego|GIMNASIO-|\/home\/|@gmail|\+34/i, f.join("/"));
  }
});

test("rutas con espacios y tildes, relativas, que no existen y de Windows; la config persiste y se puede cambiar", () => {
  const t = temporal();
  try {
    const rara = join(t.dir, "Mis entrenos", "año ñandú");
    let r = cli(t.dir, ["configurar", rara]);
    assert.equal(r.codigo, 0, r.salida + r.error);
    assert.equal(JSON.parse(readFileSync(join(t.dir, "config.json"), "utf8")).carpeta, rara);
    writeFileSync(join(rara, "CONTEXTO", "notas.txt"), "12/03/2026\nbanca 5x80\n");
    r = cli(t.dir, ["refresh", "preparar", "--carpeta", rara]);
    assert.match(r.salida, /1 elementos nuevos/);
    // Relativa: desde el directorio de la sesión
    mkdirSync(join(t.dir, "sesion"));
    r = cli(t.dir, ["configurar", "../relativa"], { cwd: join(t.dir, "sesion") });
    assert.equal(r.codigo, 0);
    assert.equal(JSON.parse(readFileSync(join(t.dir, "config.json"), "utf8")).carpeta, join(t.dir, "relativa"));
    // Cambiar de carpeta: a una con estructura sí; a una que no existe, no (y lo dice)
    assert.equal(cli(t.dir, ["carpeta", rara]).codigo, 0);
    assert.equal(JSON.parse(readFileSync(join(t.dir, "config.json"), "utf8")).carpeta, rara);
    r = cli(t.dir, ["carpeta", join(t.dir, "no existe")]);
    assert.equal(r.codigo, 3);
    assert.match(r.salida, /^SIN_ESTRUCTURA: .*no existe\. Para crearla: configurar/);
    assert.equal(JSON.parse(readFileSync(join(t.dir, "config.json"), "utf8")).carpeta, rara, "no se cambia");
    // Una orden sobre una carpeta que no existe: error claro, sin traza de Node
    r = cli(t.dir, ["refresh", "preparar", "--carpeta", join(t.dir, "nada")]);
    assert.equal(r.codigo, 1);
    assert.match(r.error, /^gymhub: la carpeta .*nada no tiene la estructura de gymhub\. Usa \/gymhub:configurar/);
    assert.doesNotMatch(r.error, /\n\s+at /);
    // Ruta de Windows (en WSL): D:\Mis entrenos → /mnt/d/Mis entrenos (solo se traduce, no se escribe ahí)
    r = cli(t.dir, ["carpeta", "D:\\Mis entrenos ñ"], { env: { WSL_DISTRO_NAME: "Prueba" } });
    assert.match(r.salida, /SIN_ESTRUCTURA: \/mnt\/d\/Mis entrenos ñ /);
  } finally { t.limpiar(); }
});

test("claude plugin validate: el plugin y el marketplace son válidos", { skip: !claude && "no está la CLI de Claude Code" }, () => {
  const r = spawnSync("claude", ["plugin", "validate", RAIZ], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test("se instala con alcance de proyecto y queda activo solo en esa carpeta (config de Claude aislada)", { skip: !claude && "no está la CLI de Claude Code" }, () => {
  const t = temporal();
  try {
    const env = { ...process.env, CLAUDE_CONFIG_DIR: join(t.dir, "claude") };
    const proyecto = join(t.dir, "GIMNASIO"), otro = join(t.dir, "otro");
    mkdirSync(proyecto); mkdirSync(otro);
    const c = (args, cwd) => spawnSync("claude", args, { cwd, env, encoding: "utf8" });
    assert.equal(c(["plugin", "marketplace", "add", RAIZ], proyecto).status, 0);
    const i = c(["plugin", "install", "gymhub@gymhub", "--scope", "project"], proyecto);
    assert.equal(i.status, 0, i.stdout + i.stderr);
    assert.deepEqual(JSON.parse(readFileSync(join(proyecto, ".claude", "settings.json"), "utf8")).enabledPlugins, { "gymhub@gymhub": true });
    assert.match(c(["plugin", "list"], proyecto).stdout, /gymhub@gymhub[\s\S]*?Status: ✔ enabled/);
    assert.doesNotMatch(c(["plugin", "list"], otro).stdout, /gymhub@gymhub[\s\S]*?Status: ✔ enabled/);
    const d = c(["plugin", "details", "gymhub@gymhub"], proyecto).stdout;
    for (const n of COMANDOS) assert.match(d, new RegExp(`\\b${n.replace(".md", "")}\\b`), n);
  } finally { t.limpiar(); }
});

test("/gymhub:refresh carga siempre el formato, la guía de guardar y lo propio de la persona, y manda convenciones.md", () => {
  const t = leer("commands/refresh.md");
  const pre = [...t.matchAll(/(?:^|\s)!`node "\$\{CLAUDE_PLUGIN_ROOT\}\/bin\/gymhub\.mjs" ([^`]+)`/gm)].map((m) => m[1]);
  assert.deepEqual(pre, ["refresh preparar", "formato", "guia guardar", "contexto"]);
  assert.match(t, /Si choca con convenciones\.md, manda convenciones\.md/);
  assert.match(t, /no calcules ni estimes ninguna/);
  // Y la skill, por si se normaliza fuera de /refresh
  const s = leer("skills/gymhub/SKILL.md");
  for (const sub of ["ayuda", "formato", "guia guardar"]) assert.ok(s.includes(`!\`node "\${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs" ${sub}\``), sub);
});
