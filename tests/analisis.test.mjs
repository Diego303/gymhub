// Análisis sobre la persona sintética de 2 años (tests/fixtures/dosanios.mjs): las cifras de
// cada aserción están calculadas a mano en los comentarios.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { cpSync } from "node:fs";
import { join } from "node:path";
import { temporal, cli, RAIZ } from "./ayuda.mjs";
import { contexto } from "../lib/derivar.mjs";
import { construirAnalisis, regresion, agudaCronica, adherencia, loQueDicen, radarFuerza } from "../lib/analisis.mjs";
import { generarDosAnios } from "./fixtures/dosanios.mjs";

let t, dos, poco;
const HOY = "2026-10-31";
before(() => {
  t = temporal();
  dos = join(t.dir, "DOS"); poco = join(t.dir, "POCO");
  cli(t.dir, ["configurar", dos]); cli(t.dir, ["configurar", poco]);
  process.env.GYMHUB_CONFIG = join(t.dir, "config.json");
  generarDosAnios(dos);
  cpSync(join(RAIZ, "tests/fixtures/sesiones"), join(poco, "sesiones"), { recursive: true });
});
after(() => t.limpiar());
let cache = null;
const A = () => (cache ??= construirAnalisis(contexto(dos, { hoy: HOY })));

test("2 años: 208 sesiones y adherencia del 100 % (2 días/semana, 24 de 24 en 12 semanas)", () => {
  const c = contexto(dos, { hoy: HOY });
  assert.equal(c.base.total_sesiones, 208);
  assert.deepEqual(A().adherencia, { valor: 100, hechas: 24, esperadas: 24 });
});

test("radar de fuerza: e1RM de 12 semanas ÷ referencia, normalizado al más fuerte", () => {
  // banca 111,5×7/6 = 130 /1,0 = 130 (el más fuerte) · militar 65,75×7/6 = 76,71 /0,62 = 123,7 → 95
  // remo 50×(1+8/30) = 63,33 /0,8 = 79,2 → 61 · dominadas (80+10)×7/6 = 105 /0,85 = 123,5 → 95
  // peso muerto 140×7/6 = 163,3 /1,55 = 105,4 → 81 · sentadilla 131,5×7/6 = 153,4 /1,3 = 118,0 → 91
  assert.deepEqual(A().radar.fuerza.ahora, { "empuje-horizontal": 100, "empuje-vertical": 95, "tiron-horizontal": 61, "tiron-vertical": 95, cadera: 81, rodilla: 91 });
  assert.deepEqual(A().radar.fuerza.flojo, { patron: "tiron-horizontal", nombre: "Tirón horiz.", valor: 61 });
  assert.deepEqual(A().ejes.map((e) => e.patron), ["empuje-horizontal", "empuje-vertical", "tiron-vertical", "tiron-horizontal", "cadera", "rodilla"]);
});

test("radar de volumen: 3 series por patrón y semana; el peso muerto, 1 → 33", () => {
  assert.deepEqual(A().radar.volumen.ahora, { "empuje-horizontal": 100, "empuje-vertical": 100, "tiron-horizontal": 100, "tiron-vertical": 100, cadera: 33, rodilla: 100 });
});

test("ratios: empuje:tirón 6/6 = 1, cuádriceps:femoral 3/4 = 0,75, banca:remo 130/63,33 = 2,05", () => {
  const [et, cf, br] = A().ratios;
  assert.equal(et.valor, 1); assert.equal(et.estado, "ok");
  assert.equal(cf.valor, 0.75); assert.equal(cf.estado, "bajo"); assert.equal(cf.texto, "cuádriceps corto");
  assert.equal(br.valor, 2.05); assert.equal(br.estado, "alto"); assert.equal(br.texto, "remo corto frente a la banca");
});

test("aguda:crónica: T(w) = 7150 + 18,75·w kg/semana → 9081,25 ÷ (36212,5 ÷ 4) = 1,00", () => {
  assert.equal(A().aguda_cronica.valor, 1);
  assert.equal(A().aguda_cronica.estado, "ok");
});

test("predicción: regresión exacta de las progresiones lineales", () => {
  const p = Object.fromEntries(A().prediccion.map((x) => [x.id, x]));
  // sentadilla: pendiente 0,5×7/6 = 0,58 kg/sem; hoy ≈ 153,83 → faltan 16,17/0,583 = 27,7 sem = 194 días → 13 may 2027
  assert.equal(p.sentadilla.pendiente, 0.58); assert.equal(p.sentadilla.fecha, "2027-05-13"); assert.equal(p.sentadilla.texto, "~may 27");
  // banca: 9,5/0,583 = 16,3 sem = 114 días → 22 feb 2027
  assert.equal(p["press-banca"].fecha, "2027-02-22"); assert.equal(p["press-banca"].texto, "~feb 27");
  // militar: pendiente 0,25×7/6 = 0,29; 3,08/0,29 = 10,6 sem = 74 días → 13 ene 2027
  assert.equal(p["press-militar"].pendiente, 0.29); assert.equal(p["press-militar"].fecha, "2027-01-13");
  // peso muerto: siempre 140 kg → pendiente 0 < 0,2
  assert.equal(p["peso-muerto"].estado, "estancado");
  assert.equal(p.sentadilla.n, 12);
});

test("estancados: los cuatro ejercicios con carga fija, desde su primera sesión (103 semanas)", () => {
  assert.deepEqual(A().estancados.map((e) => [e.id, e.semanas]), [["remo-barra", 103], ["peso-muerto", 103], ["dominadas", 103], ["curl-femoral", 103]]);
});

test("disposición: sin sueño reciente (el jueves fue hace 2 días) → RPE 8 (50) y pre 7 (70) → 60", () => {
  assert.deepEqual(A().disposicion, { valor: 60, estado: "medio", componentes: ["RPE 7 días 8", "sensación 7"], excluidos: ["sueño"] });
});

test("lo que dicen tus datos: con n ≥ 30 aparecen sueño y hora (lunes frente a jueves)", () => {
  const d = A().datos;
  assert.equal(d.n, 202); // desde la 4.ª semana, cada sesión tiene ejercicios con 3 sesiones previas
  assert.deepEqual(d.hallazgos.map((h) => h.factor).sort(), ["hora", "sueño"]);
  assert.match(d.hallazgos.find((h) => h.factor === "sueño").texto, /^Con ≥ 7 h de sueño tu e1RM rinde \+/);
});

test("n/d con pocos datos (4 sesiones): A:C, adherencia, predicción y «lo que dicen»", () => {
  const c = contexto(poco, { hoy: HOY });
  assert.deepEqual(agudaCronica(c.base), { valor: null, motivo: "hacen falta 4 semanas de datos" });
  assert.equal(adherencia(c.base, 4).valor, null);
  const d = loQueDicen(c.base);
  assert.deepEqual(d.hallazgos, []);
  assert.match(d.motivo, /hacen falta 30 sesiones comparables/);
  const a = construirAnalisis(c);
  assert.equal(a.prediccion.length, 0, "sin objetivos en FICHA.md");
  const r = radarFuerza(c.base, c.ficha.referencias);
  assert.equal(r["empuje-vertical"], null, "sin press militar: n/d en ese eje");
  // sin remo con barra, el tirón horizontal usa su ejercicio más frecuente: remo con mancuerna (40 de e1RM)
  assert.equal(a.ratios[2].valor, 2.48); // 99,17 / 40
  assert.equal(a.ratios[2].estado, "alto");
  assert.equal(a.disposicion.valor !== null, true);
});

test("regresión lineal", () => {
  const r = regresion([[0, 1], [1, 3], [2, 5]]);
  assert.equal(r.pendiente, 2); assert.equal(r.ordenada, 1);
});
