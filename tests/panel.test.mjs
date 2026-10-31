import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { cpSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { temporal, cli, RAIZ } from "./ayuda.mjs";
import { contexto } from "../lib/derivar.mjs";
import { construirPanel } from "../lib/panel.mjs";

let t, carpeta;
before(() => {
  t = temporal();
  carpeta = join(t.dir, "G");
  cli(t.dir, ["configurar", carpeta]);
  process.env.GYMHUB_CONFIG = join(t.dir, "config.json");
  cpSync(join(RAIZ, "tests/fixtures/sesiones"), join(carpeta, "sesiones"), { recursive: true });
});
after(() => t.limpiar());
const panel = (hoy = "2026-10-31") => { const c = contexto(carpeta, { hoy }); return construirPanel(c, { ultimo_refresh: null }); };

test("KPIs: sesiones de la semana, volumen y PRs del mes (sábado 31 oct)", () => {
  const p = panel();
  assert.deepEqual(p.kpis.sesiones, { hechas: 3, objetivo: 4, pct: 75 });
  assert.equal(p.kpis.volumen.t, 4.7); // 2255 + 1980,9 + 425 kg (sin equivalencia, el «nivel 7» no suma toneladas)
  assert.equal(p.kpis.volumen.delta_pct, Math.round((4.6609 / 0.375 - 1) * 100)); // frente a 19–24 oct
  assert.deepEqual(p.kpis.prs_mes, { n: 1, ultimo: "press banca" });
  assert.equal(p.kpis.racha.dias, 3);
  assert.equal(p.cabecera.semana, 44);
  assert.equal(p.cabecera.fecha, "sáb 31 oct");
});

test("series por grupo frente a FICHA.md, con aviso pasado el miércoles", () => {
  const g = Object.fromEntries(panel().grupos.map((x) => [x.clave, x]));
  assert.equal(g.pecho.series, 4); // 3 el lunes + 1 el viernes
  assert.equal(g.pecho.estado, "bajo");
  assert.equal(g.pecho.aviso, true);
  assert.equal(g.espalda.series, 6.5); // dorsal + espalda alta + trapecio
  assert.equal(g.cuadriceps.series, 3);
  const miercoles = Object.fromEntries(panel("2026-10-28").grupos.map((x) => [x.clave, x]));
  assert.equal(miercoles.pecho.aviso, false, "el miércoles todavía no avisa");
});

test("progresión: principal más reciente, mejor e1RM por semana", () => {
  const g = panel().progresion;
  assert.equal(g.id, "press-banca");
  assert.deepEqual(g.puntos, [{ semana: "2026-10-19", e1rm: 87.5 }, { semana: "2026-10-26", e1rm: 99.2 }]);
  assert.equal(g.delta, 11.7);
  assert.equal(g.semanas, 1);
  writeFileSync(join(carpeta, ".gymhub/panel.json"), JSON.stringify({ ejercicio: "sentadilla" }));
  assert.equal(panel().progresion.id, "press-banca", "con una sola sesión, sentadilla no vale para la gráfica");
});

test("esta semana, sensaciones, rutina por rotación y Rex", () => {
  const p = panel();
  assert.deepEqual(p.semana.map((d) => `${d.letra}:${d.estado}:${d.texto}`), ["L:hecho:tor", "M:descanso:—", "X:hecho:mix", "J:descanso:—", "V:hecho:pec", "S:hoy:pec", "D:futuro:"]);
  assert.equal(p.sensaciones.rpe, 8.2);
  assert.equal(p.sensaciones.sueno, "6h 45m");
  assert.deepEqual(p.sensaciones.molestias, [{ zona: "hombro izq.", estado: "bien" }]);
  assert.equal(p.rutina.origen, "rotacion");
  assert.deepEqual(p.rutina.ejercicios, [{ nombre: "Press banca", prescripcion: "1×5 · 85 kg", hechas: 0, total: 1 }]);
  assert.equal(p.rex.estado, "pr");
  assert.equal(p.rex.bocadillo, "¡PR en press banca!");
  assert.equal(panel("2026-11-03").rex.estado, "toca");
});

test("plantilla del día y objetivos de FICHA.md", () => {
  mkdirSync(join(carpeta, "plantillas"), { recursive: true });
  writeFileSync(join(carpeta, "plantillas/pierna.md"), "---\nnombre: Pierna A\ntipo: pierna\ndia: sábado\n---\n- Sentadilla · 5×5 · 120 kg · 3 min\n- RDL · 3×8\n");
  writeFileSync(join(carpeta, "FICHA.md"), "# Ficha\n## Objetivos\n- dias_semana: 3\n- banca: 100 kg\n- squat: 140 kg\n");
  const p = panel();
  assert.equal(p.rutina.origen, "plantilla");
  assert.deepEqual(p.rutina.ejercicios.map((e) => [e.nombre, e.prescripcion, e.total]), [["Sentadilla", "5×5 · 120 kg", 5], ["Peso muerto rumano", "3×8", 3]]);
  assert.deepEqual(p.objetivos.map((o) => [o.id, o.actual, o.objetivo, o.pct]), [["press-banca", 99.2, 100, 99], ["sentadilla", 119.1, 140, 85]]);
  assert.equal(p.kpis.sesiones.objetivo, 3);
  assert.equal(p.rex.estado, "pr");
  assert.equal(panel("2026-11-03").semana[1].estado, "hoy", "martes 3 nov, semana nueva");
});

test("sin sesiones: todo a cero y Rex explica qué hacer", () => {
  const t2 = temporal();
  try {
    const c2 = join(t2.dir, "V");
    cli(t.dir, ["configurar", c2]);
    const p = construirPanel(contexto(c2, { hoy: "2026-10-31" }), {});
    assert.equal(p.vacio, true);
    assert.deepEqual(p.kpis.sesiones, { hechas: 0, objetivo: 4, pct: 0 });
    assert.equal(p.progresion, null);
    assert.equal(p.rutina, null);
    assert.match(p.rex.detalle, /CONTEXTO\/ y usa \/gymhub:refresh/);
  } finally { t2.limpiar(); }
});
