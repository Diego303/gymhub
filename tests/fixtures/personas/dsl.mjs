// DSL para escribir las sesiones esperadas de las personas sintéticas sin repetir tablas.
import { escribirSesion } from "../../../lib/canonico.mjs";

/** Una serie: T("80 kg", 5, { rpe: 8 }) */
export const T = (carga, reps, o = {}) => ({ tipo: o.tipo ?? "trabajo", carga, reps: String(reps), rpe: o.rpe ?? null, rir: o.rir ?? null, nota: o.nota ?? null });
/** n series iguales */
export const N = (n, carga, reps, o = {}) => Array.from({ length: n }, () => T(carga, reps, o));
/** Un ejercicio: E("press-banca", "Press banca", [series…], { ss: "A", orden: 1 }) */
export const E = (id, nombre, series, o = {}) => ({ id, nombre, series: series.flat(), superserie: o.ss ?? null, orden_superserie: o.orden ?? null });

export function sesion(meta, ejercicios = [], { cardio = [], notas = "", calentamiento = "" } = {}) {
  return escribirSesion({
    titulo: null, tipo: null, programa: null, semana_programa: null, inicio: null, fin: null, duracion_min: null,
    sueno_h: null, sensacion_pre: null, sensacion_post: null, peso_corporal_kg: null, molestias: [], fuente: null,
    confianza: "alta", ...meta,
    calentamiento, notas, original: null, otras: {},
    ejercicios: ejercicios.map((e) => ({ ...e, series: e.series.map((x, i) => ({ ...x, n: i + 1, carga: { texto: x.carga }, reps: { texto: x.reps } })) })),
    cardio: cardio.map((c) => ({ actividad: c.actividad, minutos: c.minutos ?? null, distancia_km: c.distancia_km ?? null, ritmo: c.ritmo ?? null, pulso_medio: c.pulso_medio ?? null, kcal: null, nota: c.nota ?? null })),
  });
}
