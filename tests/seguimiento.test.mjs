import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { cpSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { temporal, cli, RAIZ } from "./ayuda.mjs";
import { contexto } from "../lib/derivar.mjs";
import { semanaPedida, resumenSemana, textoSemana, buscarEjercicio, dudasPendientes } from "../lib/seguimiento.mjs";
import { calentamiento, empezarEntreno, apuntarSerie, terminarEntreno } from "../lib/vivo.mjs";
import { construirPanel } from "../lib/panel.mjs";
import { preparar } from "../lib/refresh.mjs";

let t, carpeta;
const env = { GYMHUB_HOY: "2026-10-31", GYMHUB_NO_AVISO: "1" };
before(() => {
  t = temporal();
  carpeta = join(t.dir, "G");
  cli(t.dir, ["configurar", carpeta]);
  process.env.GYMHUB_CONFIG = join(t.dir, "config.json");
  Object.assign(process.env, env);
  cpSync(join(RAIZ, "tests/fixtures/sesiones"), join(carpeta, "sesiones"), { recursive: true });
});
after(() => { t.limpiar(); for (const k of Object.keys(env)) delete process.env[k]; });
const c = () => contexto(carpeta, { hoy: "2026-10-31" });

test("semana: la pedida, la anterior y su borrador con las cifras del script", () => {
  assert.equal(semanaPedida(c(), undefined), "2026-10-26");
  assert.equal(semanaPedida(c(), "anterior"), "2026-10-19");
  assert.equal(semanaPedida(c(), "2026-W43"), "2026-10-19");
  const r = resumenSemana(c(), "2026-10-26");
  assert.equal(r.clave, "2026-W44");
  const txt = textoSemana(c(), r);
  assert.match(txt, /^# Semana 2026-W44 \(26 oct – 1 nov\)/);
  assert.match(txt, /- Sesiones: 3 de 4 · lun Torso pesado · mié Pierna y tirón · vie Banca/);
  assert.match(txt, /- Series de trabajo: 13 · volumen 4,7 t \(\+1143 % frente a la semana anterior\)/);
  assert.match(txt, /- PRs: press banca 85 kg × 5 \(30 oct\)/);
  assert.match(txt, /RPE medio 8,2 · sueño medio 6h 45m/);
  assert.match(txt, /- Molestias: hombro izq\. \(molestia → bien\)/);
  assert.match(txt, /## Qué ajustar/);
  const out = cli(t.dir, ["semana"], { env });
  assert.match(out.salida, /^FICHERO: semanas\/2026-W44\.md/);
});

test("ejercicio: por alias, sin historial o con candidatos; deja el Panel y la web en ese ejercicio", () => {
  assert.deepEqual(buscarEjercicio(c(), "banca"), { id: "press-banca" });
  // «remo» es alias del remo con barra, pero esta persona solo hace remo con mancuerna: se queda con ese
  assert.deepEqual(buscarEjercicio(c(), "remo"), { id: "remo-mancuerna" });
  assert.deepEqual(buscarEjercicio(c(), "front squat"), { id: "sentadilla-frontal", sinHistorial: true });
  assert.match(cli(t.dir, ["ejercicio", "front squat"], { env }).salida, /no tienes sesiones/);
  const r = cli(t.dir, ["ejercicio", "bench"], { env });
  assert.equal(r.codigo, 0, r.salida + r.error);
  assert.match(r.salida, /^Press banca \(press-banca\)/);
  assert.match(r.salida, /e1RM actual: 99,2 kg \(30 oct\)/);
  assert.equal(JSON.parse(readFileSync(join(carpeta, ".gymhub/panel.json"), "utf8")).ejercicio, "press-banca");
  assert.match(readFileSync(join(carpeta, ".gymhub/web/datos.js"), "utf8"), /"navegar":\{"id":\d+,"vista":"ejercicios","filtro":"press-banca"/);
  assert.equal(cli(t.dir, ["ejercicio", "algo raro"], { env }).codigo, 3);
});

test("revisión: lista numerada y marcar resuelta", () => {
  writeFileSync(join(carpeta, "revision.md"), "# Dudas\n- [ ] 2026-10-26 · ¿remo por mano? → kg/mano\n- [x] ya hecha\n- [ ] 2026-10-28 · ¿jalón nivel 7?\n");
  assert.deepEqual(dudasPendientes(readFileSync(join(carpeta, "revision.md"), "utf8")).map((d) => d.n), [1, 2]);
  const l = cli(t.dir, ["revision"], { env });
  assert.match(l.salida, /1\. 2026-10-26 · ¿remo por mano\? → kg\/mano  \[sesiones\/2026\/2026-10-26\.md\]/);
  assert.match(cli(t.dir, ["revision", "marcar", "1", "--nota", "confirmado"], { env }).salida, /Quedan 1/);
  assert.match(readFileSync(join(carpeta, "revision.md"), "utf8"), /- \[x\] 2026-10-26 · ¿remo por mano\? → kg\/mano · resuelto 2026-10-31: confirmado/);
});

test("corregir: valida, conserva el original, guarda copia y la protege", () => {
  const ruta = "sesiones/2026/2026-10-26.md";
  const antes = readFileSync(join(carpeta, ruta), "utf8");
  writeFileSync(join(carpeta, ".gymhub/generadas.json"), JSON.stringify({ [ruta]: { hash: "x" } }));
  assert.equal(cli(t.dir, ["corregir", ruta], { entrada: antes.replace("30 kg/mano", "treinta"), env }).codigo, 2);
  const sinOriginal = antes.replace(/<details>[\s\S]*<\/details>\n/, "").replace("30 kg/mano", "32.5 kg/mano");
  const r = cli(t.dir, ["corregir", ruta], { entrada: sinOriginal, env });
  assert.equal(r.codigo, 0, r.salida);
  const despues = readFileSync(join(carpeta, ruta), "utf8");
  assert.match(despues, /32\.5 kg\/mano/);
  assert.match(despues, /<summary>Original<\/summary>\n\n26\/10 torso: banca/);
  assert.deepEqual(JSON.parse(readFileSync(join(carpeta, ".gymhub/generadas.json"), "utf8")), {});
  writeFileSync(join(carpeta, ruta), antes);
});

test("discos: por lado y la calculadora de la web en ese valor", () => {
  assert.match(cli(t.dir, ["discos", "142,5"], { env }).salida, /142,5 kg con barra de 20 kg: por lado: 25 \+ 25 \+ 10 \+ 1,25/);
  assert.equal(JSON.parse(readFileSync(join(carpeta, ".gymhub/discos.json"), "utf8")).kg, 142.5);
  assert.match(cli(t.dir, ["discos", "15"], { env }).salida, /no llega a la barra/);
});

test("calentamiento: barra × 10, 50 % × 5, 70 % × 3 y 85 % × 1, a disco disponible", () => {
  assert.deepEqual(calentamiento(120).map((p) => [p.kg, p.reps, p.discos]), [[20, 10, []], [60, 5, [20]], [85, 3, [25, 5, 2.5]], [102.5, 1, [25, 15, 1.25]]]);
  assert.deepEqual(calentamiento(20), []);
});

test("en vivo: entreno → series (casillas, descanso, Rex) → fin → /refresh lo recoge", () => {
  writeFileSync(join(carpeta, "plantillas/pierna.md"), "---\nnombre: Pierna A\ntipo: pierna\ndia: sábado\n---\n- Sentadilla · 3×5 · 120 kg · 3 min\n- Prensa · 2×12\n");
  writeFileSync(join(carpeta, "FICHA.md"), readFileSync(join(carpeta, "FICHA.md"), "utf8").replace("- (ninguna)", "- Rodilla: prehab antes de pierna"));
  const e = empezarEntreno(carpeta, { plantilla: "pierna" });
  assert.equal(e.rutina.titulo, "Pierna A");
  assert.equal(e.calentamiento.peso, 120);
  assert.deepEqual(e.prehab, [{ zona: "rodilla", texto: "prehab antes de pierna" }]);
  const s = apuntarSerie(carpeta, { texto: "sentadilla 5x120 @8", ejercicio: "squat" });
  assert.equal(s.e.hechas, 1);
  assert.equal(s.descanso, 180, "el descanso de la plantilla (3 min)");
  const p = construirPanel(c(), {});
  assert.equal(p.rutina.origen, "vivo");
  assert.deepEqual(p.rutina.ejercicios.map((x) => [x.nombre, x.hechas, x.total]), [["Sentadilla", 1, 3], ["Prensa de piernas", 0, 2]]);
  assert.equal(p.rex.estado, "descansando");
  assert.equal(p.rex.detalle, "serie 1 de 3 · sentadilla");
  assert.equal(p.rex.descanso.segundos, 180);
  const f = join(carpeta, "CONTEXTO/2026-10-31-en-vivo.md");
  assert.match(readFileSync(f, "utf8"), /^# 2026-10-31 · entreno en vivo \(gymhub\)\nrutina: Pierna A\n\d\d:\d\d sentadilla 5x120 @8\n$/);
  terminarEntreno(carpeta, { post: 8, notas: "buena sesión" });
  assert.match(readFileSync(f, "utf8"), /fin del entreno · sensación post: 8 · notas: buena sesión\n$/);
  assert.equal(construirPanel(c(), {}).rutina.origen !== "vivo", true);
  const { imp } = preparar(carpeta);
  const el = Object.values(imp.elementos);
  assert.equal(el.length, 1);
  assert.equal(el[0].fecha_pista, "2026-10-31");
  assert.match(el[0].texto, /sentadilla 5x120 @8[\s\S]*sensación post: 8/);
  assert.equal(existsSync(f), true);
});

test("serie desde la línea de órdenes, con «--»", () => {
  const r = cli(t.dir, ["serie", "--ejercicio", "prensa", "--", "prensa", "12x200", "--", "dura"], { env });
  assert.equal(r.codigo, 0, r.salida + r.error);
  assert.match(r.salida, /Apuntado: «prensa 12x200 -- dura» · Prensa de piernas/);
});
