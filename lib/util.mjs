// Utilidades comunes: ficheros atómicos, hashes, fechas locales y formato en español.
import { writeFileSync, renameSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { createHash } from "node:crypto";

/** Escribe un fichero de forma atómica: temporal en la misma carpeta + rename. */
export function escribirAtomico(ruta, texto) {
  mkdirSync(dirname(ruta), { recursive: true });
  const tmp = join(dirname(ruta), `.${basename(ruta)}.tmp-${process.pid}-${Math.random().toString(36).slice(2, 8)}`);
  writeFileSync(tmp, texto);
  renameSync(tmp, ruta);
}

export function leerTexto(ruta, porDefecto = null) {
  try { return readFileSync(ruta, "utf8"); } catch { return porDefecto; }
}

export function leerJSON(ruta, porDefecto = null) {
  const t = leerTexto(ruta);
  if (t === null) return porDefecto;
  try { return JSON.parse(t); } catch { return porDefecto; }
}

export function escribirJSON(ruta, valor) {
  escribirAtomico(ruta, JSON.stringify(valor, null, 2) + "\n");
}

export const sha256 = (texto) => createHash("sha256").update(texto).digest("hex");

/** Hash corto y estable para versionar datos.js (no criptográfico en su uso). */
export const hashCorto = (texto) => sha256(texto).slice(0, 12);

/** Texto normalizado para identificar un elemento de entrada: sin espacios sobrantes ni fines de línea raros. */
export function normalizarParaHash(texto) {
  return texto.replace(/\r\n?/g, "\n").split("\n").map((l) => l.trim()).join("\n").replace(/\n{2,}/g, "\n").trim().toLowerCase();
}

/** Minúsculas, sin tildes y con un solo espacio: para comparar nombres y alias. */
export function claveTexto(texto) {
  return String(texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9ñ+]+/g, " ").trim();
}

// ── Fechas (siempre en hora local, como AAAA-MM-DD) ──────────────────────────────────────
const pad = (n) => String(n).padStart(2, "0");
export const fechaISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const hoyISO = () => process.env.GYMHUB_HOY || fechaISO(new Date());
export function aFecha(iso) {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d, 12); // mediodía: evita saltos por horario de verano
}
export function sumarDias(iso, n) {
  const d = aFecha(iso);
  d.setDate(d.getDate() + n);
  return fechaISO(d);
}
export const diasEntre = (a, b) => Math.round((aFecha(b) - aFecha(a)) / 864e5);
/** 0 = lunes … 6 = domingo. */
export const diaSemana = (iso) => (aFecha(iso).getDay() + 6) % 7;

/** Semana ISO 8601: { anio, semana, clave: "2026-W44" }. */
export function semanaISO(iso) {
  const d = aFecha(iso);
  const jueves = new Date(d);
  jueves.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 3);
  const anio = jueves.getFullYear();
  const primerJueves = new Date(anio, 0, 4, 12);
  primerJueves.setDate(primerJueves.getDate() - ((primerJueves.getDay() + 6) % 7) + 3);
  const semana = 1 + Math.round((jueves - primerJueves) / (7 * 864e5));
  return { anio, semana, clave: `${anio}-W${pad(semana)}` };
}

/** Inicio de la semana que contiene `iso`, según la config (lunes o domingo). */
export function inicioSemana(iso, empieza = "lunes") {
  const dia = aFecha(iso).getDay(); // 0 domingo
  const atras = empieza === "domingo" ? dia : (dia + 6) % 7;
  return sumarDias(iso, -atras);
}

export const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const DIAS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
export const DIAS_LETRA = ["L", "M", "X", "J", "V", "S", "D"];

/** "29 oct", o "29 oct 25" si no es del año de referencia. */
export function fechaCorta(iso, anioRef = null) {
  const d = aFecha(iso);
  const base = `${d.getDate()} ${MESES[d.getMonth()]}`;
  return anioRef && d.getFullYear() !== anioRef ? `${base} ${String(d.getFullYear()).slice(2)}` : base;
}

// ── Números ──────────────────────────────────────────────────────────────────────────────
export const redondear = (x, dec = 1) => (x === null || x === undefined || !isFinite(x) ? null : Math.round(x * 10 ** dec) / 10 ** dec);
/** 127.5 → "127,5"; 1840 → "1.840". */
export function num(x, dec = 1) {
  if (x === null || x === undefined || !isFinite(x)) return "—";
  const r = redondear(x, dec);
  const [ent, frac] = Math.abs(r).toFixed(dec).split(".");
  const miles = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const fr = frac && Number(frac) !== 0 ? "," + frac.replace(/0+$/, "") : "";
  return (r < 0 ? "−" : "") + miles + fr;
}
export const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);
export const media = (xs) => { const v = xs.filter((x) => x !== null && x !== undefined && isFinite(x)); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
export const sumar = (xs) => xs.reduce((s, x) => s + (x || 0), 0);

export const existe = existsSync;
