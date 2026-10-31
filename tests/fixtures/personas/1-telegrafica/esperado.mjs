// Persona 1 (sintética): notas telegráficas en español, posiciones de máquina, libras, decimales
// con apóstrofo, un export de Telegram y un formato que cambia en 2025 («EJ1:»).
import { sesion, E, N, T } from "../dsl.mjs";

export const descripcion = "Notas telegráficas en español, máquinas por posición, libras, apóstrofos y cambio de formato";
export const convenciones = `# Mis convenciones

## Fechas
- orden: día/mes
- idioma: es

## Notación de series
- "3x8 60" = series × reps y carga en kg
- desde 2025-01: "EJ1:", "EJ2:"… marcan el inicio de cada ejercicio

## Unidades y máquinas
- "pin N" y "flecha N" = posición de máquina (nivel N)
- las mancuernas se apuntan por mano
- "12'5" = 12,5 (apóstrofo como coma decimal)

## Sensaciones
- escala: 0-10

## Abreviaturas propias
- "maq" = máquina
- "manc" = mancuerna
- "cuad" = cuádriceps
`;
export const bloques = [
  { tipo: "sesion", el: ["notas-2023.txt#1"], md: sesion({ fecha: "2023-03-12", titulo: "Pierna", tipo: "pierna" }, [
    E("sentadilla", "Sentadilla", N(3, "60 kg", 8)),
    E("prensa", "Prensa", N(3, "nivel 7", 12)),
    E("gemelo-pie", "Gemelo en máquina", N(4, "nivel 4", 15)),
    E("extension-cuadriceps", "Extensión de cuádriceps", N(3, "25 kg", 12)),
  ]) },
  { tipo: "sesion", el: ["notas-2023.txt#2"], md: sesion({ fecha: "2023-03-14", titulo: "Torso", tipo: "torso" }, [
    E("press-banca", "Press banca", N(3, "40 kg", 8)),
    E("jalon-pecho", "Jalón al pecho", N(3, "nivel 6", 10)),
    E("remo-mancuerna", "Remo con mancuerna", N(3, "12.5 kg/mano", 10)),
    E("elevaciones-laterales", "Elevaciones laterales", N(3, "5 lb/mano", 15)),
  ]) },
  { tipo: "sesion", el: ["notas-2023.txt#3"], md: sesion({ fecha: "2023-03-16", titulo: "Pierna", tipo: "pierna", molestias: [{ zona: "rodilla", lado: null, estado: "molestia" }] }, [
    E("sentadilla", "Sentadilla", N(3, "62.5 kg", 8)),
    E("prensa", "Prensa", N(3, "nivel 8", 12)),
  ], { notas: "Hoy nada más, rodilla molesta." }) },
  { tipo: "sesion", el: ["telegram/result.json#1"], md: sesion({ fecha: "2024-05-06", titulo: "Torso", tipo: "torso", inicio: "18:40" }, [
    E("press-banca", "Press banca", N(4, "52.5 kg", 6)),
    E("jalon-pecho", "Jalón al pecho", N(3, "nivel 7", 10)),
    E("fondos", "Fondos", N(3, "PC", 8)),
  ]) },
  { tipo: "sesion", el: ["telegram/result.json#3", "telegram/result.json#4"], md: sesion({ fecha: "2024-05-08", titulo: "Pierna", tipo: "pierna", inicio: "19:10", molestias: [{ zona: "rodilla", lado: null, estado: "bien" }] }, [
    E("sentadilla", "Sentadilla", N(4, "72.5 kg", 6)),
    E("prensa", "Prensa", N(3, "nivel 8", 12)),
  ], { notas: "Rodilla bien." }) },
  { tipo: "sesion", el: ["2025-entrenos.md#1"], md: sesion({ fecha: "2025-03-03", titulo: "Torso", tipo: "torso", sueno_h: 7, sensacion_post: 8 }, [
    E("press-banca", "Press banca", N(4, "60 kg", 6, { rpe: 8 })),
    E("remo-barra", "Remo con barra", N(4, "50 kg", 8)),
    E("press-militar", "Press militar", N(3, "32.5 kg", 8)),
  ], { notas: "Sensación 8/10, dormí 7 h." }) },
  { tipo: "sesion", el: ["2025-entrenos.md#2"], md: sesion({ fecha: "2025-03-05", titulo: "Pierna", tipo: "pierna", molestias: [{ zona: "rodilla", lado: null, estado: "bien" }] }, [
    E("sentadilla", "Sentadilla", N(5, "80 kg", 5, { rpe: 7.5 })),
    E("peso-muerto-rumano", "Peso muerto rumano", N(3, "70 kg", 8)),
    E("prensa", "Prensa", N(3, "nivel 9", 10)),
  ], { notas: "Rodilla bien." }) },
];
export const comprobar = { sesiones: 7, automaticos: 1, e1rm: { sentadilla: 80 * (1 + 5 / 30) } };
