// Historial inventado de 5 años para medir el rendimiento: ~1.000 sesiones y ~20.000 series de trabajo
// (4 ejercicios × 5 series por sesión, 4 sesiones por semana), con notas, molestias, pausas y cardio.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { escribirSesion } from "../../lib/canonico.mjs";
import { sumarDias, diaSemana } from "../../lib/util.mjs";
import { prng } from "./aleatorio.mjs";

const RUTINAS = [
  ["empuje", ["press-banca", "press-militar", "fondos", "triceps-polea"]],
  ["tiron", ["dominadas", "remo-barra", "jalon-pecho", "curl-barra"]],
  ["pierna", ["sentadilla", "peso-muerto-rumano", "prensa", "hip-thrust"]],
  ["full", ["peso-muerto", "press-banca", "remo-barra", "plancha"]],
];

/** Escribe ~1.000 sesiones entre 2021-11-01 y `hasta` en `carpeta`. Devuelve cuántas sesiones y series. */
export function generarCincoAnios(carpeta, { hasta = "2026-10-31", semilla = 1234 } = {}) {
  const g = prng(semilla);
  let n = 0, series = 0, k = 0;
  for (let f = "2021-11-01"; f <= hasta; f = sumarDias(f, 1)) {
    if (![0, 1, 3, 4].includes(diaSemana(f))) continue;
    if (f >= "2023-08-01" && f <= "2023-08-14") continue; // vacaciones
    const [tipo, ids] = RUTINAS[k++ % RUTINAS.length];
    const progreso = 1 + n / 2500;
    const ejercicios = ids.map((id, j) => ({
      id, nombre: id, superserie: null, orden_superserie: null, nota: null,
      series: Array.from({ length: 5 }, (_, i) => ({ n: i + 1, tipo: "trabajo", carga: { texto: id === "plancha" ? "PC" : id === "dominadas" ? `PC+${Math.round(5 * progreso)} kg` : `${Math.round((40 + 15 * j) * progreso / 2.5) * 2.5} kg` },
        reps: { texto: id === "plancha" ? "45s" : String(5 + (i % 4)) }, rpe: 7 + (i % 3) * 0.5, rir: null, nota: null })),
    }));
    series += ejercicios.length * 5;
    const dir = join(carpeta, "sesiones", f.slice(0, 4));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${f}.md`), escribirSesion({
      fecha: f, titulo: tipo, tipo, programa: `Bloque ${1 + Math.floor(n / 48)}`, semana_programa: 1 + (Math.floor(n / 4) % 12), inicio: "18:30", fin: null, duracion_min: 70,
      sueno_h: 6 + (n % 5) * 0.5, sensacion_pre: 5 + (n % 5), sensacion_post: 6 + (n % 4), peso_corporal_kg: n % 20 === 0 ? 78 + (n % 7) * 0.3 : null,
      molestias: n % 37 === 0 ? [{ zona: "hombro", lado: "izq", estado: g.uno(["molestia", "bien"]) }] : [], fuente: "historial inventado de 5 años", confianza: "alta",
      calentamiento: "", ejercicios, cardio: n % 9 === 0 ? [{ actividad: "bici", minutos: 20, distancia_km: 8, ritmo: null, pulso_medio: 130, kcal: null, nota: null }] : [],
      notas: `Sesión ${n + 1}: bien, ${g.uno(["con energía", "algo cansado", "muy sólido", "regular"])}.`, original: `entreno ${n + 1}`, otras: {}, extra: {},
    }));
    n++;
  }
  writeFileSync(join(carpeta, "eventos.md"), "# Eventos\n\n- 2023-08-01 → 2023-08-14 · pausa · vacaciones\n");
  return { sesiones: n, series };
}
