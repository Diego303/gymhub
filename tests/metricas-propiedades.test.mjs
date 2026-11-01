// G2 · Propiedades de las métricas con historiales aleatorios (semilla fija; GYMHUB_SEMILLA=<n> para otra):
//   - la suma por días = la de las semanas = la de los meses (toneladas, series y sesiones)
//   - reordenar las sesiones no cambia nada
//   - añadir series de calentamiento no cambia ninguna métrica de trabajo
//   - pasar todo a libras y volver a kg da lo mismo (con tolerancia de redondeo)
import { test } from "node:test";
import assert from "node:assert/strict";
import { leerSesion, escribirSesion } from "../lib/canonico.mjs";
import { calcularBase } from "../lib/base.mjs";
import { calcularSemanas } from "../lib/semanas.mjs";
import { recordsPorEjercicio } from "../lib/records.mjs";
import { leerFicha } from "../lib/ficha.mjs";
import { sumarDias } from "../lib/util.mjs";
import { CAT } from "./fixtures/ayuda-metricas.mjs";
import { prng, semillaBase } from "./fixtures/aleatorio.mjs";
import { temporal } from "./ayuda.mjs";

const IDS = ["press-banca", "sentadilla", "remo-barra", "peso-muerto", "press-militar", "dominadas", "curl-biceps", "hip-thrust"];
const HISTORIALES = Number(process.env.GYMHUB_N_HIST ?? 25);
const FICHA = leerFicha("## Objetivos\n- dias_semana: 3\n## Datos\n- peso_corporal: 78 kg\n");

/** Un historial inventado de ~4 meses: modelos de sesión (antes de escribirlos), con fechas en orden. */
function historial(g) {
  const out = [];
  let f = `2026-0${g.ent(1, 5)}-${String(g.ent(1, 28)).padStart(2, "0")}`;
  for (let i = g.ent(15, 50); i > 0; i--) {
    f = sumarDias(f, g.ent(0, 4));
    out.push({
      fecha: f, titulo: "S", tipo: g.uno(["torso", "pierna", "full"]), sueno_h: g.quizas(0.5, () => g.ent(10, 18) / 2), sensacion_pre: g.quizas(0.5, () => g.ent(3, 10)),
      molestias: [], confianza: "alta", calentamiento: "", cardio: [], notas: "", original: null, otras: {}, extra: {},
      ejercicios: Array.from({ length: g.ent(1, 4) }, () => {
        const id = g.uno(IDS);
        return { id, nombre: id, superserie: null, orden_superserie: null, nota: null, series: Array.from({ length: g.ent(1, 5) }, (_, k) => {
          const pc = id === "dominadas" && g.r() < 0.6;
          return { n: k + 1, tipo: g.uno(["trabajo", "trabajo", "trabajo", "top", "backoff", "amrap"]), carga: { texto: pc ? `PC+${g.ent(0, 30)} kg` : `${g.ent(8, 80) * 2.5} kg` },
            reps: { texto: String(g.ent(1, 15)) }, rpe: g.quizas(0.6, () => g.ent(12, 20) / 2), rir: null, nota: null };
        }) };
      }),
    });
  }
  return out;
}
const leer = (modelos) => modelos.map((m, i) => leerSesion(escribirSesion(m), `sesiones/${m.fecha.slice(0, 4)}/${m.fecha}${modelos.slice(0, i).some((x) => x.fecha === m.fecha) ? `-${i}` : ""}.md`));
const calcular = (sesiones, hoy) => calcularBase(sesiones, { catalogo: CAT, ficha: FICHA, config: {}, hoy });
/** Lo que se compara de un modelo base: cifras de sesiones, semanas, ejercicios, PRs, racha y récords. */
const huella = (b) => JSON.stringify({
  sesiones: b.sesiones.map((s) => [s.fecha, s.ruta, s.series_trabajo, +s.toneladas_kg.toFixed(6), s.grupos, s.patrones, s.rpe_medio, s.prs.map((p) => p.id)]),
  semanas: [...b.semanas.values()].map((w) => [w.inicio, w.sesiones.length, w.series_trabajo, +w.toneladas_kg.toFixed(6), w.rpe_medio]),
  ejercicios: [...b.porEjercicio.values()].map((h) => [h.id, h.escala, h.sesiones.map((s) => [s.fecha, s.e1rm && +s.e1rm.toFixed(6), s.pr, s.mejor?.valor.map((v) => +v.toFixed(6))])]),
  prs: b.prs.map((p) => [p.fecha, p.id, +p.valor.toFixed(6)]), racha: b.racha,
  records: recordsPorEjercicio(b).map((r) => [r.id, +r.valor.toFixed(6), r.fecha]),
});

const cada = (fn) => {
  for (let i = 0; i < HISTORIALES; i++) {
    const semilla = semillaBase() + 5000 + i;
    try { fn(prng(semilla)); } catch (e) { e.message = `[semilla ${semilla}] ${e.message}`; throw e; }
  }
};

test("la suma por días = la de las semanas = la de los meses", () => cada((g) => {
  const ses = leer(historial(g));
  const hoy = sumarDias(ses.at(-1).fecha, 3);
  const b = calcular(ses, hoy);
  const total = { t: 0, series: 0, sesiones: 0 };
  const porDia = new Map();
  for (const s of b.sesiones) { const d = porDia.get(s.fecha) || { t: 0, series: 0, sesiones: 0 }; d.t += s.toneladas_kg; d.series += s.series_trabajo; d.sesiones++; porDia.set(s.fecha, d); }
  for (const d of porDia.values()) { total.t += d.t; total.series += d.series; total.sesiones += d.sesiones; }
  const t = temporal();
  try {
    const W = calcularSemanas({ base: b, ficha: FICHA, config: {}, carpeta: t.dir });
    const sem = W.reduce((a, w) => ({ t: a.t + w.toneladas_kg, series: a.series + w.series, sesiones: a.sesiones + w.sesiones }), { t: 0, series: 0, sesiones: 0 });
    const meses = new Map();
    for (const w of W) { const m = meses.get(w.mes) || { t: 0, series: 0, sesiones: 0 }; m.t += w.toneladas_kg; m.series += w.series; m.sesiones += w.sesiones; meses.set(w.mes, m); }
    const mes = [...meses.values()].reduce((a, m) => ({ t: a.t + m.t, series: a.series + m.series, sesiones: a.sesiones + m.sesiones }), { t: 0, series: 0, sesiones: 0 });
    const base = [...b.semanas.values()].reduce((a, w) => ({ t: a.t + w.toneladas_kg, series: a.series + w.series_trabajo, sesiones: a.sesiones + w.sesiones.length }), { t: 0, series: 0, sesiones: 0 });
    for (const x of [sem, mes, base]) {
      assert.ok(Math.abs(x.t - total.t) < 1e-6, `${x.t} ≠ ${total.t}`);
      assert.equal(x.series, total.series);
      assert.equal(x.sesiones, total.sesiones);
    }
    assert.equal(total.sesiones, ses.length);
  } finally { t.limpiar(); }
}));

test("reordenar las sesiones no cambia ninguna cifra", () => cada((g) => {
  const ses = leer(historial(g));
  const hoy = sumarDias(ses.at(-1).fecha, 2);
  const barajadas = [...ses];
  for (let i = barajadas.length - 1; i > 0; i--) { const j = g.ent(0, i); [barajadas[i], barajadas[j]] = [barajadas[j], barajadas[i]]; }
  assert.equal(huella(calcular(barajadas, hoy)), huella(calcular(ses, hoy)));
}));

test("añadir calentamiento y aproximación (aunque pesen más) no cambia ninguna métrica de trabajo", () => cada((g) => {
  const modelos = historial(g);
  const hoy = sumarDias(modelos.at(-1).fecha, 2);
  const conCalentamiento = modelos.map((m) => ({ ...m, ejercicios: m.ejercicios.map((e) => ({ ...e, series: [
    { n: 0, tipo: "calentamiento", carga: { texto: "20 kg" }, reps: { texto: "10" }, rpe: 4, rir: null, nota: null },
    { n: 0, tipo: "aproximacion", carga: { texto: `${g.ent(80, 200)} kg` }, reps: { texto: String(g.ent(1, 5)) }, rpe: 10, rir: null, nota: null },
    ...e.series] })) }));
  assert.equal(huella(calcular(leer(conCalentamiento), hoy)), huella(calcular(leer(modelos), hoy)));
}));

test("pasar todas las cargas a libras y volver a kg da las mismas cifras", () => cada((g) => {
  const modelos = historial(g);
  const hoy = sumarDias(modelos.at(-1).fecha, 2);
  const enLibras = modelos.map((m) => ({ ...m, ejercicios: m.ejercicios.map((e) => ({ ...e, series: e.series.map((x) => {
    const kg = x.carga.texto.match(/^([\d.]+) kg$/);
    return kg ? { ...x, carga: { texto: `${Number(kg[1]) / 0.4536} lb` } } : x;
  }) })) }));
  const a = calcular(leer(modelos), hoy), b = calcular(leer(enLibras), hoy);
  // Mismas fechas de PR y récords; toneladas y e1RM iguales salvo el redondeo de coma flotante
  assert.deepEqual(b.prs.map((p) => [p.fecha, p.id]), a.prs.map((p) => [p.fecha, p.id]));
  assert.deepEqual(recordsPorEjercicio(b).map((r) => [r.id, r.fecha]), recordsPorEjercicio(a).map((r) => [r.id, r.fecha]));
  a.sesiones.forEach((s, i) => {
    assert.ok(Math.abs(b.sesiones[i].toneladas_kg - s.toneladas_kg) < 1e-6, `toneladas ${s.fecha}`);
    assert.equal(b.sesiones[i].series_trabajo, s.series_trabajo);
  });
  for (const [id, h] of a.porEjercicio) h.sesiones.forEach((s, k) => {
    const o = b.porEjercicio.get(id).sesiones[k];
    assert.ok(Math.abs((o.e1rm ?? 0) - (s.e1rm ?? 0)) < 1e-6, `e1RM ${id} ${s.fecha}`);
  });
}));
