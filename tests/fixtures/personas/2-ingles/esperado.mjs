// Persona 2 (sintética): en inglés, «3x5 @ 185 lb RPE 8», fechas mes/día y superseries.
import { sesion, E, N, T } from "../dsl.mjs";

export const descripcion = "Inglés, libras, RPE, fechas mes/día y superseries";
export const convenciones = `# Mis convenciones

## Fechas
- orden: mes/día
- idioma: en

## Notación de series
- "3x5 @ 185 lb" = series × reps @ carga
- "225x5, 235x5" = carga × reps de cada serie
- "RPE 9" al final de la línea = el de la última serie
- "A1", "A2" = superserie

## Unidades y máquinas
- carga en libras (lb)
- "BW" = peso corporal (PC)
- "DB" = mancuernas, por mano

## Sensaciones
- escala: 0-10
`;
export const bloques = [
  { tipo: "ignorar", el: ["training-log.md#1"], motivo: "cabecera del fichero (año 2025)" },
  { tipo: "sesion", el: ["training-log.md#2"], md: sesion({ fecha: "2025-03-14", titulo: "Upper", tipo: "torso" }, [
    E("press-banca", "Bench", N(3, "185 lb", 5, { rpe: 8 })),
    E("dominadas", "Pull-ups", N(3, "PC", 8), { ss: "A", orden: 1 }),
    E("fondos", "Dips", N(3, "PC", 10), { ss: "A", orden: 2 }),
    E("curl-mancuernas", "DB curls", N(3, "30 lb/mano", 12)),
  ]) },
  { tipo: "sesion", el: ["training-log.md#3"], md: sesion({ fecha: "2025-03-16", titulo: "Lower", tipo: "pierna", molestias: [{ zona: "rodilla", lado: null, estado: "molestia" }] }, [
    E("sentadilla", "Squat", [T("225 lb", 5), T("235 lb", 5), T("245 lb", 3, { rpe: 9 })]),
    E("peso-muerto-rumano", "RDL", N(3, "185 lb", 8)),
    E("prensa", "Leg press", N(3, "360 lb", 12)),
  ], { notas: "Knee felt a bit off." }) },
  { tipo: "sesion", el: ["training-log.md#4"], md: sesion({ fecha: "2025-03-19", titulo: "Upper", tipo: "torso" }, [
    E("press-banca", "Bench", N(3, "190 lb", 5, { rpe: 8.5 })),
    E("press-militar", "OHP", N(3, "105 lb", 6)),
    E("jalon-pecho", "Lat pulldown", N(3, "140 lb", 10), { ss: "A", orden: 1 }),
    E("face-pull", "Face pulls", N(3, "40 lb", 15), { ss: "A", orden: 2 }),
  ]) },
  { tipo: "sesion", el: ["april-2025.txt#1"], md: sesion({ fecha: "2025-04-02", titulo: "Full body - deload", tipo: "full" }, [
    E("sentadilla", "Squat", N(3, "185 lb", 5, { rpe: 6 })),
    E("press-banca", "Bench", N(3, "155 lb", 5, { rpe: 6 })),
    E("remo-barra", "Rows", N(3, "135 lb", 10)),
  ]) },
  { tipo: "ignorar", el: ["april-2025.txt#2"], motivo: "no entrenó (enfermo)" },
  { tipo: "revision", lineas: ["2025-04-02 · \"Rows\" sin más detalle: ¿remo con barra? → remo-barra"] },
];
// 235 lb × 5 (124,4 kg) supera a 245 lb × 3 (122,2 kg)
export const comprobar = { sesiones: 4, automaticos: 0, e1rm: { sentadilla: 235 * 0.4536 * (1 + 5 / 30) } };
