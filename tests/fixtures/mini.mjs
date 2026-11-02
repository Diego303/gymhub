// Fixture «mini» (inventado): 11 sesiones en 4 semanas, con «hoy» = jueves 2026-11-05 (W45).
// Las cifras de cada vista están calculadas a mano en tests/metricas.test.mjs. Peso corporal 80 kg
// (FICHA), objetivo 3 días por semana, press banca 100 kg y sentadilla 130 kg.
//
//   W42 (12-18 oct)  lun 12 banca 72,5×5×3 · mié 14 sentadilla 87,5×5×3 · vie 16 banca 75×4×3
//   W43 (19-25 oct)  lun 19 banca 75×5×3 + remo 57,5×8×3 · mié 21 sentadilla 90×5×3 · vie 23 banca 77,5×4×3
//   W44 (26 oct-1)   lun 26 banca 77,5×5×3 + remo 60×8×3 · mié 28 sentadilla 95×5×3 · vie 30 banca 80×4×3
//   W45 (2-8 nov)    lun 2 calentamiento banca 40×10 + banca 80×5×3 @8 + remo 60×8×3 @7 (sueño 7 h)
//                    mié 4 sentadilla 100×5×3 @8 + dominadas PC+10 kg ×5×2 (sueño 6,5 h, pre 7, hombro izq. molestia)
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { escribirSesion } from "../../lib/canonico.mjs";

export const HOY = "2026-11-05";

const serie = (n, tipo, carga, reps, rpe = null) => ({ n, tipo, carga: { texto: carga }, reps: { texto: String(reps) }, rpe, rir: null, nota: null });
const ej = (id, nombre, filas) => ({ id, nombre, superserie: null, orden_superserie: null, nota: null, series: filas.map((f, i) => serie(i + 1, ...f)) });
const x3 = (carga, reps, rpe = null) => [["trabajo", carga, reps, rpe], ["trabajo", carga, reps, rpe], ["trabajo", carga, reps, rpe]];
const banca = (carga, reps, rpe) => ej("press-banca", "Press banca", x3(carga, reps, rpe));
const remo = (carga, rpe) => ej("remo-barra", "Remo con barra", x3(carga, 8, rpe));
const sentadilla = (carga, rpe) => ej("sentadilla", "Sentadilla", x3(carga, 5, rpe));

export const SESIONES = [
  { fecha: "2026-10-12", titulo: "Torso", tipo: "torso", ejercicios: [banca("72.5 kg", 5)] },
  { fecha: "2026-10-14", titulo: "Pierna", tipo: "pierna", ejercicios: [sentadilla("87.5 kg")] },
  { fecha: "2026-10-16", titulo: "Torso", tipo: "torso", ejercicios: [banca("75 kg", 4)] },
  { fecha: "2026-10-19", titulo: "Torso", tipo: "torso", ejercicios: [banca("75 kg", 5), remo("57.5 kg")] },
  { fecha: "2026-10-21", titulo: "Pierna", tipo: "pierna", ejercicios: [sentadilla("90 kg")] },
  { fecha: "2026-10-23", titulo: "Torso", tipo: "torso", ejercicios: [banca("77.5 kg", 4)] },
  { fecha: "2026-10-26", titulo: "Torso", tipo: "torso", ejercicios: [banca("77.5 kg", 5), remo("60 kg")] },
  { fecha: "2026-10-28", titulo: "Pierna", tipo: "pierna", ejercicios: [sentadilla("95 kg")] },
  { fecha: "2026-10-30", titulo: "Torso", tipo: "torso", ejercicios: [banca("80 kg", 4)] },
  { fecha: "2026-11-02", titulo: "Torso", tipo: "torso", sueno_h: 7, notas: "Banca muy sólida hoy.", ejercicios: [ej("press-banca", "Press banca", [["calentamiento", "40 kg", 10], ...x3("80 kg", 5, 8)]), remo("60 kg", 7)] },
  { fecha: "2026-11-04", titulo: "Pierna", tipo: "pierna", sueno_h: 6.5, sensacion_pre: 7, molestias: [{ zona: "hombro", lado: "izq", estado: "molestia" }],
    ejercicios: [sentadilla("100 kg", 8), ej("dominadas", "Dominadas", [["trabajo", "PC+10 kg", 5], ["trabajo", "PC+10 kg", 5]])] },
];

export const FICHA = `# Ficha
## Objetivos
- dias_semana: 3
- press-banca: 100 kg
- sentadilla: 130 kg
## Series objetivo por semana
pecho 10 · pierna 12 · espalda 9
## Datos
- peso_corporal: 80 kg
`;

/** Escribe la carpeta (sesiones, FICHA.md y el catálogo de la plantilla) dentro de `carpeta`. */
export function generarMini(carpeta, { catalogo }) {
  for (const s of SESIONES) {
    const dir = join(carpeta, "sesiones", s.fecha.slice(0, 4));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${s.fecha}.md`), escribirSesion({
      programa: null, semana_programa: null, inicio: "18:00", fin: null, duracion_min: 60, sueno_h: null, sensacion_pre: null, sensacion_post: null,
      peso_corporal_kg: null, molestias: [], fuente: "fixture mini", confianza: "alta", calentamiento: "", cardio: [], notas: "", original: "inventado", otras: {}, extra: {},
      ...s,
    }));
  }
  writeFileSync(join(carpeta, "FICHA.md"), FICHA);
  writeFileSync(join(carpeta, "ejercicios.md"), catalogo);
  mkdirSync(join(carpeta, ".gymhub"), { recursive: true });
}
