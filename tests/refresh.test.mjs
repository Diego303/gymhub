import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, readFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { temporal, cli } from "./ayuda.mjs";
import { preparar, guardar, cerrar, leerBloques } from "../lib/refresh.mjs";

let t, carpeta;
beforeEach(() => {
  t = temporal();
  carpeta = join(t.dir, "G");
  cli(t.dir, ["configurar", carpeta]);
  process.env.GYMHUB_CONFIG = join(t.dir, "config.json");
  process.env.GYMHUB_HOY = "2026-10-31";
});
afterEach(() => { t.limpiar(); delete process.env.GYMHUB_HOY; });

const ses = (fecha, carga = "80 kg", extra = "") => `---
fecha: ${fecha}
titulo: Torso
tipo: torso
confianza: alta
${extra}---
# ${fecha} · Torso

## Ejercicios

### Press banca
<!-- id: press-banca -->
| # | tipo | carga | reps | rpe | rir | nota |
|---|---|---|---|---|---|---|
| 1 | trabajo | ${carga} | 5 | 8 | | |

## Notas
`;
function contexto(texto, nombre = "notas.txt") { writeFileSync(join(carpeta, "CONTEXTO", nombre), texto); }
const lote1 = () => { const { imp } = preparar(carpeta); return { imp, ids: imp.lotes[0].ids, el: imp.elementos }; };

test("leerBloques: tipos, elementos y motivo", () => {
  const b = leerBloques("@@@ sesion elementos=a1,b2\n---\nx\n@@@ ignorar elementos=c3 · motivo: saludo\n@@@ plantilla Pierna A elementos=d4\ncuerpo");
  assert.deepEqual(b.map((x) => [x.tipo, x.elementos, x.motivo, x.nombre]), [["sesion", ["a1", "b2"], null, ""], ["ignorar", ["c3"], "saludo", ""], ["plantilla", ["d4"], null, "Pierna A"]]);
});

test("si algo no valida, no se escribe nada", () => {
  contexto("12/03/2026 torso\nbanca 5x80\n\n14/03/2026 torso\nbanca 5x82");
  const { ids } = lote1();
  const malo = `@@@ sesion elementos=${ids[0]}\n${ses("2026-03-12", "ochenta kilos")}\n@@@ sesion elementos=${ids[1]}\n${ses("2026-03-14")}`;
  const r = guardar(carpeta, 1, malo);
  assert.match(r.errores.join(), /carga no válida/);
  assert.equal(readdirSync(join(carpeta, "sesiones")).length, 0);
  const falta = guardar(carpeta, 1, `@@@ sesion elementos=${ids[0]}\n${ses("2026-03-12")}`);
  assert.match(falta.errores.join(), /faltan elementos del lote/);
  const sinMotivo = guardar(carpeta, 1, `@@@ sesion elementos=${ids[0]}\n${ses("2026-03-12")}\n@@@ ignorar elementos=${ids[1]}`);
  assert.match(sinMotivo.errores.join(), /falta «· motivo/);
  const idMalo = guardar(carpeta, 1, `@@@ sesion elementos=${ids[0]},${ids[1]}\n${ses("2026-03-12").replace("press-banca", "banca-rara")}`);
  assert.match(idMalo.errores.join(), /no está en el catálogo/);
  assert.equal(readdirSync(join(carpeta, "sesiones")).length, 0);
});

test("guardar: original exacto, fuente, catálogo nuevo, revisión, procesados y lote hecho", () => {
  contexto("12/03/2026 torso\nbanca 5x80 y algo raro en polea\n");
  const { ids, el } = lote1();
  const r = guardar(carpeta, 1, `@@@ ejercicios\n| polea-rara | Polea rara | rara | dorsal | biceps | polea | tiron-vertical | no |\n@@@ sesion elementos=${ids[0]}\n${ses("2026-03-12").replace("## Notas", "### Polea rara\n<!-- id: polea-rara -->\n| # | tipo | carga | reps | rpe | rir | nota |\n|---|---|---|---|---|---|---|\n| 1 | trabajo | 30 kg | 10 | | | |\n\n## Notas")}\n@@@ revision\n2026-03-12 · «algo raro en polea» → polea-rara`);
  assert.deepEqual(r.errores, []);
  const s = readFileSync(join(carpeta, "sesiones/2026/2026-03-12.md"), "utf8");
  assert.ok(s.includes(`<details><summary>Original</summary>\n\n${el[ids[0]].texto}\n\n</details>`));
  assert.match(s, /^fuente: "CONTEXTO\/notas.txt · bloque 1"$/m);
  assert.match(readFileSync(join(carpeta, "ejercicios.md"), "utf8"), /\| polea-rara \| Polea rara \|/);
  assert.match(readFileSync(join(carpeta, "revision.md"), "utf8"), /- \[ \] 2026-03-12 · «algo raro en polea» → polea-rara/);
  const proc = JSON.parse(readFileSync(join(carpeta, ".gymhub/procesados.json"), "utf8"));
  assert.equal(Object.values(proc.elementos)[0].estado, "importado");
  assert.match(guardar(carpeta, 1, "x").errores.join(), /ya está guardado/);
});

test("mismo día: idéntica se omite; distinta va a -2 con duda; nunca se sobrescribe lo editado", async () => {
  contexto("12/03/2026 torso\nbanca 5x80\n");
  let { ids } = lote1();
  guardar(carpeta, 1, `@@@ sesion elementos=${ids[0]}\n${ses("2026-03-12")}`);
  await cerrar(carpeta);
  const ruta = join(carpeta, "sesiones/2026/2026-03-12.md");
  // Otra nota distinta del mismo día
  contexto("12/03/2026 otra vez torso\nbanca 5x85\n", "mas.txt");
  ({ ids } = lote1());
  guardar(carpeta, 1, `@@@ sesion elementos=${ids[0]}\n${ses("2026-03-12", "85 kg")}`);
  assert.ok(existsSync(join(carpeta, "sesiones/2026/2026-03-12-2.md")));
  assert.match(readFileSync(join(carpeta, "revision.md"), "utf8"), /guardada como sesiones\/2026\/2026-03-12-2\.md\. ¿Son la misma\?/);
  await cerrar(carpeta);
  // La persona edita la sesión a mano; luego se reimporta su mismo elemento (procesados borrado)
  writeFileSync(ruta, readFileSync(ruta, "utf8").replace("80 kg", "80 kg (editado)").replace("| 80 kg (editado) |", "| 82.5 kg |"));
  const editado = readFileSync(ruta, "utf8");
  writeFileSync(join(carpeta, ".gymhub/procesados.json"), JSON.stringify({ version: 1, elementos: {} }));
  mkdirSync(join(carpeta, "CONTEXTO"), { recursive: true });
  contexto("12/03/2026 torso\nbanca 5x80\n");
  ({ ids } = lote1());
  guardar(carpeta, 1, `@@@ sesion elementos=${ids[0]}\n${ses("2026-03-12")}`);
  assert.equal(readFileSync(ruta, "utf8"), editado, "lo editado a mano no se toca");
  assert.ok(existsSync(join(carpeta, "sesiones/2026/2026-03-12-3.md")));
});

test("reimportar lo mismo sin editar reemplaza la sesión generada (no crea -2)", async () => {
  contexto("12/03/2026 torso\nbanca 5x80\n");
  let { ids } = lote1();
  guardar(carpeta, 1, `@@@ sesion elementos=${ids[0]}\n${ses("2026-03-12")}`);
  await cerrar(carpeta);
  writeFileSync(join(carpeta, ".gymhub/procesados.json"), JSON.stringify({ version: 1, elementos: {} }));
  contexto("12/03/2026 torso\nbanca 5x80\n");
  ({ ids } = lote1());
  guardar(carpeta, 1, `@@@ sesion elementos=${ids[0]}\n${ses("2026-03-12", "80 kg", "sensacion_pre: 7\n")}`);
  assert.deepEqual(readdirSync(join(carpeta, "sesiones/2026")), ["2026-03-12.md"]);
  assert.match(readFileSync(join(carpeta, "sesiones/2026/2026-03-12.md"), "utf8"), /sensacion_pre: 7/);
});

test("cerrar: mueve a procesado/, resume PRs y dudas y avisa a la web", async () => {
  contexto("01/03/2026 banca 5x80\n\n05/03/2026 banca 5x82\n\n09/03/2026 banca 5x85\n\n10/03/2026 hola qué tal\n");
  const { ids } = lote1();
  const entrada = [ses("2026-03-01"), ses("2026-03-05", "82 kg"), ses("2026-03-09", "85 kg")].map((s, i) => `@@@ sesion elementos=${ids[i]}\n${s}`).join("\n") + `\n@@@ ignorar elementos=${ids[3]} · motivo: saludo`;
  assert.deepEqual(guardar(carpeta, 1, entrada).errores, []);
  const r = await cerrar(carpeta);
  assert.equal(r.sesiones, 3);
  assert.equal(r.prs.length, 1);
  assert.equal(r.mensaje, "Listo · 3 sesiones nuevas · 1 PR · 0 dudas");
  assert.ok(existsSync(join(carpeta, "CONTEXTO/procesado/2026-10-31/notas.txt")));
  assert.ok(!existsSync(join(carpeta, "CONTEXTO/notas.txt")));
  const web = readFileSync(join(carpeta, ".gymhub/web/datos.js"), "utf8");
  assert.match(web, /"mensaje":"Listo · 3 sesiones nuevas · 1 PR · 0 dudas"/);
  assert.match(readFileSync(join(carpeta, "records.md"), "utf8"), /\| Press banca \|/);
});

test("lotes por meses; una importación a medias se reanuda", () => {
  const meses = ["01", "02", "03"].map((m) => `10/${m}/2026 banca 5x80`).join("\n\n");
  contexto(meses);
  const { imp } = preparar(carpeta);
  assert.deepEqual(imp.lotes.map((l) => l.etiqueta), ["2026-01", "2026-02", "2026-03"]);
  guardar(carpeta, 1, `@@@ sesion elementos=${imp.lotes[0].ids[0]}\n${ses("2026-01-10")}`);
  const otra = preparar(carpeta);
  assert.equal(otra.reanudada, true);
  assert.deepEqual(otra.imp.lotes.map((l) => l.estado), ["hecho", "pendiente", "pendiente"]);
});

test("guardar directo: una sesión contada en el chat, con su original", () => {
  const r = guardar(carpeta, "directo", `@@@ sesion\n${ses("2026-10-30")}\n<details><summary>Original</summary>\n\nhoy banca 5x80\n\n</details>`);
  assert.deepEqual(r.errores, []);
  assert.match(readFileSync(join(carpeta, "sesiones/2026/2026-10-30.md"), "utf8"), /hoy banca 5x80/);
  assert.match(guardar(carpeta, "directo", `@@@ sesion\n${ses("2026-10-29")}`).errores.join(), /falta el texto original/);
});

test("guardar --fichero: la entrada desde un fichero de la carpeta (alternativa al heredoc)", () => {
  writeFileSync(join(carpeta, "CONTEXTO", "notas.txt"), "12/03/2026 torso\nbanca 5x80 (I didn't sleep)\n");
  const { imp } = preparar(carpeta);
  mkdirSync(join(carpeta, ".gymhub/entrada"), { recursive: true });
  writeFileSync(join(carpeta, ".gymhub/entrada/lote-1.md"), `@@@ sesion elementos=${imp.lotes[0].ids[0]}\n${ses("2026-03-12")}`);
  const r = cli(t.dir, ["refresh", "guardar", "1", "--fichero", ".gymhub/entrada/lote-1.md"]);
  assert.equal(r.codigo, 0, r.salida + r.error);
  assert.ok(existsSync(join(carpeta, "sesiones/2026/2026-03-12.md")));
  assert.equal(cli(t.dir, ["refresh", "guardar", "1", "--fichero", "../fuera.md"]).codigo, 1);
});
