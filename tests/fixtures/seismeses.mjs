// Persona sintética de 6 meses para la pestaña Semana: 26 semanas, del lunes 2026-05-04 (W19) a
// la semana del 2026-10-26 (W44), con «hoy» = sábado 2026-10-31. Objetivo: 3 días por semana.
//   A (lunes, sueño 7 h):     press banca 3×5 a (60 + w) kg      → 15·(60+w) kg, e1RM (60+w)·7/6
//   B (miércoles, sueño 6 h): sentadilla 3×5 a 100 kg            → 1500 kg
//   C (viernes, sueño 8 h):   remo con barra 3×8 a 60 kg         → 1440 kg, e1RM 76
// Sesiones por semana (3 = A+B+C, 2 = A+B, 1 = A, 0 = ninguna); la semana 10 (13-19 jul) es una
// pausa declarada. Hombro izquierdo con molestia en A de w24 y en A y C de w25.
// Las cuentas hechas a mano están en tests/semanas.test.mjs.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { escribirSesion } from "../../lib/canonico.mjs";
import { sumarDias } from "../../lib/util.mjs";

export const PATRON = [3, 3, 2, 3, 3, 1, 3, 3, 3, 3, 0, 3, 3, 2, 3, 3, 3, 0, 3, 3, 3, 3, 3, 3, 2, 3];
export const PAUSA = 10;

const ej = (id, nombre, n, carga, reps) => ({ id, nombre, superserie: null, orden_superserie: null, series: Array.from({ length: n }, (_, i) => ({ n: i + 1, tipo: "trabajo", carga: { texto: carga }, reps: { texto: String(reps) }, rpe: 8, rir: null, nota: null })) });

export function generarSeisMeses(carpeta) {
  PATRON.forEach((s, w) => {
    const lunes = sumarDias("2026-05-04", 7 * w);
    const hombro = (cual) => (w === 25 && (cual === "A" || cual === "C")) || (w === 24 && cual === "A") ? [{ zona: "hombro", lado: "izq", estado: "molestia" }] : [];
    const tipos = [
      { k: "A", fecha: lunes, titulo: "Empuje", tipo: "empuje", sueno: 7, ejercicios: [ej("press-banca", "Press banca", 3, `${60 + w} kg`, 5)] },
      { k: "B", fecha: sumarDias(lunes, 2), titulo: "Pierna", tipo: "pierna", sueno: 6, ejercicios: [ej("sentadilla", "Sentadilla", 3, "100 kg", 5)] },
      { k: "C", fecha: sumarDias(lunes, 4), titulo: "Tirón", tipo: "tiron", sueno: 8, ejercicios: [ej("remo-barra", "Remo con barra", 3, "60 kg", 8)] },
    ].slice(0, s);
    for (const t of tipos) {
      const dir = join(carpeta, "sesiones", t.fecha.slice(0, 4));
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `${t.fecha}.md`), escribirSesion({
        fecha: t.fecha, titulo: t.titulo, tipo: t.tipo, programa: null, semana_programa: null, inicio: "18:00", fin: null, duracion_min: 60,
        sueno_h: t.sueno, sensacion_pre: 7, sensacion_post: 8, peso_corporal_kg: null, molestias: hombro(t.k), fuente: "persona sintética de 6 meses",
        confianza: "alta", calentamiento: "", ejercicios: t.ejercicios, cardio: [], notas: "", original: "sintético", otras: {}, extra: {},
      }));
    }
  });
  writeFileSync(join(carpeta, "eventos.md"), "# Eventos\n\n- 2026-07-13 → 2026-07-19 · pausa · vacaciones\n");
  writeFileSync(join(carpeta, "FICHA.md"), "# Ficha\n## Objetivos\n- dias_semana: 3\n## Series objetivo por semana\npecho 3 · espalda 4 · pierna 4\n");
}
