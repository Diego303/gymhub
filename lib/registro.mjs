// Registro de subcomandos de bin/gymhub.mjs y ayudas comunes.
import { resolve, isAbsolute } from "node:path";
import { carpetaActiva, tieneEstructura } from "./config.mjs";
import { estaDentro } from "./estructura.mjs";
import { derivarCarpeta } from "./derivar.mjs";

export const SUBCOMANDOS = {};
export const registrar = (nombre, ayuda, fn) => { SUBCOMANDOS[nombre] = { ayuda, fn }; };

/** `a b --x 1 --y --x 2` → { pos: [a, b], op: { x: ["1", "2"], y: true } } */
export function argumentos(lista) {
  const pos = [], op = {};
  for (let i = 0; i < lista.length; i++) {
    const a = lista[i];
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split(/=(.*)/s, 2);
      const valor = v !== undefined ? v : (lista[i + 1] !== undefined && !lista[i + 1].startsWith("--") ? lista[++i] : true);
      op[k] = op[k] === undefined ? valor : [].concat(op[k], valor);
    } else pos.push(a);
  }
  return { pos, op };
}
export const lista = (v) => (v === undefined ? [] : [].concat(v));

export async function ejecutar(argv) {
  const [nombre = "ayuda", ...resto] = argv;
  const sub = SUBCOMANDOS[nombre];
  if (!sub) { console.log(`Subcomando desconocido: ${nombre}. Usa «ayuda».`); return 2; }
  return sub.fn(argumentos(resto));
}

/** La carpeta de datos, o un error claro si no hay ninguna configurada. */
export function carpetaObligatoria(op = {}) {
  const c = carpetaActiva({ carpeta: op.carpeta });
  if (!c) throw new Error("no hay carpeta de datos configurada. Usa /gymhub:configurar");
  if (!tieneEstructura(c)) throw new Error(`la carpeta ${c} no tiene la estructura de gymhub. Usa /gymhub:configurar ${c}`);
  return c;
}

/** Ruta dentro de la carpeta de datos, sin salirse de ella. */
export function rutaSegura(carpeta, rel) {
  const p = isAbsolute(rel) ? rel : resolve(carpeta, rel);
  if (!estaDentro(p, carpeta)) throw new Error(`la ruta ${rel} está fuera de la carpeta de datos`);
  return p;
}


/** Recalcula datos.json a partir de sesiones/ (la IA normaliza, el código calcula). */
export const recalcular = (carpeta) => derivarCarpeta(carpeta);
