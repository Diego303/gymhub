// Crear la carpeta de datos a partir de las plantillas, sin sobrescribir nunca nada.
import { mkdirSync, existsSync, copyFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { rutas } from "./config.mjs";

export const RAIZ_PLUGIN = join(dirname(fileURLToPath(import.meta.url)), "..");
export const PLANTILLAS = join(RAIZ_PLUGIN, "templates", "GIMNASIO");

const CARPETAS = ["CONTEXTO", "CONTEXTO/procesado", "sesiones", "plantillas", "semanas", ".gymhub/web"];

function ficherosPlantilla(dir, base = dir) {
  const out = [];
  for (const nombre of readdirSync(dir)) {
    const p = join(dir, nombre);
    if (statSync(p).isDirectory()) out.push(...ficherosPlantilla(p, base));
    else out.push(relative(base, p));
  }
  return out;
}

/** Crea lo que falte. Devuelve { creados, existentes }. */
export function crearEstructura(carpeta) {
  const creados = [], existentes = [];
  if (existsSync(carpeta) && !statSync(carpeta).isDirectory()) throw new Error(`${carpeta} existe y no es una carpeta`);
  mkdirSync(carpeta, { recursive: true });
  for (const c of CARPETAS) {
    const p = join(carpeta, c);
    if (existsSync(p)) existentes.push(c + "/"); else { mkdirSync(p, { recursive: true }); creados.push(c + "/"); }
  }
  for (const rel of ficherosPlantilla(PLANTILLAS)) {
    const destino = join(carpeta, rel);
    if (existsSync(destino)) { existentes.push(rel); continue; }
    mkdirSync(dirname(destino), { recursive: true });
    copyFileSync(join(PLANTILLAS, rel), destino);
    creados.push(rel);
  }
  return { creados, existentes, rutas: rutas(carpeta) };
}

/** ¿Está `ruta` dentro de `base`? (sin distinguir mayúsculas en /mnt/<letra>, que no las distingue) */
export function estaDentro(ruta, base) {
  const norm = (p) => (/^\/mnt\/[a-z]\//i.test(p) ? p.toLowerCase() : p).replace(/\/+$/, "");
  const r = norm(ruta), b = norm(base);
  return r === b || r.startsWith(b + "/");
}

/** En WSL, una carpeta fuera de /mnt/<letra> la abre el navegador por \\wsl.localhost. */
export const fueraDeWindows = (carpeta) => !/^\/mnt\/[a-z]\//i.test(carpeta + "/");
