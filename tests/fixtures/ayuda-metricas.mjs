// Ayudas para los tests de métricas: el catálogo de la plantilla, una sesión de un ejercicio en una
// línea y un detector de números no finitos (JSON.stringify los convertiría en null sin avisar).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { leerSesion } from "../../lib/canonico.mjs";
import { leerCatalogo } from "../../lib/catalogo.mjs";
import { RAIZ } from "../ayuda.mjs";

export const TEXTO_CATALOGO = readFileSync(join(RAIZ, "templates/GIMNASIO/ejercicios.md"), "utf8");
export const CAT = leerCatalogo(TEXTO_CATALOGO);
export const CAB = "| # | tipo | carga | reps | rpe | rir | nota |\n|---|---|---|---|---|---|---|";
export const ses = (fecha, filas, { id = "curl-barra", fm = "" } = {}) =>
  leerSesion(`---\nfecha: ${fecha}\nconfianza: alta\n${fm}---\n## Ejercicios\n### X\n<!-- id: ${id} -->\n${CAB}\n${filas.map((f, i) => `| ${i + 1} | ${f} |`).join("\n")}\n`, `sesiones/${fecha.slice(0, 4)}/${fecha}.md`);

export function noFinitos(x, ruta = "datos", out = []) {
  if (typeof x === "number" && !Number.isFinite(x)) out.push(`${ruta} = ${x}`);
  else if (x && typeof x === "object") for (const [k, v] of Object.entries(x)) noFinitos(v, `${ruta}.${k}`, out);
  return out;
}
