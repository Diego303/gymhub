// G3 · datos.js: JS válido con cualquier texto, escritura atómica, versión estable y nada corrupto
// aunque se mate el proceso a mitad (100 veces).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import vm from "node:vm";
import { temporal, cli, BIN } from "./ayuda.mjs";
import { leerSesion } from "../lib/canonico.mjs";
import { prng, semillaBase } from "./fixtures/aleatorio.mjs";

let t, carpeta;
const HOSTIL = "comillas \" y ' · </script><script>alert(1)</script> · salto\nde línea · emoji 🏋️‍♀️ · \u2028 y \u2029 · barra \\ · ${x} · `tilde`";
before(() => {
  t = temporal();
  carpeta = join(t.dir, "G");
  cli(t.dir, ["configurar", carpeta]);
  process.env.GYMHUB_CONFIG = join(t.dir, "config.json");
  mkdirSync(join(carpeta, "sesiones", "2026"), { recursive: true });
  for (const [f, kg] of [["2026-10-26", 80], ["2026-10-28", 82.5], ["2026-10-30", 85]]) {
    writeFileSync(join(carpeta, "sesiones", "2026", `${f}.md`), `---\nfecha: ${f}\ntitulo: ${JSON.stringify(HOSTIL)}\nconfianza: alta\n---\n## Ejercicios\n### Press banca\n<!-- id: press-banca -->\n| # | tipo | carga | reps | rpe | rir | nota |\n|---|---|---|---|---|---|---|\n| 1 | trabajo | ${kg} kg | 5 | 8 | | ${HOSTIL.replace(/\n/g, " ").replace(/\|/g, "\\|")} |\n\n## Notas\n${HOSTIL}\n`);
  }
});
after(() => { delete process.env.GYMHUB_CONFIG; t.limpiar(); });

/** Ejecuta datos.js como lo haría la página y devuelve window.GYMHUB. */
const evaluar = (fichero) => { const window = {}; vm.runInNewContext(readFileSync(fichero, "utf8"), { window }); return window; };
const web = (...p) => join(carpeta, ".gymhub", "web", ...p);

test("datos.js es JS válido y conserva exactos los textos con comillas, </script>, saltos, emojis y U+2028", () => {
  assert.equal(cli(t.dir, ["publicar", "--carpeta", carpeta]).codigo, 0);
  const G = evaluar(web("datos.js")).GYMHUB;
  assert.equal(G.version, evaluar(web("version.js")).GYMHUB_VERSION);
  const entrada = G.diario.linea.find((e) => e.t === "s");
  assert.equal(entrada.notas, HOSTIL.trim());
  assert.equal(entrada.titulo, HOSTIL);
  assert.equal(G.errores.length, 0);
  // Lo mismo que datos.json (más proceso, vivo, navegar y la versión)
  const json = JSON.parse(readFileSync(join(carpeta, ".gymhub", "datos.json"), "utf8"));
  assert.deepEqual(JSON.parse(JSON.stringify(G.diario)), json.diario); // (los objetos de vm tienen otro prototipo)
});

test("la escritura es atómica: no quedan temporales y la versión solo cambia si cambian los datos", () => {
  cli(t.dir, ["publicar", "--carpeta", carpeta]);
  const v1 = evaluar(web("version.js")).GYMHUB_VERSION;
  cli(t.dir, ["publicar", "--carpeta", carpeta]);
  cli(t.dir, ["web", "--no-abrir", "--carpeta", carpeta]);
  assert.equal(evaluar(web("version.js")).GYMHUB_VERSION, v1, "sin cambios, la misma versión");
  assert.deepEqual(readdirSync(web()).filter((n) => n.includes(".tmp-")), []);
  const f = join(carpeta, "sesiones", "2026", "2026-10-30.md");
  writeFileSync(f, readFileSync(f, "utf8").replace("85 kg", "87.5 kg"));
  cli(t.dir, ["publicar", "--carpeta", carpeta]);
  const v2 = evaluar(web("version.js")).GYMHUB_VERSION;
  assert.notEqual(v2, v1, "con una sesión cambiada, otra versión");
  assert.equal(evaluar(web("datos.js")).GYMHUB.version, v2);
});

/** Lanza bin/gymhub.mjs y lo mata con SIGKILL a los `ms` milisegundos. */
const lanzarYMatar = (args, ms, entrada = null) => new Promise((resolve) => {
  const p = spawn(process.execPath, [BIN, ...args], { env: { ...process.env, GYMHUB_NO_ABRIR: "1" }, stdio: [entrada === null ? "ignore" : "pipe", "ignore", "ignore"] });
  if (entrada !== null) p.stdin.end(entrada);
  const tm = setTimeout(() => p.kill("SIGKILL"), ms);
  p.on("exit", () => { clearTimeout(tm); resolve(); });
});
/** Nada corrupto: los JSON de .gymhub se leen, datos.js y version.js se ejecutan y las sesiones validan. */
function sinCorrupcion(n) {
  for (const f of readdirSync(join(carpeta, ".gymhub")).filter((x) => x.endsWith(".json"))) {
    assert.doesNotThrow(() => JSON.parse(readFileSync(join(carpeta, ".gymhub", f), "utf8")), `${n}: ${f}`);
  }
  if (existsSync(web("datos.js"))) assert.ok(evaluar(web("datos.js")).GYMHUB.version, `${n}: datos.js`);
  if (existsSync(web("version.js"))) assert.ok(evaluar(web("version.js")).GYMHUB_VERSION, `${n}: version.js`);
  for (const a of readdirSync(join(carpeta, "sesiones"))) for (const f of readdirSync(join(carpeta, "sesiones", a)).filter((x) => x.endsWith(".md"))) {
    assert.deepEqual(leerSesion(readFileSync(join(carpeta, "sesiones", a, f), "utf8")).errores, [], `${n}: ${a}/${f}`);
  }
}

test("matar el proceso a mitad 100 veces (publicar y guardar) no deja nada corrupto, y la web sigue con el último estado bueno", async () => {
  const g = prng(semillaBase() + 7);
  for (let i = 0; i < 70; i++) {
    await lanzarYMatar(["publicar", "--carpeta", carpeta], g.ent(20, 400));
    sinCorrupcion(`publicar ${i}`);
  }
  for (let i = 0; i < 30; i++) {
    const f = `2026-09-${String(i + 1).padStart(2, "0")}`;
    const s = `@@@ sesion\n---\nfecha: ${f}\ntitulo: Torso\nconfianza: alta\n---\n## Ejercicios\n### Press banca\n<!-- id: press-banca -->\n| # | tipo | carga | reps | rpe | rir | nota |\n|---|---|---|---|---|---|---|\n| 1 | trabajo | 70 kg | 5 | | | |\n\n<details><summary>Original</summary>\n\nbanca 5x70\n\n</details>\n`;
    await lanzarYMatar(["refresh", "guardar", "directo", "--carpeta", carpeta], g.ent(20, 500), s);
    sinCorrupcion(`guardar ${i}`);
  }
  // Y después todo sigue funcionando: sin cerrojo colgado, la siguiente orden va a la primera
  const t0 = Date.now();
  const r = cli(t.dir, ["publicar", "--carpeta", carpeta]);
  assert.equal(r.codigo, 0, r.salida + r.error);
  assert.ok(Date.now() - t0 < 10000, `tardó ${Date.now() - t0} ms`);
  sinCorrupcion("final");
  assert.equal(existsSync(join(carpeta, ".gymhub", "cerrojo")), false);
});
