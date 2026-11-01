// G2 · Métricas de las 6 vistas con valores calculados a mano sobre el fixture «mini»
// (tests/fixtures/mini.mjs). Epley: e1RM = kg × (1 + reps/30). Cada cuenta va en su comentario.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { contexto } from "../lib/derivar.mjs";
import { construirDatos } from "../lib/vistas.mjs";
import { VISTAS_WEB } from "../lib/derivar.mjs";
import { generarMini, HOY } from "./fixtures/mini.mjs";
import { RAIZ, temporal } from "./ayuda.mjs";

const r1 = (x) => Math.round(x * 10) / 10;
let t, D, C;
before(() => {
  t = temporal();
  process.env.GYMHUB_CONFIG = join(t.dir, "config.json"); // config por defecto: semana de lunes
  generarMini(t.dir, { catalogo: readFileSync(join(RAIZ, "templates/GIMNASIO/ejercicios.md"), "utf8") });
  C = contexto(t.dir, { hoy: HOY });
  D = construirDatos(C, VISTAS_WEB);
});
after(() => { delete process.env.GYMHUB_CONFIG; t.limpiar(); });

test("base: 11 sesiones válidas, toneladas y PRs (con ≥ 2 sesiones previas)", () => {
  assert.deepEqual(C.conErrores, []);
  assert.equal(D.resumen.sesiones_total, 11);
  // W42 3.300 + W43 4.785 + W44 4.987,5 + W45 5.040 = 18.112,5 kg
  assert.equal(r1(C.base.toneladas_total * 1000), 18112.5);
  // Banca: PR el 19, 23, 26 y 30 de octubre y el 2 de noviembre (las dos primeras sesiones no pueden serlo).
  // Sentadilla: 28 oct y 4 nov. Remo: el 2 nov iguala (76) y no es PR. Dominadas: una sola sesión.
  assert.deepEqual(C.base.prs.map((p) => `${p.fecha} ${p.id}`), ["2026-10-19 press-banca", "2026-10-23 press-banca", "2026-10-26 press-banca", "2026-10-28 sentadilla", "2026-10-30 press-banca", "2026-11-02 press-banca", "2026-11-04 sentadilla"]);
  // El calentamiento a 40 kg no cuenta: la sesión del 2 nov son 80×5×3 + 60×8×3 = 1.200 + 1.440
  assert.equal(C.base.sesiones.find((s) => s.fecha === "2026-11-02").toneladas_kg, 2640);
});

test("Panel: racha, sesiones, volumen frente a la semana anterior y PRs del mes", () => {
  const k = D.panel.kpis;
  assert.deepEqual(k.racha, { dias: 11, mejor: 11 }); // ningún hueco de 4 días o más
  assert.deepEqual(k.sesiones, { hechas: 2, objetivo: 3, pct: 67 });
  // Semana: 2.640 + (1.500 + PC+10 = 90 kg × 5 × 2 = 900) = 5.040 kg. Anterior hasta el jueves: 26 oct (1.162,5 + 1.440) + 28 oct (1.425) = 4.027,5
  // Δ = 5,04 / 4,0275 − 1 = +25,1 %
  assert.deepEqual(k.volumen, { t: 5, texto: "5", delta_pct: 25 });
  assert.deepEqual(k.prs_mes, { n: 2, ultimo: "sentadilla" });
  assert.deepEqual(D.panel.cabecera.semana, 45);
});

test("Panel: progresión, objetivos y series por grupo con ▲ pasado el miércoles", () => {
  const p = D.panel.progresion;
  // El principal más reciente es la sentadilla (4 nov). Mejor e1RM por semana: 87,5·7/6 = 102,1 · 105 · 110,8 · 116,7
  assert.equal(p.id, "sentadilla");
  assert.deepEqual(p.puntos.map((x) => x.e1rm), [102.1, 105, 110.8, 116.7]);
  assert.equal(p.delta, 14.6);
  assert.equal(p.semanas, 3);
  assert.equal(p.objetivo, 130);
  // Mejor e1RM de 8 semanas: banca 80·(1+5/30) = 93,3 de 100 → 93 %; sentadilla 116,7 de 130 → 90 %
  assert.deepEqual(D.panel.objetivos.map((o) => [o.id, o.actual, o.objetivo, o.pct]), [["press-banca", 93.3, 100, 93], ["sentadilla", 116.7, 130, 90]]);
  // Series (1 en el grupo principal, 0,5 en cada secundario): pecho 3 (banca) · pierna = cuádriceps 3 + glúteo 1,5 = 4,5
  // · espalda = dorsal (remo 1,5 + dominadas 2) + espalda alta (remo 3 + dominadas 1) = 7,5
  assert.deepEqual(D.panel.grupos.map((g) => [g.clave, g.series, g.objetivo, g.pct, g.estado, g.aviso]), [
    ["pecho", 3, 10, 30, "bajo", true], ["pierna", 4.5, 12, 38, "bajo", true], ["espalda", 7.5, 9, 83, "medio", false]]);
  assert.equal(D.panel.grupos_nota, "Pecho va corto: faltan 7 series");
});

test("Panel: esta semana, sensaciones de 7 días, rutina por rotación y Rex", () => {
  assert.deepEqual(D.panel.semana.map((d) => [d.letra, d.texto, d.estado]), [["L", "tor", "hecho"], ["M", "—", "descanso"], ["X", "pie", "hecho"], ["J", "tor", "hoy"], ["V", "", "futuro"], ["S", "", "futuro"], ["D", "", "futuro"]]);
  // RPE de trabajo de 7 días: banca 8×3, remo 7×3, sentadilla 8×3 → 69/9 = 7,67; sueño (7 + 6,5)/2 = 6 h 45 min
  assert.deepEqual(D.panel.sensaciones, { rpe: 7.7, rpe_pct: 77, sueno: "6h 45m", n: 3, molestias: [{ zona: "hombro izq.", estado: "molestia" }] });
  // Después de pierna, lo que más veces viene es torso (3 de 3)
  assert.equal(D.panel.rutina.origen, "rotacion");
  assert.equal(D.panel.rutina.titulo, "Torso");
  assert.equal(D.panel.rex.estado, "pr");
  assert.equal(D.panel.rex.bocadillo, "¡PR en sentadilla!");
  assert.equal(D.panel.descarga, null);
});

test("Progreso: mapa muscular de la semana, récords, bloque e historial", () => {
  const m = D.progreso.mapa;
  assert.equal(m.grupos.pecho.series, 3);
  assert.equal(m.grupos["espalda-alta"].series, 4); // remo 3 + dominadas 2 × 0,5
  assert.equal(m.grupos["espalda-alta"].nivel, 1); // 4–7 series
  assert.deepEqual(m.mas, { grupo: "espalda-alta", nombre: "Espalda alta", series: 4 });
  assert.deepEqual(m.olvidados.map((x) => x.grupo), ["femoral", "aductor", "gemelo"]);
  assert.deepEqual(D.progreso.records.map((r) => [r.id, r.valor, r.serie, r.fecha, r.nuevo]), [
    ["press-banca", "93,3 kg", "80 kg × 5", "2026-11-02", true], ["sentadilla", "116,7 kg", "100 kg × 5", "2026-11-04", true],
    ["remo-barra", "76 kg", "60 kg × 8", "2026-10-26", false], ["dominadas", "105 kg", "PC+10 kg × 5", "2026-11-04", true]]);
  assert.equal(D.progreso.prs_mes, 2);
  assert.equal(D.progreso.prs_anio, 7);
  const b = D.progreso.bloque.semanas;
  assert.deepEqual(b.map((w) => w.toneladas), [0, 0, 3.3, 4.8, 5, 5]);
  assert.deepEqual(b.map((w) => w.volumen_pct), [0, 0, 66, 96, 100, 100]);
  // Intensidad de la W42: banca 72,5/85 y 75/85 (e1RM vigente 85), sentadilla 87,5/102,08 → media 86,4 %
  assert.equal(b[2].intensidad, 86);
  assert.deepEqual([D.progreso.historial.sesiones, D.progreso.historial.toneladas, D.progreso.historial.desde], [11, 18, "oct 2026"]);
});

test("Análisis: radar de volumen y de fuerza, ratios, carga, disposición y n/d con pocos datos", () => {
  const A = D.analisis;
  // Series de 4 semanas por patrón: banca 21, remo 9, sentadilla 12, dominadas 2 → normalizadas a 21
  assert.deepEqual(A.radar.volumen.ahora, { "empuje-horizontal": 100, "empuje-vertical": 0, "tiron-horizontal": 43, "tiron-vertical": 10, cadera: 0, rodilla: 57 });
  // Fuerza: e1RM ÷ referencia: banca 93,3/1 · remo 76/0,8 = 95 · sentadilla 116,7/1,3 = 89,7 · dominadas 105/0,85 = 123,5 (= 100)
  assert.deepEqual(A.radar.fuerza.ahora, { "empuje-horizontal": 76, "empuje-vertical": null, "tiron-horizontal": 77, "tiron-vertical": 100, cadera: null, rodilla: 73 });
  assert.equal(A.radar.fuerza.flojo.patron, "rodilla");
  assert.equal(A.radar.fuerza.antes, null, "hace 12 semanas no había datos");
  // Empuje 21 : tirón (9 + 2) = 1,91 → alto; sin femoral → n/d; banca 93,3 : remo 76 = 1,23 → en rango
  assert.deepEqual(A.ratios.map((r) => [r.valor, r.estado]), [[1.91, "alto"], [null, "n/d"], [1.23, "ok"]]);
  assert.equal(A.aguda_cronica.valor, null); // 24 días de datos
  // Disposición: sueño 6,5/8 = 81,25 (40 %) + RPE (10 − 7,67) × 25 = 58,3 (30 %) + sensación 7 → 70 (30 %) = 71
  assert.equal(A.disposicion.valor, 71);
  assert.deepEqual(A.prediccion.map((p) => [p.id, p.estado, p.texto]), [["press-banca", "n/d", "pocos datos (4 de 6 semanas)"], ["sentadilla", "n/d", "pocos datos (4 de 6 semanas)"]]);
  assert.deepEqual(A.estancados, []);
  assert.match(A.datos.motivo, /hacen falta 30 sesiones comparables \(hay 5\)/);
  assert.equal(A.adherencia.valor, null);
});

test("Diario: molestias por semana, sensaciones y línea de tiempo con primeras veces", () => {
  const d = D.diario;
  assert.deepEqual(d.molestias.filas.map((f) => [f.zona, f.celdas.filter(Boolean), f.celdas.indexOf("molestia"), f.repite]), [["hombro izq.", ["molestia"], 11, 0]]);
  assert.equal(d.sensaciones.sueno_medio, "6h 45m");
  assert.equal(d.sensaciones.semanas.at(-1).pre, 7);
  // 11 sesiones + 3 primeras veces (sentadilla, remo y dominadas; la banca es de la primera sesión)
  assert.equal(d.linea.length, 14);
  assert.deepEqual(d.linea.filter((e) => e.t === "h").map((e) => e.texto), ["Primera vez: dominadas", "Primera vez: remo con barra", "Primera vez: sentadilla"]);
  assert.equal(d.linea[0].fecha, "2026-11-04");
  const s2 = d.linea.find((e) => e.fecha === "2026-11-02");
  assert.equal(s2.frase, "Banca muy sólida hoy.");
  assert.deepEqual(s2.prs, ["press banca 80 kg × 5"]);
});

test("Ejercicios: lista (≥ 3 sesiones), KPIs, mejor peso por repeticiones y últimas sesiones", () => {
  const E = D.ejercicios;
  assert.deepEqual(E.lista.map((e) => [e.id, e.sesiones, e.texto_actual]), [["press-banca", 7, "93,3 kg"], ["sentadilla", 4, "116,7 kg"], ["remo-barra", 3, "76 kg"]]);
  const f = E.fichas["press-banca"];
  assert.equal(f.kpis.actual.valor, 93.3);
  assert.deepEqual([f.kpis.marca.kg, f.kpis.marca.texto, f.kpis.marca.fecha], [80, "80 kg × 4", "2026-10-30"]); // la primera vez con 80 kg
  assert.equal(f.kpis.var12, null);
  assert.equal(f.kpis.frecuencia, 7); // 7 sesiones en menos de un mes
  assert.equal(f.kpis.prs, 5);
  assert.deepEqual([f.n_sesiones, f.n_series], [7, 21]); // solo series de trabajo
  // A 1–4 reps o más: 80 kg (30 oct, ×4); a 5: 80 kg (2 nov); a 6, 8 y 10: nada
  assert.deepEqual(f.tabla.map((x) => [x.reps, x.kg, x.fecha ?? null]), [[1, 80, "2026-10-30"], [2, 80, "2026-10-30"], [3, 80, "2026-10-30"], [4, 80, "2026-10-30"], [5, 80, "2026-11-02"], [6, null, null], [8, null, null], [10, null, null]]);
  assert.deepEqual(f.ultimas.slice(0, 2).map((s) => [s.fecha, s.mejor, s.valor, s.pr]), [["2026-11-02", "80 kg × 5", 93.3, true], ["2026-10-30", "80 kg × 4", 90.7, true]]);
});

test("Semana: KPIs frente a la anterior y a la media de 4, estado, racha, grupos y resumen del mes", () => {
  const S = D.semana;
  assert.equal(S.defecto, "2026-W45");
  const w = S.semanas.find((x) => x.clave === "2026-W45");
  assert.equal(w.estado, "en_curso");
  assert.equal(w.racha, 3); // W42, W43 y W44 cumplidas; la que está en curso no la rompe
  // Toneladas 5,04 frente a 4,9875 (+1 %) y a la media (3,3 + 4,785 + 4,9875)/3 = 4,3575 (+16 %)
  assert.deepEqual([w.kpis.toneladas.valor, w.kpis.toneladas.delta_anterior, w.kpis.toneladas.media4, w.kpis.toneladas.delta_media4], [5, 1, 4.4, 16]);
  // Series 11 frente a 12 (−8 %) y a la media 11 (0 %); sesiones 2 frente a 3 (−33 %)
  assert.deepEqual([w.kpis.series.valor, w.kpis.series.delta_anterior, w.kpis.series.delta_media4], [11, -8, 0]);
  assert.deepEqual([w.kpis.sesiones.valor, w.kpis.sesiones.delta_anterior], [2, -33]);
  // PRs 2 frente a 3 (−33 %) y a la media (0 + 2 + 3)/3 (+20 %)
  assert.deepEqual([w.kpis.prs.valor, w.kpis.prs.delta_anterior, w.kpis.prs.delta_media4], [2, -33, 20]);
  // Intensidad: (banca 80/93,3 ×3 + sentadilla 100/116,7 ×3 + dominadas 90/105 ×2 = 85,71 %) y remo 60/76 = 78,95 % ×3 → 83,9 %
  assert.equal(w.kpis.intensidad.valor, 83.9);
  assert.equal(w.kpis.intensidad.delta_anterior, -1); // W44: 84,6 %
  // Grupos frente a la media de W42–W44: pecho 3 de 6 y hombro 1,5 de 3 por debajo del 70 %
  assert.deepEqual(w.grupos.map((g) => [g.clave, g.series, g.media4, g.aviso]), [["pecho", 3, 6, true], ["espalda", 7.5, 3, false], ["pierna", 4.5, 4.5, false], ["hombro", 1.5, 3, true], ["brazos", 4, 4, false], ["core", 0, 0, false]]);
  assert.equal(w.mes.titulo, "Resumen de noviembre (en curso)");
  assert.deepEqual([w.mes.hasta.sesiones, w.mes.hasta.toneladas, w.mes.hasta.prs, w.mes.hasta.cumplidas, w.mes.hasta.semanas], [2, 5, 2, 0, 0]);
  assert.deepEqual([w.mes.anterior.nombre, w.mes.anterior.sesiones, w.mes.anterior.toneladas, w.mes.anterior.prs, w.mes.anterior.cumplidas, w.mes.anterior.semanas], ["oct", 9, 13.1, 5, 3, 3]);
  assert.deepEqual(S.semanas.map((x) => [x.clave, x.estado]), [["2026-W42", "cumplida"], ["2026-W43", "cumplida"], ["2026-W44", "cumplida"], ["2026-W45", "en_curso"]]);
});
