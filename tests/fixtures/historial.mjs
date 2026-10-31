// Historial SINTÉTICO de ~2 años para probar y enseñar la web (nada es de una persona real).
// Determinista: misma semilla → mismas sesiones.
//   import { generarHistorial } from "./historial.mjs"; generarHistorial("/tmp/G", { hoy: "2026-10-31" })
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { escribirSesion } from "../../lib/canonico.mjs";
import { sumarDias, diaSemana, diasEntre } from "../../lib/util.mjs";

function azar(semilla) {
  let s = semilla >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const redondearDisco = (kg, paso = 2.5) => Math.max(paso, Math.round(kg / paso) * paso);

// e1RM de partida y de llegada (kg) de los principales, y su forma de progresar.
const LEVANTAMIENTOS = {
  "sentadilla": { nombre: "Sentadilla", ini: 92, fin: 128, estanca: [0.45, 0.55] },
  "press-banca": { nombre: "Press banca", ini: 70, fin: 93, estanca: [0.6, 0.68] },
  "peso-muerto": { nombre: "Peso muerto", ini: 115, fin: 158, estanca: [0.8, 1.0] },
  "press-militar": { nombre: "Press militar", ini: 42, fin: 56, estanca: [0.85, 1.0] },
  "remo-barra": { nombre: "Remo con barra", ini: 60, fin: 80 },
  "hip-thrust": { nombre: "Hip thrust", ini: 80, fin: 140 },
  "peso-muerto-rumano": { nombre: "Peso muerto rumano", ini: 70, fin: 105 },
  "prensa": { nombre: "Prensa de piernas", ini: 150, fin: 230 },
  "jalon-pecho": { nombre: "Jalón al pecho", ini: 50, fin: 70 },
};

const RUTINAS = {
  empuje: { titulo: "Empuje", tipo: "empuje", ejercicios: [["press-banca", 4, [5, 6]], ["press-militar", 3, [6, 8]], ["fondos", 3, [8, 12], "pc"], ["triceps-polea", 3, [10, 12], 25], ["elevaciones-laterales", 3, [12, 15], "8 kg/mano"]] },
  pierna: { titulo: "Pierna A", tipo: "pierna", ejercicios: [["sentadilla", 5, [5, 5]], ["peso-muerto-rumano", 3, [8, 8]], ["prensa", 3, [10, 12]], ["curl-femoral", 3, [10, 12], 40], ["gemelo-pie", 4, [12, 15], "nivel 9"]] },
  tiron: { titulo: "Tirón", tipo: "tiron", ejercicios: [["peso-muerto", 3, [3, 5]], ["dominadas", 4, [5, 8], "lastre"], ["remo-barra", 3, [8, 10]], ["curl-barra", 3, [8, 10], 30], ["face-pull", 3, [15, 15], 20]] },
  gluteo: { titulo: "Pierna B", tipo: "pierna-gluteo", ejercicios: [["hip-thrust", 4, [8, 10]], ["sentadilla-bulgara", 3, [8, 10], "14 kg/mano"], ["extension-cuadriceps", 3, [12, 15], 45], ["jalon-pecho", 3, [10, 12]], ["plancha", 3, ["45s", "60s"], "pc-tiempo"]] },
};
// lunes, martes, jueves, sábado
const AGENDA = { 0: "empuje", 1: "pierna", 3: "tiron", 5: "gluteo" };

const NOTAS = {
  bien: ["Buena sesión, todo fluido.", "Me noto más fuerte en {ej}.", "Sentadilla profunda y estable.", "Subí peso en {ej} y salieron todas.", "Ritmo bueno, descansos cortos."],
  regular: ["Llegué cansado, pero salí mejor.", "Poco sueño, bajé peso en la primera serie.", "Sesión justa, la última de {ej} costó.", "Día flojo, me limité a cumplir."],
};

/**
 * Escribe en `carpeta` (ya creada con configurar) unas 380 sesiones, eventos.md, FICHA.md y
 * plantillas. Devuelve { sesiones, desde, hasta }.
 */
export function generarHistorial(carpeta, { hoy = "2026-10-31", semanas = 104, semilla = 7 } = {}) {
  const rnd = azar(semilla);
  const desde = sumarDias(hoy, -7 * semanas - diaSemana(hoy));
  const pausa = ["2025-08-04", "2025-08-17"];
  const fechas = [];
  for (let f = desde; f <= hoy; f = sumarDias(f, 1)) {
    const r = AGENDA[diaSemana(f)];
    if (!r) continue;
    if (f >= pausa[0] && f <= pausa[1]) continue;
    const reciente = diasEntre(f, hoy) < 21;
    if (!reciente && rnd() < 0.12) continue; // ~88 % de adherencia
    if (f === hoy) continue; // hoy todavía no ha entrenado
    fechas.push([f, r]);
  }
  const total = diasEntre(desde, hoy);
  let n = 0;
  for (const [fecha, clave] of fechas) {
    n++;
    const t = diasEntre(desde, fecha) / total; // 0 → 1
    const semanaPrograma = (Math.floor(diasEntre(desde, fecha) / 7) % 12) + 1;
    const descarga = semanaPrograma === 6 || semanaPrograma === 12;
    const sueno = Math.round((5.5 + rnd() * 3) * 2) / 2;
    const bienDormido = sueno >= 7;
    const rutina = RUTINAS[clave];
    const ejercicios = [];
    const molestias = [];
    const reciente = diasEntre(fecha, hoy);
    if (reciente <= 12 && (clave === "empuje" || clave === "tiron" || clave === "gluteo")) molestias.push({ zona: "hombro", lado: "izq", estado: "molestia" });
    else if (reciente <= 40 && reciente > 12 && clave === "empuje" && rnd() < 0.5) molestias.push({ zona: "hombro", lado: "izq", estado: "bien" });
    if ((clave === "pierna" || clave === "gluteo") && rnd() < 0.12) molestias.push({ zona: "rodilla", lado: null, estado: rnd() < 0.8 ? "molestia" : "bien" });
    if (fecha >= "2025-05-12" && fecha <= "2025-05-24" && clave !== "empuje") molestias.push({ zona: "lumbar", lado: null, estado: fecha <= "2025-05-15" ? "dolor" : "molestia" });
    for (const [id, series, [r1, r2], extra] of rutina.ejercicios) {
      const L = LEVANTAMIENTOS[id];
      const filas = [];
      if (L) {
        let p = t;
        if (L.estanca && t >= L.estanca[0]) p = L.estanca[0] + (t - L.estanca[0]) * (t <= L.estanca[1] ? 0.05 : 0.8);
        if (L.estanca && L.estanca[1] === 1.0 && t >= L.estanca[0]) p = L.estanca[0];
        const forma = 1 - Math.pow(1 - Math.min(1, p), 1.4);
        let e1 = (L.ini + (L.fin - L.ini) * forma) * (1 + (rnd() - 0.5) * 0.04) * (bienDormido ? 1.02 : 0.985);
        if (descarga) e1 *= 0.82;
        const reps = r1 + Math.floor(rnd() * (r2 - r1 + 1));
        const kg = redondearDisco(e1 / (1 + reps / 30));
        if (["sentadilla", "press-banca", "peso-muerto", "press-militar"].includes(id)) {
          filas.push({ tipo: "aproximacion", carga: "20 kg", reps: "10" }, { tipo: "aproximacion", carga: `${redondearDisco(kg * 0.6)} kg`, reps: "5" });
        }
        for (let s = 0; s < series; s++) {
          const ultima = s === series - 1;
          const rpe = descarga ? 6.5 : Math.min(10, 7 + s * 0.5 + (bienDormido ? 0 : 0.5));
          filas.push({ tipo: "trabajo", carga: `${kg} kg`, reps: String(ultima && rnd() < 0.3 ? Math.max(1, reps - 1) : reps), rpe: s === 0 && rnd() < 0.3 ? null : rpe, rir: null });
        }
      } else if (extra === "pc") {
        for (let s = 0; s < series; s++) filas.push({ tipo: "trabajo", carga: "PC", reps: String(r1 + Math.floor(rnd() * (r2 - r1 + 1))), rpe: null, rir: 2 });
      } else if (extra === "lastre") {
        const lastre = redondearDisco(5 + 15 * t, 2.5);
        for (let s = 0; s < series; s++) filas.push({ tipo: "trabajo", carga: descarga ? "PC" : `PC+${lastre} kg`, reps: String(r1 + Math.floor(rnd() * (r2 - r1 + 1))), rpe: 8, rir: null });
      } else if (extra === "pc-tiempo") {
        for (let s = 0; s < series; s++) filas.push({ tipo: "trabajo", carga: "PC", reps: t > 0.5 ? r2 : r1, rpe: null, rir: null });
      } else {
        const carga = typeof extra === "number" ? `${redondearDisco(extra * (1 + 0.35 * t))} kg` : extra;
        for (let s = 0; s < series; s++) filas.push({ tipo: "trabajo", carga, reps: String(r1 + Math.floor(rnd() * (r2 - r1 + 1))), rpe: null, rir: rnd() < 0.5 ? 2 : 1 });
      }
      ejercicios.push({ id, nombre: L?.nombre ?? id.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()), superserie: null, orden_superserie: null, series: filas.map((x, i) => ({ n: i + 1, tipo: x.tipo, carga: { texto: x.carga }, reps: { texto: x.reps }, rpe: x.rpe ?? null, rir: x.rir ?? null, nota: null })) });
    }
    const tono = bienDormido && rnd() < 0.75 ? "bien" : "regular";
    const ej = rutina.ejercicios[0][0].replace(/-/g, " ");
    const nota = NOTAS[tono][Math.floor(rnd() * NOTAS[tono].length)].replace("{ej}", ej);
    const pre = Math.max(3, Math.min(10, Math.round((bienDormido ? 7 : 6) + (rnd() - 0.5) * 3)));
    const s = {
      fecha, titulo: rutina.titulo, tipo: rutina.tipo, programa: "Fuerza 12 semanas", semana_programa: semanaPrograma,
      inicio: rnd() < 0.7 ? "18:30" : "07:15", fin: null, duracion_min: 60 + Math.floor(rnd() * 25), sueno_h: sueno,
      sensacion_pre: pre, sensacion_post: Math.min(10, pre + (rnd() < 0.7 ? 1 : 0)), peso_corporal_kg: n % 10 === 0 ? Math.round((78 + 2 * t + (rnd() - 0.5)) * 10) / 10 : null,
      molestias, fuente: "historial sintético", confianza: "alta", calentamiento: "", otras: {},
      ejercicios, cardio: rnd() < 0.15 ? [{ actividad: "cinta", minutos: 20, distancia_km: 2.5, ritmo: null, pulso_medio: 130, kcal: null, nota: null }] : [],
      notas: molestias.some((m) => m.estado !== "bien") ? `${nota} ${molestias.filter((m) => m.estado !== "bien").map((m) => `Noto ${m.zona === "hombro" ? "el hombro izquierdo" : `la ${m.zona}`} con ${m.estado === "dolor" ? "dolor" : "tensión"}.`).join(" ")}` : nota,
      original: `${fecha} ${rutina.titulo.toLowerCase()} (historial sintético)`, extra: {},
    };
    const dir = join(carpeta, "sesiones", fecha.slice(0, 4));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${fecha}.md`), escribirSesion(s));
  }
  writeFileSync(join(carpeta, "eventos.md"), `# Eventos\n\n- ${pausa[0]} → ${pausa[1]} · pausa · vacaciones\n- ${desde} · programa · Fuerza 12 semanas\n`);
  writeFileSync(join(carpeta, "FICHA.md"), `# Ficha

## Objetivos
- dias_semana: 4
- sentadilla: 140 kg
- press-banca: 100 kg
- peso-muerto: 180 kg
- press-militar: 65 kg

## Series objetivo por semana
pecho 12 · espalda 16 · cuadriceps 12 · femoral 8 · gluteo 8 · hombro 12 · biceps 6 · triceps 6 · abdomen 6 · gemelo 6

## Datos
- peso_corporal: 79 kg
- sueno_objetivo: 7 h
- racha_umbral_dias: 4

## Lesiones y limitaciones
- Rodilla: prehab antes de pierna (2×15 extensiones con banda)

## Referencias de fuerza
banca 1,0 · militar 0,62 · remo 0,8 · dominada 0,85 · sentadilla 1,3 · peso muerto 1,55

## Rangos de equilibrio
empuje:tiron 0,9–1,1 · cuadriceps:femoral 1,0–1,6 · banca:remo 1,0–1,3

## Estado actual
`);
  const dias = { empuje: "lunes", pierna: "martes", tiron: "jueves", gluteo: "sábado" };
  for (const [k, r] of Object.entries(RUTINAS)) {
    writeFileSync(join(carpeta, "plantillas", `${k}.md`), `---\nnombre: ${r.titulo}\ntipo: ${r.tipo}\ndia: ${dias[k]}\n---\n${r.ejercicios.map(([id, s, [a, b]]) => `- ${LEVANTAMIENTOS[id]?.nombre ?? id} · ${s}×${a === b ? a : `${a}-${b}`}`).join("\n")}\n`);
  }
  return { sesiones: fechas.length, desde, hasta: fechas.at(-1)?.[0] };
}
