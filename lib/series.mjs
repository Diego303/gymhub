// Cifras de una serie: kg efectivos, e1RM (Epley), tonelaje y esfuerzo. Todo determinista.
import { TIPOS_TRABAJO, LB_A_KG } from "./canonico.mjs";

export const esTrabajo = (tipo) => TIPOS_TRABAJO.includes(tipo);

/** RPE de la serie, o 10 − RIR si solo hay RIR (FORMATO §2.1). */
export const rpeEfectivo = (s) => (s.rpe !== null && s.rpe !== undefined ? s.rpe : s.rir !== null && s.rir !== undefined ? 10 - s.rir : null);

/**
 * Kg de la carga tal como se escribe (por mano o por lado si lo pone), o null si no se puede saber.
 * - peso en lb → kg (× 0,4536)
 * - PC±n → peso corporal ± n, si se conoce el peso corporal
 * - nivel n → la equivalencia de convenciones.md, si la hay
 */
export function kgCarga(carga, { pesoCorporal = null, equivalencia = null } = {}) {
  switch (carga?.tipo) {
    case "peso": return carga.unidad === "lb" ? carga.valor * LB_A_KG : carga.valor;
    case "pc": return pesoCorporal ? pesoCorporal + (carga.extra || 0) : null;
    case "nivel": return equivalencia ? equivalencia.base + (carga.valor - equivalencia.nivel) * equivalencia.paso : null;
    case "banda": return null;
    default: return null;
  }
}

/** /lado y /mano cuentan doble para el volumen. */
export const factorVolumen = (carga) => (carga?.por === "lado" || carga?.por === "mano" ? 2 : 1);

/** Repeticiones para el e1RM: el número, o el menor de los dos lados en `8/8`. */
export const repsE1rm = (reps) => (reps?.tipo === "n" ? reps.n : reps?.tipo === "lados" ? reps.min : null);
/** Repeticiones para el volumen: el número, o la suma de los lados. */
export const repsVolumen = (reps) => (reps?.tipo === "n" || reps?.tipo === "lados" ? reps.n : 0);

/** Epley, de 1 a 10 repeticiones. Con 1 repetición, el propio peso. */
export function e1rm(kg, reps) {
  if (!kg || kg <= 0 || !reps || reps < 1 || reps > 10) return null;
  return reps === 1 ? kg : kg * (1 + reps / 30);
}

/**
 * Escala de progresión de una serie, para comparar series del mismo ejercicio:
 * kg (con e1RM), lastre (PC±n sin peso corporal), nivel, tiempo o reps.
 */
export function escalaSerie(carga, reps, kg) {
  if (kg !== null && repsE1rm(reps)) return "kg";
  if (carga?.tipo === "pc") return reps?.tipo === "tiempo" ? "tiempo" : "lastre";
  if (carga?.tipo === "nivel") return "nivel";
  if (reps?.tipo === "tiempo") return "tiempo";
  if (reps?.tipo === "n" || reps?.tipo === "lados") return "reps";
  return null;
}

/** Valor comparable [principal, desempate] de una serie en su escala. */
export function valorSerie(escala, x) {
  switch (escala) {
    case "kg": return [x.e1rm ?? 0, x.kg ?? 0];
    case "lastre": return [x.carga.extra ?? 0, repsE1rm(x.reps) ?? 0];
    case "nivel": return [x.carga.valor ?? 0, repsE1rm(x.reps) ?? 0];
    case "tiempo": return [x.reps.s ?? 0, x.carga?.extra ?? 0];
    case "reps": return [repsVolumen(x.reps), 0];
    default: return [0, 0];
  }
}
export const mayor = (a, b) => a[0] > b[0] + 1e-9 || (Math.abs(a[0] - b[0]) <= 1e-9 && a[1] > b[1] + 1e-9);
