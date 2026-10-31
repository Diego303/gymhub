// Persona 4 (sintética): plantillas con prescripción y ejecución, RIR, sueño y sensaciones de 1 a 5.
import { sesion, E, N, T } from "../dsl.mjs";

export const descripcion = "Plantillas con prescripción y ejecución, RIR, sueño y sensaciones 1-5";
export const convenciones = `# Mis convenciones

## Fechas
- orden: año-mes-día (ISO)

## Notación de series
- "prescrito" = lo planificado (va a nota); "hecho:" = lo realizado (las filas)
- "100×6" = carga × reps; "75×6 ×4" = 4 series iguales
- "(RIR n)" al final de la línea = el de la última serie
- "___" = hueco de plantilla sin rellenar: no se hizo

## Sensaciones
- escala: 1-5 → se multiplica por 2 para pasar a 0-10
`;
const nota = (t) => ({ nota: t });
export const bloques = [
  { tipo: "ignorar", el: ["bloque-fuerza.md#1"], motivo: "cabecera del bloque (programa y semana van en cada sesión)" },
  { tipo: "sesion", el: ["bloque-fuerza.md#2"], md: sesion({ fecha: "2025-09-08", titulo: "Día A", tipo: "full", programa: "Bloque fuerza", semana_programa: 3, sueno_h: 7.5, sensacion_pre: 6, sensacion_post: 8 }, [
    E("sentadilla", "Sentadilla", [T("100 kg", 6, nota("prescrito 4×6 @ 75% · 3 min")), T("100 kg", 6), T("100 kg", 5), T("95 kg", 6, { rir: 1 })]),
    E("press-banca", "Press banca", [T("75 kg", 6, { rir: 2, nota: "prescrito 4×6 @ 75%" }), ...N(3, "75 kg", 6, { rir: 2 })]),
    E("remo-barra", "Remo con barra", [T("60 kg", 10, nota("prescrito 3×10 · RIR 2")), T("60 kg", 10), T("60 kg", 9)]),
  ], { notas: "Buen día, la última de sentadilla costó." }) },
  { tipo: "sesion", el: ["bloque-fuerza.md#3"], md: sesion({ fecha: "2025-09-10", titulo: "Día B", tipo: "full", programa: "Bloque fuerza", semana_programa: 3, sueno_h: 6, sensacion_pre: 4, sensacion_post: 6 }, [
    E("peso-muerto", "Peso muerto", [T("140 kg", 5, nota("prescrito 3×5 @ 80% · 4 min")), T("140 kg", 5), T("140 kg", 4, { rir: 0 })]),
    E("press-militar", "Press militar", [T("", "", { tipo: "no_hecho", nota: "prescrito 3×8; no me dio tiempo" })]),
    E("dominadas", "Dominadas", [T("PC", 9, { tipo: "amrap" }), T("PC", 7, { tipo: "amrap" }), T("PC", 6, { tipo: "amrap" })]),
  ], { notas: "Dormí fatal. Militar no me dio tiempo." }) },
  { tipo: "plantilla", nombre: "Día A", el: ["programa.md#1"], md: "---\nnombre: Día A\ntipo: full\ndia: lunes\n---\n- Sentadilla · 4×6\n- Press banca · 4×6\n- Remo con barra · 3×10" },
  { tipo: "plantilla", nombre: "Día B", el: ["programa.md#1"], md: "---\nnombre: Día B\ntipo: full\ndia: miércoles\n---\n- Peso muerto · 3×5\n- Press militar · 3×8\n- Dominadas · 3×AMRAP" },
  { tipo: "plantilla", nombre: "Día C", el: ["programa.md#1"], md: "---\nnombre: Día C\ntipo: full\ndia: viernes\n---\n- Sentadilla frontal · 3×8\n- Press inclinado · 3×10\n- Jalón al pecho · 3×12" },
];
export const comprobar = { sesiones: 2, automaticos: 0, plantillas: 3, e1rm: { "peso-muerto": 140 * (1 + 5 / 30) } };
