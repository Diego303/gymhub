// G2 · Semanas ISO (también la 53 y el cambio de año), el mes de cada semana (por su jueves) en
// meses que empiezan en lunes, miércoles y domingo, semanas de domingo, semanas vacías, la semana en
// curso, la racha con pausas y las tendencias con 0, 1 y 2 puntos.
import { test } from "node:test";
import assert from "node:assert/strict";
import { semanaISO, inicioSemana } from "../lib/util.mjs";
import { calcularBase, calcularRacha } from "../lib/base.mjs";
import { construirSemana, claveSemana, juevesDe } from "../lib/semanas.mjs";
import { construirPanel } from "../lib/panel.mjs";
import { semanaPedida } from "../lib/seguimiento.mjs";
import { leerFicha } from "../lib/ficha.mjs";
import { CAT, ses } from "./fixtures/ayuda-metricas.mjs";
import { recordsPorEjercicio } from "../lib/records.mjs";
import { temporal } from "./ayuda.mjs";

/** Un contexto mínimo con una sesión de banca 60×5 en cada fecha. */
function ctx(fechas, { hoy, empieza = "lunes", dias = 3, eventos = [] } = {}) {
  const t = temporal();
  const ficha = leerFicha(`## Objetivos\n- dias_semana: ${dias}\n`);
  const config = { semana_empieza: empieza };
  const base = calcularBase(fechas.map((f) => ses(f, ["trabajo | 60 kg | 5 | | | "], { id: "press-banca" })), { catalogo: CAT, hoy, ficha, config, eventos });
  return { c: { base, ficha, config, carpeta: t.dir, catalogo: CAT, records: recordsPorEjercicio(base) }, limpiar: t.limpiar };
}

test("semana ISO: la 53, el cambio de año y el 1 de enero en la semana del año anterior", () => {
  const casos = { "2026-12-28": "2026-W53", "2026-12-31": "2026-W53", "2027-01-01": "2026-W53", "2027-01-03": "2026-W53", "2027-01-04": "2027-W01",
    "2020-12-31": "2020-W53", "2021-01-03": "2020-W53", "2024-12-30": "2025-W01", "2023-01-01": "2022-W52", "2026-01-01": "2026-W01", "2025-12-29": "2026-W01" };
  for (const [f, k] of Object.entries(casos)) assert.equal(semanaISO(f).clave, k, f);
  assert.equal(semanaPedida({ config: {}, base: { hoy: "2027-01-10" } }, "2026-W53"), "2026-12-28");
  assert.equal(semanaPedida({ config: {}, base: { hoy: "2027-01-10" } }, "2027-w01"), "2027-01-04");
});

test("la semana 53 de 2026 se ve como una semana más, con su mes (diciembre, por su jueves)", () => {
  const { c, limpiar } = ctx(["2026-12-21", "2026-12-28", "2026-12-31", "2027-01-02", "2027-01-04"], { hoy: "2027-01-05" });
  try {
    const S = construirSemana(c);
    assert.deepEqual(S.semanas.map((w) => [w.clave, w.titulo, w.mes.clave]), [["2026-W52", "Semana 52", "2026-12"], ["2026-W53", "Semana 53", "2026-12"], ["2027-W01", "Semana 1", "2027-01"]]);
    const w53 = S.semanas[1];
    assert.equal(w53.rango, "28 dic – 3 ene 2027");
    assert.equal(w53.estado, "cumplida");
    assert.equal(w53.kpis.sesiones.valor, 3);
    assert.equal(w53.mes.titulo, "Resumen de diciembre");
    assert.equal(S.semanas[2].mes.anterior.nombre, "dic");
    assert.equal(S.semanas[2].mes.anterior.sesiones, 4);
  } finally { limpiar(); }
});

test("el mes de cada semana es el de su jueves: meses que empiezan en lunes, miércoles y domingo", () => {
  // marzo de 2026 empieza en domingo, abril en miércoles y junio en lunes
  const { c, limpiar } = ctx(["2026-03-01", "2026-03-30", "2026-04-01", "2026-05-31", "2026-06-01"], { hoy: "2026-06-03" });
  try {
    const mes = (f) => construirSemana(c).semanas.find((w) => w.inicio === inicioSemana(f)).mes.clave;
    assert.equal(mes("2026-03-01"), "2026-02", "domingo 1 de marzo: su semana es del jueves 26 de febrero");
    assert.equal(mes("2026-03-30"), "2026-04", "lunes 30 de marzo: su semana es del jueves 2 de abril");
    assert.equal(mes("2026-04-01"), "2026-04");
    assert.equal(mes("2026-05-31"), "2026-05", "domingo 31 de mayo: jueves 28 de mayo");
    assert.equal(mes("2026-06-01"), "2026-06", "lunes 1 de junio: jueves 4 de junio");
    const abril = construirSemana(c).semanas.find((w) => w.mes.clave === "2026-04" && w.kpis.sesiones.valor);
    assert.equal(abril.mes.hasta.sesiones, 2, "el 30 y el 1 cuentan en abril");
  } finally { limpiar(); }
});

test("semanas que empiezan en domingo: su clave y su mes salen de su jueves", () => {
  // jueves 1 de octubre de 2026: la semana de domingo 27 sep – sábado 3 oct es de octubre (decisión D4)
  assert.equal(juevesDe("2026-09-27"), "2026-10-01");
  assert.equal(claveSemana("2026-09-27"), "2026-W40");
  const { c, limpiar } = ctx(["2026-09-27", "2026-09-30", "2026-10-03"], { hoy: "2026-10-03", empieza: "domingo" });
  try {
    const S = construirSemana(c);
    assert.equal(S.semanas.length, 1);
    assert.deepEqual([S.semanas[0].inicio, S.semanas[0].fin, S.semanas[0].clave, S.semanas[0].mes.clave, S.semanas[0].kpis.sesiones.valor], ["2026-09-27", "2026-10-03", "2026-W40", "2026-10", 3]);
  } finally { limpiar(); }
});

test("semanas vacías, la semana en curso y las comparaciones con 0, 1 y 2 puntos", () => {
  // W41 con 1 sesión, W42 vacía, W43 con 3, W44 en curso con 1
  const { c, limpiar } = ctx(["2026-10-05", "2026-10-19", "2026-10-21", "2026-10-23", "2026-10-26"], { hoy: "2026-10-27" });
  try {
    const S = construirSemana(c);
    const [w41, w42, w43, w44] = S.semanas;
    assert.deepEqual(S.semanas.map((w) => [w.clave, w.estado, w.racha]), [["2026-W41", "fallada", 0], ["2026-W42", "fallada", 0], ["2026-W43", "cumplida", 1], ["2026-W44", "en_curso", 1]]);
    // 1 punto: sin anterior ni media
    assert.deepEqual([w41.kpis.sesiones.anterior, w41.kpis.sesiones.delta_anterior, w41.kpis.sesiones.media4, w41.kpis.sesiones.delta_media4], [null, null, null, null]);
    // De 1 a 0 sesiones: −100 %; de 0 a 3: no hay porcentaje (dividiría por cero)
    assert.equal(w42.kpis.sesiones.delta_anterior, -100);
    assert.equal(w43.kpis.sesiones.delta_anterior, null);
    // Media de 2 semanas previas (1 y 0) = 0,5 → 3 es +500 %
    assert.equal(w43.kpis.sesiones.media4, 0.5);
    assert.equal(w43.kpis.sesiones.delta_media4, 500);
    assert.equal(w44.kpis.sesiones.valor, 1);
    assert.equal(S.defecto, "2026-W44", "la actual, porque ya tiene una sesión");
    // Sin sesiones en la semana actual, la de por defecto es la anterior
    const { c: c2, limpiar: l2 } = ctx(["2026-10-19"], { hoy: "2026-10-27" });
    try { assert.equal(construirSemana(c2).defecto, "2026-W43"); } finally { l2(); }
  } finally { limpiar(); }
});

test("Panel: la progresión con 1 y 2 puntos y el volumen sin semana anterior", () => {
  const datos = { ultimo_refresh: null };
  const una = ctx(["2026-10-26"], { hoy: "2026-10-27" });
  const dosMismaSemana = ctx(["2026-10-26", "2026-10-27"], { hoy: "2026-10-27" });
  const dosSemanas = ctx(["2026-10-19", "2026-10-26"], { hoy: "2026-10-27" });
  try {
    assert.equal(construirPanel(una.c, datos).progresion, null, "con una sola sesión no hay gráfica");
    assert.equal(construirPanel(una.c, datos).kpis.volumen.delta_pct, null, "sin semana anterior no hay porcentaje");
    const p1 = construirPanel(dosMismaSemana.c, datos).progresion;
    assert.deepEqual([p1.puntos.length, p1.delta, p1.semanas], [1, null, 0]);
    const p2 = construirPanel(dosSemanas.c, datos).progresion;
    assert.deepEqual([p2.puntos.length, p2.delta, p2.semanas], [2, 0, 1]);
  } finally { una.limpiar(); dosMismaSemana.limpiar(); dosSemanas.limpiar(); }
});

test("racha: se rompe con 4 días sin entrenar, y los días de una pausa declarada no cuentan", () => {
  assert.equal(calcularRacha(["2026-10-01", "2026-10-04"], { hoy: "2026-10-04" }).actual, 2, "2 días sin entrenar");
  assert.equal(calcularRacha(["2026-10-01", "2026-10-06"], { hoy: "2026-10-06" }).actual, 1, "4 días sin entrenar: se rompe");
  const pausa = new Set(["2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08"]);
  assert.equal(calcularRacha(["2026-10-01", "2026-10-10"], { hoy: "2026-10-10", pausas: pausa }).actual, 2, "fuera de la pausa solo faltan el 2 y el 9");
  assert.equal(calcularRacha(["2026-10-01"], { hoy: "2026-10-05" }).actual, 1, "3 días después sigue viva");
  assert.equal(calcularRacha(["2026-10-01"], { hoy: "2026-10-06" }).actual, 0, "4 días después ya no");
  assert.deepEqual(calcularRacha([], { hoy: "2026-10-06" }), { actual: 0, mejor: 0, ultima: null, desde: null });
});
