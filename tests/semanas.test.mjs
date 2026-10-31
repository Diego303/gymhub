// Pestaña Semana sobre la persona sintética de 6 meses (tests/fixtures/seismeses.mjs).
// Cada cifra está calculada a mano en su comentario.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { temporal, cli } from "./ayuda.mjs";
import { contexto } from "../lib/derivar.mjs";
import { construirSemana, calcularSemanas, leerRepaso, componerRepaso, sugerenciaRepaso, claveSemana } from "../lib/semanas.mjs";
import { hechosSemana } from "../lib/seguimiento.mjs";
import { generarSeisMeses } from "./fixtures/seismeses.mjs";

let t, carpeta;
const HOY = "2026-10-31"; // sábado de la semana 25 (W44)
before(() => {
  t = temporal();
  carpeta = join(t.dir, "SEIS");
  cli(t.dir, ["configurar", carpeta]);
  process.env.GYMHUB_CONFIG = join(t.dir, "config.json");
  generarSeisMeses(carpeta);
});
after(() => t.limpiar());
const S = (hoy = HOY) => construirSemana(contexto(carpeta, { hoy }));
const sem = (clave, hoy) => S(hoy).semanas.find((w) => w.clave === clave);

test("26 semanas, de la W19 a la W44; por defecto, la actual (ya tiene sesiones)", () => {
  const s = S();
  assert.equal(s.semanas.length, 26);
  assert.equal(s.semanas[0].clave, "2026-W19");
  assert.equal(s.semanas[25].clave, "2026-W44");
  assert.equal(s.semanas[25].rango, "26 oct – 1 nov 2026");
  assert.equal(s.actual, "2026-W44");
  assert.equal(s.defecto, "2026-W44");
  // el lunes 2 de noviembre empieza la W45, sin sesiones: se abre por la W44
  const l = S("2026-11-02");
  assert.equal(l.semanas.length, 27);
  assert.equal(l.actual, "2026-W45");
  assert.equal(l.defecto, "2026-W44");
  assert.equal(l.semanas[26].estado, "en_curso", "la semana en curso sin sesiones no cuenta como fallada");
  assert.equal(l.semanas[26].racha, 1, "ni rompe la racha");
  assert.deepEqual([l.semanas[26].mes.hasta.cumplidas, l.semanas[26].mes.hasta.semanas], [0, 0], "ni cuenta en el mes hasta que termine");
});

test("KPIs de la W44 y sus comparaciones con la W43 y con la media de W40–W43", () => {
  const k = sem("2026-W44").kpis;
  // sesiones: 3 frente a 2 → +50 %; media (3+3+3+2)/4 = 2,75 → +9 %
  assert.deepEqual(k.sesiones, { valor: 3, anterior: 2, delta_anterior: 50, media4: 2.8, delta_media4: 9 });
  // toneladas: 15·85 + 1500 + 1440 = 4215 kg; W43 = 15·84 + 1500 = 2760 → +53 %;
  // media de 4155, 4170, 4185 y 2760 = 3817,5 → +10 %
  assert.deepEqual(k.toneladas, { valor: 4.2, anterior: 2.8, delta_anterior: 53, media4: 3.8, delta_media4: 10 });
  // series: 9 frente a 6 → +50 %; media 8,25 → +9 %
  assert.deepEqual(k.series, { valor: 9, anterior: 6, delta_anterior: 50, media4: 8.3, delta_media4: 9 });
  // intensidad: (6·85,714 + 3·78,947)/9 = 83,46 % (banca y sentadilla al 6/7 de su e1RM, remo 60/76);
  // W43 85,71 → −3 %; media (3·83,46 + 85,71)/4 = 84,02 → −1 %
  assert.deepEqual(k.intensidad, { valor: 83.5, anterior: 85.7, delta_anterior: -3, media4: 84, delta_media4: -1 });
  // PRs: un PR de banca cada semana desde la 3.ª sesión de banca
  assert.deepEqual(k.prs, { valor: 1, anterior: 1, delta_anterior: 0, media4: 1, delta_media4: 0 });
  assert.deepEqual(sem("2026-W44").prs.map((p) => [p.nombre, p.texto]), [["Press banca", "85 kg × 5"]]);
  assert.equal(sem("2026-W44").sueno, 7); // (7 + 6 + 8)/3
});

test("la semana de pausa no cuenta en las medias ni como «anterior»", () => {
  assert.equal(sem("2026-W29").estado, "pausa");
  const k = sem("2026-W30").kpis; // w11: la media son W26–W28 (la W29 de pausa fuera)
  assert.equal(k.toneladas.delta_anterior, null);
  assert.equal(k.toneladas.anterior, null);
  // 15·71 + 2940 = 4005 kg frente a la media de 3945, 3960 y 3975 = 3960 → +1 %
  assert.equal(k.toneladas.media4, 4);
  assert.equal(k.toneladas.delta_media4, 1);
  assert.equal(k.sesiones.delta_media4, 0);
  assert.equal(sem("2026-W29").kpis.toneladas.delta_media4, null);
});

test("estados y racha de semanas cumplidas (la pausa no la rompe)", () => {
  const W = S().semanas;
  assert.deepEqual(W.map((w) => ({ cumplida: "✓", a1: "1", fallada: "✗", pausa: "◇", en_curso: "·" })[w.estado]).join(""), "✓✓1✓✓✗✓✓✓✓◇✓✓1✓✓✓✗✓✓✓✓✓✓1✓");
  // W30–W31 tras la pausa: 6, 7, 8, 9 · pausa · 11, 12 → 6 seguidas
  assert.equal(sem("2026-W31").racha, 6);
  assert.equal(sem("2026-W42").racha, 6); // W37–W42
  assert.equal(sem("2026-W43").racha, 0); // a 1 sesión
  assert.equal(sem("2026-W44").racha, 1);
});

test("series por grupo frente a la media de 4 semanas y aviso por debajo del 70 %", () => {
  const g = Object.fromEntries(sem("2026-W43").grupos.map((x) => [x.clave, x]));
  // W43 sin remo: espalda 0 y brazos 1,5 (solo tríceps) frente a 4,5 y 3 → aviso
  assert.deepEqual([g.espalda.series, g.espalda.media4, g.espalda.aviso], [0, 4.5, true]);
  assert.deepEqual([g.brazos.series, g.brazos.media4, g.brazos.aviso], [1.5, 3, true]);
  assert.deepEqual([g.pecho.aviso, g.pierna.aviso, g.hombro.aviso, g.core.aviso], [false, false, false, false]);
  const h = Object.fromEntries(sem("2026-W44").grupos.map((x) => [x.clave, [x.series, x.media4]]));
  // espalda: (3·4,5 + 0)/4 = 3,375 · brazos: (3·3 + 1,5)/4 = 2,625
  assert.deepEqual(h, { pecho: [3, 3], espalda: [4.5, 3.4], pierna: [4.5, 4.5], hombro: [1.5, 1.5], brazos: [3, 2.6], core: [0, 0] });
});

test("resumen del mes (por el jueves de cada semana) frente al anterior", () => {
  const m = sem("2026-W44").mes;
  assert.equal(m.titulo, "Resumen de octubre");
  // octubre = W40–W44: 3+3+3+2+3 = 14 sesiones; 4155+4170+4185+2760+4215 = 19485 kg; 5 PRs; 4 de 5 cumplidas
  assert.deepEqual(m.hasta, { sesiones: 14, toneladas: 19.5, prs: 5, cumplidas: 4, semanas: 5 });
  // septiembre = W36 (0 sesiones, jueves 3 sep) a W39: 9 sesiones, 4110+4125+4140 = 12375 kg, 3 PRs, 3 de 4
  assert.deepEqual(m.anterior, { nombre: "sep", anio: 2026, sin_datos: false, sesiones: 9, toneladas: 12.4, prs: 3, cumplidas: 3, semanas: 4 });
  assert.deepEqual(m.barras.map((b) => b.pct), [99, 99, 99, 65, 100]);
  const m41 = sem("2026-W41").mes;
  assert.equal(m41.titulo, "Resumen de octubre (hasta la sem 41)");
  assert.deepEqual(m41.hasta, { sesiones: 6, toneladas: 8.3, prs: 2, cumplidas: 2, semanas: 2 });
  assert.deepEqual(m41.barras.map((b) => b.futura), [false, false, true, true, true]);
  assert.deepEqual(sem("2026-W31").mes.hasta.semanas, 4, "julio: la semana de pausa no cuenta");
});

test("molestias de la semana con la regla del Diario (se repite en 3 menciones seguidas)", () => {
  assert.deepEqual(sem("2026-W44").molestias, [{ zona: "hombro izq.", estado: "molestia", sesiones: 2, repite: true }]);
  assert.deepEqual(sem("2026-W43").molestias, [{ zona: "hombro izq.", estado: "molestia", sesiones: 1, repite: false }]);
});

test("hechos para el repaso, apoyados en los datos", () => {
  const W = calcularSemanas(contexto(carpeta, { hoy: HOY }));
  assert.deepEqual(hechosSemana(W.at(-1)).map((h) => `${h.marca} ${h.texto}`), [
    "✓ Cumpliste el objetivo: 3 de 3 sesiones y con más volumen que tu media.",
    "★ 1 PR: press banca 85 kg × 5.",
    "! Molestias en el hombro izq. (2 sesiones); se repite: valora consultarlo.",
  ]);
  assert.deepEqual(hechosSemana(W.at(-2)).map((h) => h.marca), ["▲", "★", "▲", "!"]);
  assert.match(hechosSemana(W.at(-2))[2].texto, /^Espalda y brazos se han quedado por debajo del 70 % de tu media\.$/);
});

const REPASO = `## Repaso
- ✓ Cumpliste el objetivo: 3 de 3 sesiones y con más volumen que tu media.
- ★ 1 PR: press banca 85 kg × 5.
- → Próxima semana: mantén el plan.

## Preguntas
- ¿Cómo te has sentido?: Con energía, aunque el jueves llegué cansado.
- ¿Molestias?: Hombro izquierdo algo cargado.
- ¿Qué priorizas la semana que viene?: Pierna y dormir 7 h.
`;

test("componer y leer el repaso con su formato fijo", () => {
  const r = componerRepaso("2026-W44", REPASO, "2026-11-01T21:10");
  assert.deepEqual(r.errores, []);
  assert.ok(r.texto.startsWith("---\nsemana: 2026-W44\ngenerado: 2026-11-01T21:10\n---\n## Repaso\n- ✓ Cumpliste"));
  assert.match(r.texto, /\n\n## Preguntas\n- ¿Cómo te has sentido\?: Con energía, aunque el jueves llegué cansado\.\n/);
  const l = leerRepaso(r.texto);
  assert.equal(l.semana, "2026-W44");
  assert.equal(l.generado_texto, "1 nov · 21:10");
  assert.deepEqual(l.lineas.map((x) => x.marca), ["✓", "★", "→"]);
  assert.deepEqual(l.preguntas[2], { pregunta: "¿Qué priorizas la semana que viene?", respuesta: "Pierna y dormir 7 h." });
  // errores: marcador no permitido, más de 5 líneas, preguntas que faltan o cambiadas
  assert.match(componerRepaso("2026-W44", REPASO.replace("- → ", "- * "), "x").errores.join(), /sin marcador válido/);
  assert.match(componerRepaso("2026-W44", REPASO.replace("## Repaso\n", "## Repaso\n- ✓ a\n- ✓ b\n- ✓ c\n"), "x").errores.join(), /6 líneas; como mucho 5/);
  assert.match(componerRepaso("2026-W44", REPASO.replace("- ¿Molestias?: Hombro izquierdo algo cargado.\n", ""), "x").errores.join(), /hacen falta las 3 preguntas/);
  assert.match(componerRepaso("2026-W44", REPASO.replace("¿Molestias?", "¿Dolor?"), "x").errores.join(), /la pregunta 2 debe ser «¿Molestias\?»/);
  // formato antiguo (Fase 7): «Qué ajustar» pasa a acciones
  assert.deepEqual(leerRepaso("# Semana\n## Cifras\n- x\n## Qué ajustar\n- Más pierna.\n").lineas, [{ marca: "→", texto: "Más pierna." }]);
});

test("/semana: datos por la línea de órdenes, guardar con formato exacto y la web lo recibe", () => {
  const env = { GYMHUB_HOY: HOY };
  const d = cli(t.dir, ["semana"], { env });
  assert.equal(d.codigo, 0, d.salida + d.error);
  assert.match(d.salida, /^SEMANA 2026-W44 · 26 oct – 1 nov 2026 · FICHERO semanas\/2026-W44\.md\n/);
  assert.match(d.salida, /- Volumen: 4,2 t \(\+53 % frente a la anterior, \+10 % frente a la media de 4 semanas\)/);
  assert.match(d.salida, /\n✓ Cumpliste el objetivo: 3 de 3 sesiones y con más volumen que tu media\.\n/);
  assert.equal(cli(t.dir, ["semana", "guardar", "2026-W44"], { entrada: REPASO.replace("- → ", "- ? "), env }).codigo, 2);
  assert.equal(existsSync(join(carpeta, "semanas/2026-W44.md")), false, "con errores no se escribe nada");
  const g = cli(t.dir, ["semana", "guardar", "2026-W44"], { entrada: REPASO, env });
  assert.equal(g.codigo, 0, g.salida);
  const f = readFileSync(join(carpeta, "semanas/2026-W44.md"), "utf8");
  assert.match(f, /^---\nsemana: 2026-W44\ngenerado: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}\n---\n## Repaso\n/);
  const web = readFileSync(join(carpeta, ".gymhub/web/datos.js"), "utf8");
  assert.match(web, /"repaso":\{"semana":"2026-W44"/);
  assert.match(web, /"navegar":\{"id":\d+,"vista":"semana","filtro":"2026-W44"/);
  assert.equal(sem("2026-W44").repaso.preguntas.length, 3);
  assert.equal(sem("2026-W43").repaso, null, "una semana sin repaso → la web muestra el recordatorio");
});

test("/refresh en fin de semana sugiere el repaso si la semana tiene sesiones y no tiene repaso", () => {
  const c = (hoy) => contexto(carpeta, { hoy });
  assert.equal(claveSemana("2026-10-26"), "2026-W44");
  // la W44 ya tiene repaso (test anterior): no se sugiere
  assert.equal(sugerenciaRepaso(c("2026-10-31")), null);
  writeFileSync(join(carpeta, "sesiones/2026/2026-11-07.md"), readFileSync(join(carpeta, "sesiones/2026/2026-10-30.md"), "utf8").replace(/2026-10-30/g, "2026-11-07"));
  assert.equal(sugerenciaRepaso(c("2026-11-07")), "¿Hacemos el repaso de la semana? → /gymhub:semana", "sábado de la W45, con una sesión y sin repaso");
  assert.equal(sugerenciaRepaso(c("2026-11-06")), null, "un viernes, no");
});
