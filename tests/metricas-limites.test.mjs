// G2 · Métricas en los límites: 0 kg, asistidas por encima del peso corporal, objetivos a 0, ningún
// NaN ni Infinity, tendencias con 0, 1 y 2 puntos, y formato de horas.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { calcularBase } from "../lib/base.mjs";
import { leerFicha } from "../lib/ficha.mjs";
import { construirAnalisis } from "../lib/analisis.mjs";
import { CAT, CAB, ses, noFinitos } from "./fixtures/ayuda-metricas.mjs";
import { RAIZ } from "./ayuda.mjs";

test("un ejercicio a «0 kg» no rompe la vista Análisis y no cuenta como escala de kg", () => {
  const sesiones = ["2026-09-01", "2026-09-08", "2026-09-15", "2026-09-22", "2026-10-20"].map((f) => ses(f, ["trabajo | 0 kg | 10 | | | "]));
  const ficha = leerFicha("");
  const base = calcularBase(sesiones, { catalogo: CAT, hoy: "2026-10-31", ficha });
  assert.equal(base.porEjercicio.get("curl-barra").escala, "reps");
  const A = construirAnalisis({ base, ficha, config: {}, catalogo: CAT });
  assert.deepEqual(A.estancados, []);
  // Una asistida con más ayuda que el peso corporal (PC−90 con 80 kg) tampoco es «kg»
  const asist = calcularBase([ses("2026-10-01", ["trabajo | PC-90 kg | 8 | | | "], { id: "dominadas", fm: "peso_corporal_kg: 80\n" })], { catalogo: CAT, hoy: "2026-10-31", ficha });
  assert.equal(asist.porEjercicio.get("dominadas").escala, "lastre");
  assert.equal(asist.sesiones[0].toneladas_kg, 0);
});

test("las horas se redondean al minuto sin dar «7h 60m»", async () => {
  const { horasMinutos } = await import("../lib/panel.mjs");
  assert.equal(horasMinutos(7.995), "8h 00m");
  assert.equal(horasMinutos(6.75), "6h 45m");
  assert.equal(horasMinutos(0.004), "0h 00m");
  assert.equal(horasMinutos(null), null);
});

test("ninguna vista da NaN ni Infinity ni errores: vacío, una sesión, «mini» y una FICHA con ceros", async () => {
  const { temporal } = await import("./ayuda.mjs");
  const { writeFileSync, mkdirSync } = await import("node:fs");
  const { contexto, VISTAS_WEB } = await import("../lib/derivar.mjs");
  const { construirDatos } = await import("../lib/vistas.mjs");
  const { generarMini, HOY } = await import("./fixtures/mini.mjs");
  const catalogo = readFileSync(join(RAIZ, "templates/GIMNASIO/ejercicios.md"), "utf8");
  const casos = {
    vacio: (d) => { writeFileSync(join(d, "FICHA.md"), "# Ficha\n"); writeFileSync(join(d, "ejercicios.md"), catalogo); mkdirSync(join(d, "sesiones")); },
    una: (d) => { casos.vacio(d); mkdirSync(join(d, "sesiones", "2026")); writeFileSync(join(d, "sesiones", "2026", "2026-11-05.md"), "---\nfecha: 2026-11-05\nconfianza: alta\n---\n## Ejercicios\n### Banca\n<!-- id: press-banca -->\n" + CAB + "\n| 1 | trabajo | 60 kg | 5 | 8 | | |\n"); },
    mini: (d) => generarMini(d, { catalogo }),
    ceros: (d) => { generarMini(d, { catalogo }); writeFileSync(join(d, "FICHA.md"), "# Ficha\n## Objetivos\n- dias_semana: 0\n- press-banca: 0 kg\n## Series objetivo por semana\npecho 0 · pierna 0\n## Datos\n- peso_corporal: 0 kg\n- sueno_objetivo: 0 h\n## Referencias de fuerza\nbanca 0 · sentadilla 0\n## Rangos de equilibrio\nempuje:tiron 0–0\n"); },
  };
  for (const [nombre, preparar] of Object.entries(casos)) {
    const t = temporal();
    try {
      process.env.GYMHUB_CONFIG = join(t.dir, "config.json");
      preparar(t.dir);
      const datos = construirDatos(contexto(t.dir, { hoy: HOY }), VISTAS_WEB);
      assert.deepEqual(noFinitos(datos), [], nombre);
      for (const [v] of VISTAS_WEB) assert.equal(datos[v]?.error, undefined, `${nombre}: ${v}: ${datos[v]?.error}`);
      if (nombre === "ceros") assert.deepEqual(datos.panel.objetivos, [], "un objetivo de 0 kg no es un objetivo");
    } finally { delete process.env.GYMHUB_CONFIG; t.limpiar(); }
  }
});

test("no hay PR falso por cambiar de unidad: 220,46 lb son 100 kg; 225 lb sí es PR", () => {
  const b = calcularBase([
    ses("2026-10-01", ["trabajo | 100 kg | 5 | | | "], { id: "press-banca" }), ses("2026-10-03", ["trabajo | 100 kg | 5 | | | "], { id: "press-banca" }),
    ses("2026-10-05", ["trabajo | 100 kg | 5 | | | "], { id: "press-banca" }), ses("2026-10-07", ["trabajo | 220.46 lb | 5 | | | "], { id: "press-banca" }),
    ses("2026-10-09", ["trabajo | 225 lb | 5 | | | "], { id: "press-banca" }),
  ], { catalogo: CAT, hoy: "2026-10-10", ficha: leerFicha("") });
  // 220,46 × 0,4536 = 99,9999 kg (no supera 100); 225 × 0,4536 = 102,06 kg
  assert.deepEqual(b.prs.map((p) => p.fecha), ["2026-10-09"]);
});

test("bloque: una semana de descarga (volumen < 70 % e intensidad < 72 %) se marca; la actual nunca", async () => {
  const { bloque } = await import("../lib/progreso.mjs");
  const fechas = { "2026-10-05": 100, "2026-10-12": 100, "2026-10-19": 60, "2026-10-26": 100 };
  const sesiones = Object.entries(fechas).map(([f, kg]) => ses(f, Array(kg === 60 ? 2 : 5).fill(`trabajo | ${kg} kg | 5 | | | `), { id: "sentadilla" }));
  const base = calcularBase(sesiones, { catalogo: CAT, hoy: "2026-10-27", ficha: leerFicha("") });
  const b = bloque({ base, config: {} });
  // e1RM vigente 116,7: 100 kg es el 85,7 %; la semana del 19, 60 kg (51,4 %) y 2 × 5 × 60 = 600 kg frente a 2.500
  assert.deepEqual(b.semanas.map((w) => [w.inicio, w.intensidad, w.volumen_pct, w.descarga]), [
    ["2026-09-21", null, 0, false], ["2026-09-28", null, 0, false], ["2026-10-05", 86, 100, false], ["2026-10-12", 86, 100, false], ["2026-10-19", 51, 24, true], ["2026-10-26", 86, 100, false]]);
});

test("calendario de 12 semanas: niveles por series de trabajo, hoy y días futuros", async () => {
  const { calendario, nivelCalendario } = await import("../lib/vistas.mjs");
  assert.deepEqual([0, 1, 9, 10, 17, 18, 25, 26].map((n) => nivelCalendario(n, false)), [0, 1, 1, 2, 2, 3, 3, 4]);
  assert.equal(nivelCalendario(0, true), 1, "un día sin detalle cuenta como entrenado");
  const base = calcularBase([ses("2026-10-27", Array(12).fill("trabajo | 60 kg | 5 | | | "), { id: "press-banca" })], { catalogo: CAT, hoy: "2026-10-28", ficha: leerFicha("") });
  const cal = calendario({ ...base, pausas: new Set() });
  assert.equal(cal.semanas.length, 12);
  assert.ok(cal.semanas.every((c) => c.length === 7));
  const dias = cal.semanas.flat();
  assert.deepEqual(dias.find((d) => d.fecha === "2026-10-27"), { fecha: "2026-10-27", futuro: false, pausa: false, nivel: 2, series: 12, sesiones: 1, tipos: [""] });
  assert.ok(dias.filter((d) => d.fecha > "2026-10-28").every((d) => d.futuro && d.nivel === -1));
});

test("radar sin datos: n/d en lugar de dividir por cero", async () => {
  const { radarFuerza, radarVolumen } = await import("../lib/analisis.mjs");
  const vacia = calcularBase([], { catalogo: CAT, hoy: "2026-10-28", ficha: leerFicha("") });
  assert.equal(radarFuerza(vacia, leerFicha("").referencias), null);
  assert.equal(radarVolumen(vacia), null);
});

test("dos sesiones del mismo día van en su orden (AAAA-MM-DD.md antes que -2 y que -10), sin depender del idioma del sistema", async () => {
  const { ordenSesiones } = await import("../lib/base.mjs");
  const rutas = ["sesiones/2026/2026-03-12-10.md", "sesiones/2026/2026-03-12-2.md", "sesiones/2026/2026-03-13.md", "sesiones/2026/2026-03-12.md"];
  const s = rutas.map((ruta) => ({ ruta, fecha: ruta.match(/\d{4}-\d{2}-\d{2}/)[0] }));
  assert.deepEqual([...s].sort(ordenSesiones).map((x) => x.ruta.slice(14)), ["2026-03-12.md", "2026-03-12-2.md", "2026-03-12-10.md", "2026-03-13.md"]);
  const b = calcularBase([ses("2026-03-12", ["trabajo | 60 kg | 5 | | | "], { id: "press-banca" }), { ...ses("2026-03-12", ["trabajo | 70 kg | 5 | | | "], { id: "press-banca" }), ruta: "sesiones/2026/2026-03-12-2.md" }], { catalogo: CAT, hoy: "2026-03-13", ficha: leerFicha("") });
  assert.deepEqual(b.sesiones.map((x) => x.ruta), ["sesiones/2026/2026-03-12.md", "sesiones/2026/2026-03-12-2.md"]);
});
