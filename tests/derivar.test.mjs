import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { cpSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { temporal, cli, RAIZ } from "./ayuda.mjs";
import { contexto, derivarCarpeta } from "../lib/derivar.mjs";
import { calcularRacha } from "../lib/base.mjs";
import { e1rm } from "../lib/series.mjs";

let t, carpeta;
const cerca = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);
before(() => {
  t = temporal();
  carpeta = join(t.dir, "G");
  cli(t.dir, ["configurar", carpeta]);
  process.env.GYMHUB_CONFIG = join(t.dir, "config.json");
  cpSync(join(RAIZ, "tests/fixtures/sesiones"), join(carpeta, "sesiones"), { recursive: true });
  writeFileSync(join(carpeta, "convenciones.md"), "# Mis convenciones\n## Unidades y máquinas\n- equivalencia jalón al pecho: nivel 1 = 5 kg, +5 kg por nivel\n");
});
after(() => t.limpiar());
const ctx = (hoy = "2026-10-31") => contexto(carpeta, { hoy });
const sesion = (c, f) => c.base.sesiones.find((s) => s.fecha === f);

test("e1RM de Epley: 1 a 10 repeticiones; con 1, el propio peso", () => {
  cerca(e1rm(100, 5), 116.667);
  assert.equal(e1rm(100, 1), 100);
  assert.equal(e1rm(100, 11), null);
  assert.equal(e1rm(null, 5), null);
});

test("series de trabajo, volumen (con /mano) y e1RM de una sesión", () => {
  const c = ctx();
  assert.deepEqual(c.conErrores, []);
  const s = sesion(c, "2026-10-26");
  assert.equal(s.series_trabajo, 5, "las aproximaciones no cuentan");
  cerca(s.toneladas_kg, 80 * 5 + 80 * 5 + 85 * 3 + 30 * 2 * 10 * 2); // 2255: el /mano cuenta doble
  const banca = s.ejercicios.find((e) => e.id === "press-banca");
  cerca(Math.max(...banca.series.map((x) => x.e1rm || 0)), 93.5); // 85 × 3 → 85 · 1,1
  cerca(s.ejercicios.find((e) => e.id === "remo-mancuerna").series[0].e1rm, 40); // por mano
  assert.equal(s.rpe_medio, (8 + 8.5 + 9 + 8 + 9) / 5, "RIR 2 → RPE 8, RIR 1 → RPE 9");
});

test("libras, nivel con equivalencia, PC+lastre con peso corporal y tiempo", () => {
  const s = sesion(ctx(), "2026-10-28");
  const [sq, jalon, dom, plancha] = s.ejercicios;
  cerca(sq.series[0].kg, 225 * 0.4536);
  cerca(sq.series[0].e1rm, 225 * 0.4536 * (1 + 5 / 30));
  cerca(jalon.series[0].kg, 35, 1e-9); // nivel 7 = 5 + 6·5
  cerca(dom.series[0].kg, 90, 1e-9); // 80 + 10
  cerca(dom.series[0].e1rm, 105);
  assert.equal(plancha.series[0].e1rm, null);
  assert.equal(plancha.series[0].escala, "tiempo");
  assert.equal(s.series_trabajo, 7);
  cerca(s.toneladas_kg, 225 * 0.4536 * 15 + 35 * 20 + 90 * 5);
  assert.equal(s.cardio_min, 20);
});

test("series por grupo: 1 al grupo principal y 0,5 a cada secundario", () => {
  const c = ctx();
  assert.deepEqual(sesion(c, "2026-10-26").grupos, { pecho: 3, triceps: 1.5, hombro: 1.5, dorsal: 2, "espalda-alta": 1, biceps: 1 });
  assert.deepEqual(sesion(c, "2026-10-28").grupos, { cuadriceps: 3, gluteo: 1.5, lumbar: 1.5, dorsal: 3, biceps: 1.5, "espalda-alta": 0.5, abdomen: 1 });
  const w = c.base.semanas.get("2026-10-26");
  assert.equal(w.sesiones.length, 3);
  assert.equal(w.series_trabajo, 13);
  cerca(w.rpe_medio, 8.2);
  assert.equal(c.base.sesiones.find((s) => s.fecha === "2026-10-26").patrones["empuje-horizontal"], 3);
});

test("PRs: hacen falta dos sesiones previas; el no_hecho no cuenta", () => {
  const c = ctx();
  assert.equal(c.base.prs.length, 1);
  assert.equal(c.base.prs[0].id, "press-banca");
  assert.equal(c.base.prs[0].fecha, "2026-10-30");
  cerca(c.base.prs[0].e1rm, 99.1667);
  assert.equal(sesion(c, "2026-10-30").series_trabajo, 1);
  const banca = c.records.find((r) => r.id === "press-banca");
  assert.equal(banca.serie, "85 kg × 5");
  assert.equal(banca.nuevo, true);
  assert.equal(c.records[0].principal, true);
});

test("racha: se rompe con 4 días sin entrenar; las pausas declaradas no cuentan", () => {
  assert.deepEqual(ctx().base.racha, { actual: 3, mejor: 3, ultima: "2026-10-30", desde: "2026-10-26" });
  writeFileSync(join(carpeta, "eventos.md"), "# Eventos\n- 2026-10-20 → 2026-10-24 · vacaciones · playa\n");
  assert.equal(ctx().base.racha.actual, 4);
  writeFileSync(join(carpeta, "eventos.md"), "# Eventos\n");
  assert.equal(ctx("2026-11-03").base.racha.actual, 3, "31, 1 y 2 sin entrenar: aún vale");
  assert.equal(ctx("2026-11-04").base.racha.actual, 0, "4 días sin entrenar: rota");
  assert.equal(calcularRacha(["2026-01-01", "2026-01-04", "2026-01-08"], { hoy: "2026-01-08" }).actual, 3);
  assert.equal(calcularRacha(["2026-01-01", "2026-01-06"], { hoy: "2026-01-06" }).actual, 1);
});

test("derivar escribe datos.json, records.md (conservando marcas) y el estado de FICHA.md", async () => {
  writeFileSync(join(carpeta, "records.md"), "# Récords\n## PRs calculados\nviejo\n## Marcas declaradas\n- 2024 · banca 80 kg\n");
  const d = await derivarCarpeta(carpeta, { md: true, hoy: "2026-10-31" });
  assert.equal(d.resumen.sesiones_total, 4);
  assert.equal(d.resumen.racha, 3);
  assert.equal(d.calendario.semanas.length, 12);
  assert.equal(d.calendario.semanas[11][4].fecha, "2026-10-30");
  assert.equal(d.calendario.semanas[11][4].nivel, 1);
  assert.equal(d.calendario.semanas[11][6].nivel, -1, "el domingo 1 de noviembre es futuro");
  const rec = readFileSync(join(carpeta, "records.md"), "utf8");
  assert.match(rec, /\| Press banca \| 99,2 kg \(e1RM\) \| 85 kg × 5 \| 2026-10-30 \|/);
  assert.match(rec, /## Marcas declaradas\n- 2024 · banca 80 kg/);
  assert.doesNotMatch(rec, /viejo/);
  const ficha = readFileSync(join(carpeta, "FICHA.md"), "utf8");
  assert.match(ficha, /## Estado actual\n.*\n- e1RM: press banca 99,2 · dominadas 105 · sentadilla 119,1/);
  assert.match(ficha, /- Molestias activas: ninguna/);
});

test("una sesión con errores no rompe el cálculo: se aparta y se informa", async () => {
  writeFileSync(join(carpeta, "sesiones/2026/2026-10-31.md"), "---\nfecha: 2026-10-31\n---\n## Ejercicios\n### X\n<!-- id: no-existe -->\n| # | tipo | carga | reps |\n|---|---|---|---|\n| 1 | trabajo | 10 kg | 5 |\n");
  const c = ctx();
  assert.equal(c.base.total_sesiones, 4);
  assert.equal(c.conErrores.length, 1);
  assert.match(c.conErrores[0].errores[0], /no está en el catálogo/);
});

test("/lado cuenta doble en el volumen y «8/8» usa el menor lado para el e1RM", async () => {
  const { factorVolumen, repsE1rm, repsVolumen, kgCarga } = await import("../lib/series.mjs");
  const { leerCarga, leerReps } = await import("../lib/canonico.mjs");
  assert.equal(factorVolumen(leerCarga("40 kg/lado")), 2);
  assert.equal(factorVolumen(leerCarga("40 kg")), 1);
  assert.equal(repsE1rm(leerReps("8/7")), 7);
  assert.equal(repsVolumen(leerReps("8/7")), 15);
  assert.equal(kgCarga(leerCarga("PC-20 kg"), { pesoCorporal: 80 }), 60, "asistida: peso corporal menos la ayuda");
  assert.equal(kgCarga(leerCarga("PC+10 kg")), null, "sin peso corporal no hay kg");
});
