// Generador de sesiones aleatorias (inventadas) con una semilla, para los tests de propiedades.
// Si un test falla, imprime la semilla: con GYMHUB_SEMILLA=<n> se repite exactamente.
import { TIPOS_SERIE, TIPOS_SESION } from "../../lib/canonico.mjs";

/** PRNG mulberry32: determinista a partir de un entero de 32 bits. */
export function prng(semilla) {
  let a = semilla >>> 0;
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const ent = (min, max) => min + Math.floor(r() * (max - min + 1));
  const uno = (xs) => xs[Math.floor(r() * xs.length)];
  const quizas = (p, f) => (r() < p ? f() : null);
  return { r, ent, uno, quizas };
}

/** La semilla de la suite: GYMHUB_SEMILLA o una fija (los tests son reproducibles por defecto). */
export const semillaBase = () => Number(process.env.GYMHUB_SEMILLA ?? 20261101);

// Textos hostiles: tildes, ñ, emojis, HTML, comillas, barras, almohadillas y barras verticales.
const HOSTILES = [
  "Torso pesado", "Día A · empuje", "Pierna (glúteo)", "Señal: ñandú", "🏋️ fuerza 💪", "<script>alert(1)</script>",
  "<img src=x onerror=alert(1)>", "comillas \"dobles\" y 'simples'", "barra \\ invertida", "a | b | c", "#3 del bloque",
  "100% esfuerzo", "tab\taquí", "Ünïcödé çà", "x → y ← z", "&amp; &lt;", "</details>", "null", "true", "-5", "007", " espacios ",
];
const ZONAS = ["hombro", "rodilla", "lumbar", "muñeca", "codo", "cadera", "espalda alta", "tobillo"];
const ACTIVIDADES = ["cinta", "bici", "remo ergómetro", "elíptica", "carrera | suave"];

const num1 = (x) => Math.round(x * 10) / 10;

function carga(g) {
  const v = () => g.uno([g.ent(1, 300), num1(g.ent(10, 2000) / 10), g.ent(1, 60) * 2.5]);
  switch (g.ent(0, 11)) {
    case 0: return `${v()} kg`;
    case 1: return `${v()} lb`;
    case 2: return `${v()} kg/lado`;
    case 3: return `${v()} kg/mano`;
    case 4: return "PC";
    case 5: return `PC+${g.ent(1, 60)} kg`;
    case 6: return `PC-${g.ent(1, 40)} kg`;
    case 7: return `banda ${g.uno(["roja", "verde", "negra"])}`;
    case 8: return `banda ${g.ent(5, 40)} kg`;
    case 9: return `nivel ${g.ent(1, 20)}`;
    case 10: return `${g.ent(50, 95)} %1RM`;
    default: return "";
  }
}

function reps(g) {
  switch (g.ent(0, 8)) {
    case 0: case 1: case 2: return String(g.ent(1, 30));
    case 3: { const n = g.ent(1, 15); return `${n}/${g.r() < 0.7 ? n : g.ent(1, 15)}`; }
    case 4: return "fallo";
    case 5: return `${g.ent(10, 120)}s`;
    case 6: return `${g.ent(1, 10)} min`;
    case 7: return g.r() < 0.5 ? `${g.ent(100, 5000)} m` : `${g.ent(1, 20)} km`;
    default: return "";
  }
}

const slug = (g) => g.uno(["press-banca", "sentadilla", "peso-muerto", "dominadas", "remo-barra", "curl-biceps", "plancha", "ejercicio-x-2"]);

/** Una sesión inventada, como la que produciría Claude (antes de pasar por el parser). */
export function sesionAleatoria(g, { fecha = null } = {}) {
  const f = fecha ?? `${g.ent(2015, 2030)}-${String(g.ent(1, 12)).padStart(2, "0")}-${String(g.ent(1, 28)).padStart(2, "0")}`;
  const ejercicios = Array.from({ length: g.ent(0, 6) }, (_, k) => {
    const ss = g.quizas(0.25, () => g.uno(["A", "B", "C"]));
    return {
      nombre: g.uno([...HOSTILES.filter((h) => h.trim() === h && h !== ""), "Press banca", "Sentadilla", "Jalón al pecho"]),
      id: slug(g), superserie: ss, orden_superserie: ss ? g.ent(1, 3) : null,
      nota: g.quizas(0.2, () => g.uno(["agarre cerrado", "EMOM 10 min", "tempo 3-1-1 · pausa", "con correas <b>", "barra | hexagonal"])),
      series: Array.from({ length: g.ent(1, 6) }, (_, i) => ({
        n: i + 1, tipo: g.uno(TIPOS_SERIE), carga: { texto: carga(g) }, reps: { texto: reps(g) },
        rpe: g.quizas(0.4, () => g.ent(2, 20) / 2), rir: g.quizas(0.3, () => g.uno([0, 1, 2, 3, 1.5, 4, 5])),
        nota: g.quizas(0.3, () => g.uno(HOSTILES.filter((h) => !/^\s|\s$/.test(h)))),
      })),
    };
  });
  return {
    fecha: f,
    titulo: g.quizas(0.9, () => g.uno(HOSTILES)),
    tipo: g.quizas(0.8, () => g.uno(TIPOS_SESION)),
    programa: g.quizas(0.3, () => g.uno(["Fuerza 12 sem", "Bloque «base»", "PPL"])),
    semana_programa: g.quizas(0.3, () => g.ent(1, 12)),
    inicio: g.quizas(0.6, () => `${String(g.ent(6, 22)).padStart(2, "0")}:${g.uno(["00", "15", "30", "45"])}`),
    fin: null,
    duracion_min: g.quizas(0.5, () => g.ent(20, 150)),
    sueno_h: g.quizas(0.5, () => g.ent(8, 40) / 4),
    sensacion_pre: g.quizas(0.6, () => g.ent(0, 10)),
    sensacion_post: g.quizas(0.6, () => g.ent(0, 10)),
    peso_corporal_kg: g.quizas(0.3, () => num1(g.ent(450, 1100) / 10)),
    molestias: Array.from({ length: g.ent(0, 2) }, () => ({ zona: g.uno(ZONAS), lado: g.uno(["izq", "der", "ambos", null]), estado: g.uno(["bien", "molestia", "dolor"]) })),
    fuente: g.quizas(0.7, () => `CONTEXTO/notas ${g.ent(1, 9)}.md · bloque ${g.ent(1, 30)}`),
    confianza: g.uno(["alta", "media", "baja"]),
    extra: g.r() < 0.2 ? { etiqueta: g.uno(["deload", "test", "a: b"]) } : {},
    calentamiento: g.quizas(0.4, () => g.uno(["5 min bici · rotaciones 2×15", "movilidad de cadera\nbanda: 2×10", "nada <i>especial</i>"])) ?? "",
    ejercicios,
    cardio: Array.from({ length: g.ent(0, 2) }, () => ({
      actividad: g.uno(ACTIVIDADES), minutos: g.quizas(0.8, () => g.ent(5, 90)), distancia_km: g.quizas(0.5, () => g.ent(5, 250) / 10),
      ritmo: g.quizas(0.3, () => "5:30/km"), pulso_medio: g.quizas(0.4, () => g.ent(90, 180)), kcal: g.quizas(0.3, () => g.ent(50, 900)), nota: g.quizas(0.3, () => g.uno(HOSTILES.filter((h) => !/^\s|\s$/.test(h)))),
    })),
    otras: g.r() < 0.2 ? { "Observaciones del coach": g.uno(["todo bien", "tabla | sin | cabecera", "línea 1\nlínea 2"]) } : {},
    notas: g.uno(["", "Bien.", "Salgo cansado, ha sido una sesión completa.\nEl hombro bien.", "Nota con <script>alert(1)</script> y emojis 🎉", "# no es un título\nsegunda línea", "| a | b |\n|---|---|\n| 1 | 2 |", "\"comillas\" y \\barras\\"]),
    original: g.quizas(0.8, () => g.uno(["banca 3x5 80", "hoy pierna\n\nsentadilla 5x5 @ 100", "texto con </details> dentro", "  sangría al principio", "emoji 🏋️ y ñ"])),
  };
}
