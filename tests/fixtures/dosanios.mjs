// Persona sintética «controlada» de 2 años, para verificar a mano las métricas de Análisis.
// 104 semanas (lunes 2024-11-04 → jueves 2026-10-29), dos sesiones por semana (w = 0…103):
//   lunes 07:00 (torso, sueño 8 h, pre 7): press banca 3×5 a (60 + 0,5·w) kg · remo con barra 3×8 a 50 kg
//                                          · press militar 3×5 a (40 + 0,25·w) kg
//   jueves 19:00 (pierna, sueño 6 h, pre 7): sentadilla 3×5 a (80 + 0,5·w) kg · peso muerto 1×5 a 140 kg
//                                          · curl femoral 3×10 a 40 kg · dominadas 3×5 a PC+10 kg (PC = 80 kg)
// Todas las series de trabajo a RPE 8. Las cuentas hechas a mano están en tests/analisis.test.mjs.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { escribirSesion } from "../../lib/canonico.mjs";
import { sumarDias } from "../../lib/util.mjs";

const serie = (carga, reps) => ({ tipo: "trabajo", carga: { texto: carga }, reps: { texto: String(reps) }, rpe: 8, rir: null, nota: null });
const ej = (id, nombre, n, carga, reps) => ({ id, nombre, superserie: null, orden_superserie: null, series: Array.from({ length: n }, (_, i) => ({ ...serie(carga, reps), n: i + 1 })) });
const kg = (x) => `${Math.round(x * 100) / 100} kg`;

export function generarDosAnios(carpeta) {
  for (let w = 0; w < 104; w++) {
    const lunes = sumarDias("2024-11-04", 7 * w), jueves = sumarDias(lunes, 3);
    const base = { programa: null, semana_programa: null, fin: null, duracion_min: 60, sensacion_post: 8, peso_corporal_kg: null, molestias: [], fuente: "persona sintética de 2 años", confianza: "alta", calentamiento: "", cardio: [], otras: {}, original: "sintético", extra: {} };
    const sesiones = [
      { ...base, fecha: lunes, titulo: "Torso", tipo: "torso", inicio: "07:00", sueno_h: 8, sensacion_pre: 7, notas: w % 10 === 0 ? "La banca salió fluida." : "",
        ejercicios: [ej("press-banca", "Press banca", 3, kg(60 + 0.5 * w), 5), ej("remo-barra", "Remo con barra", 3, "50 kg", 8), ej("press-militar", "Press militar", 3, kg(40 + 0.25 * w), 5)] },
      { ...base, fecha: jueves, titulo: "Pierna", tipo: "pierna", inicio: "19:00", sueno_h: 6, sensacion_pre: 7, notas: "",
        ejercicios: [ej("sentadilla", "Sentadilla", 3, kg(80 + 0.5 * w), 5), ej("peso-muerto", "Peso muerto", 1, "140 kg", 5), ej("curl-femoral", "Curl femoral", 3, "40 kg", 10), ej("dominadas", "Dominadas", 3, "PC+10 kg", 5)] },
    ];
    for (const s of sesiones) {
      const dir = join(carpeta, "sesiones", s.fecha.slice(0, 4));
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `${s.fecha}.md`), escribirSesion(s));
    }
  }
  writeFileSync(join(carpeta, "FICHA.md"), `# Ficha
## Objetivos
- dias_semana: 2
- sentadilla: 170 kg
- press-banca: 140 kg
- peso-muerto: 200 kg
- press-militar: 80 kg
## Series objetivo por semana
pecho 3 · espalda 6 · cuadriceps 3 · femoral 4
## Datos
- peso_corporal: 80 kg
- sueno_objetivo: 7 h
`);
}
