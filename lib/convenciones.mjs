// Lo que el script entiende de convenciones.md (el resto es para Claude).
//   - equivalencia jalon-pecho: nivel 1 = 5 kg, +5 kg por nivel
//   - escala: 1-5        (sensaciones; la conversión la hace Claude al normalizar)
import { claveTexto } from "./util.mjs";

const n = (s) => Number(String(s).replace(",", "."));

/** Map id → { nivel, base, paso } a partir de las líneas «[equivalencia] X: nivel N = A kg, +B kg por nivel». */
export function leerEquivalencias(texto, catalogo = null) {
  const out = new Map();
  for (const l of String(texto ?? "").replace(/<!--[\s\S]*?-->/g, "").split("\n")) {
    // «- equivalencia jalón: …» (plantilla) o «- jalón: …» (ejemplo de FORMATO §4)
    const m = l.match(/^\s*[-*]\s*(?:equivalencia\s+)?([^:]+):\s*nivel\s+(\d+(?:[.,]\d+)?)\s*=\s*(\d+(?:[.,]\d+)?)\s*kg\s*,\s*\+\s*(\d+(?:[.,]\d+)?)\s*kg\s+por\s+nivel/i);
    if (!m) continue;
    const nombre = m[1].trim();
    const id = catalogo?.buscar(nombre) ?? claveTexto(nombre).replace(/ /g, "-");
    out.set(id, { nivel: n(m[2]), base: n(m[3]), paso: n(m[4]) });
  }
  return out;
}

/** "dm" | "md" | null según «- orden: día/mes» en la sección de fechas. */
export function leerOrdenFechas(texto) {
  const t = String(texto ?? "").replace(/<!--[\s\S]*?-->/g, "");
  const m = t.match(/^\s*[-*]\s*orden\s*:\s*(d[ií]a\s*\/\s*mes|mes\s*\/\s*d[ií]a|dd\/mm|mm\/dd|d\/m|m\/d)/im);
  if (!m) return null;
  return /^(d|dd)/i.test(m[1].trim()) ? "dm" : "md";
}

/** ¿Tiene convenciones.md algo escrito, aparte de la plantilla comentada? */
export function convencionesVacias(texto) {
  return !String(texto ?? "").replace(/<!--[\s\S]*?-->/g, "").split("\n").some((l) => /^\s*[-*]\s+\S/.test(l));
}

const NOMBRE_ORDEN = { dm: "día/mes", md: "mes/día" };
const igual = (a, b) => a.nivel === b.nivel && a.base === b.base && a.paso === b.paso;

/**
 * Todo lo que el script entiende de convenciones.md, con un aviso por cada choque:
 * dos órdenes de fecha distintos (se usa el primero) o dos equivalencias distintas para el mismo
 * ejercicio (se usa la última). Sin fichero, los valores por defecto y ningún aviso.
 */
export function leerConvenciones(texto, catalogo = null) {
  const t = String(texto ?? "").replace(/<!--[\s\S]*?-->/g, "");
  const avisos = [];
  const ordenes = [...new Set(t.split("\n").map((l) => leerOrdenFechas(l)).filter(Boolean))];
  if (ordenes.length > 1) avisos.push(`convenciones.md: el orden de las fechas aparece con dos valores (${ordenes.map((o) => NOMBRE_ORDEN[o]).join(" y ")}); se usa ${NOMBRE_ORDEN[ordenes[0]]}`);
  const vistas = new Map();
  for (const l of t.split("\n")) {
    const [[id, eq] = []] = leerEquivalencias(l, catalogo);
    if (!id) continue;
    if (vistas.has(id) && !igual(vistas.get(id), eq)) avisos.push(`convenciones.md: ${id} tiene dos equivalencias distintas; se usa la última`);
    vistas.set(id, eq);
  }
  return { orden: leerOrdenFechas(t), equivalencias: leerEquivalencias(t, catalogo), avisos: [...new Set(avisos)] };
}
