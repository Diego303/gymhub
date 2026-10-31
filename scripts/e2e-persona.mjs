// Importa una persona sintética con Claude de verdad (claude -p + /gymhub:refresh) en una carpeta
// temporal y compara el resultado con su resultado esperado.
//   node scripts/e2e-persona.mjs <persona> [--modelo sonnet] [--dir /tmp/x]
import { cpSync, mkdtempSync, readdirSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { leerSesion } from "../lib/canonico.mjs";
import { TIPOS_TRABAJO } from "../lib/canonico.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const [persona, ...resto] = process.argv.slice(2);
const op = (k) => { const i = resto.indexOf(`--${k}`); return i >= 0 ? resto[i + 1] : null; };
const base = op("dir") || mkdtempSync(join(tmpdir(), `gymhub-e2e-${persona}-`));
const carpeta = join(base, "GIMNASIO");
const env = { ...process.env, GYMHUB_CONFIG: join(base, "config.json"), GYMHUB_NO_ABRIR: "1", HUDDLE_IGNORAR: "1" };
const node = (args) => spawnSync(process.execPath, [join(RAIZ, "bin/gymhub.mjs"), ...args], { env, encoding: "utf8" });

if (!op("solo-comparar")) {
  node(["configurar", carpeta]);
  cpSync(join(RAIZ, "tests/fixtures/personas", persona, "CONTEXTO"), join(carpeta, "CONTEXTO"), { recursive: true });
  const args = ["-p", "--no-session-persistence", "--plugin-dir", RAIZ, "--output-format", "stream-json", "--verbose", "/gymhub:refresh"];
  if (op("modelo")) args.splice(1, 0, "--model", op("modelo"));
  const t0 = Date.now();
  const r = spawnSync("claude", args, { cwd: base, env, encoding: "utf8", timeout: 20 * 60 * 1000, input: "" });
  writeFileSync(join(base, "traza.jsonl"), r.stdout);
  let salida = { result: r.stderr };
  const problemas = [];
  for (const l of r.stdout.split("\n").filter(Boolean)) {
    let d; try { d = JSON.parse(l); } catch { continue; }
    if (d.type === "result") salida = d;
    if (d.type === "user" && Array.isArray(d.message?.content)) for (const b of d.message.content) {
      const t = typeof b.content === "string" ? b.content : JSON.stringify(b.content ?? "");
      if (b.type === "tool_result" && (b.is_error || /requires approval|NO SE HA GUARDADO|blocked/.test(t))) problemas.push(t.slice(0, 600));
    }
  }
  if (problemas.length) console.log(`Herramientas con error o bloqueadas (${problemas.length}):\n- ${problemas.join("\n- ")}\n`);
  console.log(`# ${persona} · ${Math.round((Date.now() - t0) / 1000)} s · coste ${salida.total_cost_usd ?? "?"} USD · turnos ${salida.num_turns ?? "?"}`);
  console.log(`Resumen de Claude:\n${String(salida.result ?? "").trim()}\n`);
}

// ── Comparar ──
const esperado = await import(join(RAIZ, "tests/fixtures/personas", persona, "esperado.mjs"));
const norm = (t) => String(t ?? "").toLowerCase().replace(/,/g, ".").replace(/\s+/g, " ").replace(/(\d)\.0\b/g, "$1").trim();
const huella = (s) => {
  const ej = {};
  for (const e of s.ejercicios) {
    const trabajo = e.series.filter((x) => TIPOS_TRABAJO.includes(x.tipo)).map((x) => `${norm(x.carga.texto)}×${norm(x.reps.texto)}`);
    ej[e.id] = [...(ej[e.id] || []), ...trabajo];
  }
  return ej;
};
const esperadas = esperado.bloques.filter((b) => b.tipo === "sesion").map((b) => leerSesion(b.md));
const dir = join(carpeta, "sesiones");
const obtenidas = existsSync(dir) ? readdirSync(dir).flatMap((a) => readdirSync(join(dir, a)).map((f) => leerSesion(readFileSync(join(dir, a, f), "utf8"), `sesiones/${a}/${f}`))) : [];
let ok = 0, total = 0;
const diferencias = [];
for (const e of esperadas) {
  const o = obtenidas.find((x) => x.fecha === e.fecha);
  if (!o) { diferencias.push(`${e.fecha}: FALTA la sesión`); total += 1; continue; }
  const he = huella(e), ho = huella(o);
  for (const [id, series] of Object.entries(he)) {
    total++;
    if (!ho[id]) { diferencias.push(`${e.fecha}: falta ${id} (hay: ${Object.keys(ho).join(", ")})`); continue; }
    if (JSON.stringify(ho[id]) !== JSON.stringify(series)) { diferencias.push(`${e.fecha} ${id}: ${ho[id].join(" ")} ≠ esperado ${series.join(" ")}`); continue; }
    ok++;
  }
  for (const id of Object.keys(ho)) if (!he[id]) diferencias.push(`${e.fecha}: sobra ${id}`);
  for (const k of ["sensacion_pre", "sensacion_post", "sueno_h", "peso_corporal_kg"]) if (e[k] !== null && e[k] !== o[k]) diferencias.push(`${e.fecha}: ${k} ${o[k]} ≠ esperado ${e[k]}`);
  const zonas = (s) => s.molestias.map((m) => `${m.zona}:${m.estado}`).sort().join(",");
  if (zonas(e) !== zonas(o)) diferencias.push(`${e.fecha}: molestias «${zonas(o)}» ≠ esperado «${zonas(e)}»`);
}
for (const o of obtenidas) if (!esperadas.some((e) => e.fecha === o.fecha)) diferencias.push(`${o.ruta}: sesión que no se esperaba`);
const quedan = existsSync(join(carpeta, "CONTEXTO")) ? readdirSync(join(carpeta, "CONTEXTO")).filter((n) => !["LEEME.md", "procesado"].includes(n)) : [];
const conv = readFileSync(join(carpeta, "convenciones.md"), "utf8");
console.log(`Sesiones: ${obtenidas.length} (esperadas ${esperadas.length}) · ejercicios idénticos: ${ok}/${total} · CONTEXTO pendiente: ${quedan.join(", ") || "nada"} · convenciones.md: ${/^\s*[-*]\s+\S/m.test(conv.replace(/<!--[\s\S]*?-->/g, "")) ? "escrito" : "VACÍO"}`);
console.log(diferencias.length ? `Diferencias:\n- ${diferencias.join("\n- ")}` : "Sin diferencias.");
console.log(`Carpeta: ${carpeta}`);
