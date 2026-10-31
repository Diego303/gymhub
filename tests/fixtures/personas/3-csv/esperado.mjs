// Persona 3 (sintética): el CSV exportado de una app de entreno (columnas en inglés).
import { sesion, E, N, T } from "../dsl.mjs";

export const descripcion = "CSV exportado de una app";
export const convenciones = `# Mis convenciones

## Fechas
- orden: año-mes-día (ISO, del CSV de la app)

## Notación de series
- una fila del CSV = una serie; "Seconds" = serie por tiempo

## Unidades y máquinas
- "Weight (kg)" en kg; "per hand" = kg por mano

## Abreviaturas propias
- los nombres de la app llevan el material entre paréntesis: "Bench Press (Barbell)" = press banca
`;
export const bloques = [
  { tipo: "sesion", el: ["export-app.csv#1"], md: sesion({ fecha: "2025-06-02", titulo: "Push A", tipo: "empuje", inicio: "07:05" }, [
    E("press-banca", "Bench Press (Barbell)", [T("70 kg", 8, { rpe: 7 }), T("70 kg", 8, { rpe: 8 }), T("70 kg", 7, { rpe: 9 })]),
    E("press-militar", "Overhead Press (Barbell)", [T("40 kg", 8, { rpe: 8 }), T("40 kg", 8, { rpe: 8.5 })]),
    E("triceps-polea", "Triceps Pushdown (Cable)", N(2, "25 kg", 12)),
  ]) },
  { tipo: "sesion", el: ["export-app.csv#2"], md: sesion({ fecha: "2025-06-04", titulo: "Pull A", tipo: "tiron", inicio: "07:10" }, [
    E("peso-muerto", "Deadlift (Barbell)", [T("120 kg", 5, { rpe: 8 }), T("120 kg", 5, { rpe: 8.5 })]),
    E("jalon-pecho", "Lat Pulldown (Cable)", N(2, "55 kg", 10)),
    E("curl-martillo", "Hammer Curl (Dumbbell)", [T("14 kg/mano", 10)]),
  ]) },
  { tipo: "sesion", el: ["export-app.csv#3"], md: sesion({ fecha: "2025-06-06", titulo: "Legs A", tipo: "pierna", inicio: "18:30" }, [
    E("sentadilla", "Squat (Barbell)", [T("90 kg", 6, { rpe: 7 }), T("90 kg", 6, { rpe: 8 }), T("90 kg", 6, { rpe: 8.5 })]),
    E("curl-femoral", "Leg Curl (Machine)", [T("40 kg", 12)]),
    E("plancha", "Plank", [T("PC", "60s")]),
  ]) },
];
export const comprobar = { sesiones: 3, automaticos: 0, e1rm: { "press-banca": 70 * (1 + 8 / 30) } };
