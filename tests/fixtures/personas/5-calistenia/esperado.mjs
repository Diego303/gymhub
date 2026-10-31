// Persona 5 (sintética): calistenia y cardio por WhatsApp: lastre, asistidas, tiempos y distancias.
import { sesion, E, N, T } from "../dsl.mjs";

export const descripcion = "Calistenia y cardio: peso corporal, lastre, asistidas, tiempos y distancias";
export const convenciones = `# Mis convenciones

## Fechas
- orden: día/mes
- idioma: es

## Notación de series
- "lastre +10" = PC+10 kg; "asistidas -20kg" = PC-20 kg
- "3x45s" = series por tiempo

## Unidades y máquinas
- "peso 68 kg" = peso corporal de ese día

## Abreviaturas propias
- un mensaje por ejercicio; los mensajes del mismo día son la misma sesión
`;
export const bloques = [
  { tipo: "ejercicios", filas: ["| pino-pared | Pino contra la pared | handstand wall hold, pino pared | hombro | triceps, abdomen | peso-corporal | core | no |"] },
  { tipo: "sesion", el: ["chat-entrenos.txt#1", "chat-entrenos.txt#2", "chat-entrenos.txt#3", "chat-entrenos.txt#4", "chat-entrenos.txt#5"], md: sesion({ fecha: "2025-09-02", titulo: "Calistenia en el parque", tipo: "full", inicio: "07:12" }, [
    E("dominadas", "Dominadas lastradas", N(3, "PC+10 kg", 5)),
    E("fondos", "Fondos", N(3, "PC", 12)),
    E("dominadas", "Dominadas asistidas", N(2, "PC-20 kg", 8)),
    E("plancha", "Plancha", N(3, "PC", "45s")),
  ]) },
  { tipo: "sesion", el: ["chat-entrenos.txt#6"], md: sesion({ fecha: "2025-09-04", titulo: "Carrera", tipo: "cardio", inicio: "19:30" }, [], { cardio: [{ actividad: "correr", minutos: 27.5, distancia_km: 5, ritmo: "5:30/km", pulso_medio: 152 }] }) },
  { tipo: "sesion", el: ["chat-entrenos.txt#7", "chat-entrenos.txt#8"], md: sesion({ fecha: "2025-09-06", titulo: "Equilibrios", tipo: "hombro", inicio: "08:05" }, [
    E("pino-pared", "Pino contra la pared", N(3, "PC", "30s")),
    E("flexiones-pino", "Flexiones en pino", N(3, "PC", 5)),
    E("l-sit", "L-sit", N(4, "PC", "15s")),
  ]) },
  { tipo: "sesion", el: ["chat-entrenos.txt#10"], md: sesion({ fecha: "2025-09-08", titulo: "Bici", tipo: "cardio", inicio: "18:00" }, [], { cardio: [{ actividad: "bici", minutos: 40, nota: "suave" }] }) },
  { tipo: "sesion", el: ["chat-entrenos.txt#11"], md: sesion({ fecha: "2025-09-13", titulo: "Calistenia", tipo: "full", inicio: "10:00", peso_corporal_kg: 68 }, [
    E("dominadas", "Dominadas lastradas", N(3, "PC+12.5 kg", 5)),
    E("muscle-up", "Muscle-up", N(3, "PC", 2)),
  ]) },
];
export const comprobar = { sesiones: 5, automaticos: 1, e1rm: { dominadas: (68 + 12.5) * (1 + 5 / 30) } };
