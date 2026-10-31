// Config global de gymhub (~/.config/gymhub/config.json) y rutas de la carpeta de datos.
import { homedir } from "node:os";
import { join, resolve, isAbsolute } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { leerJSON, escribirJSON } from "./util.mjs";

export const esWSL = () =>
  !!process.env.WSL_DISTRO_NAME ||
  (existsSync("/proc/version") && /microsoft/i.test(readFileSync("/proc/version", "utf8")));

/** Dónde vive la config: GYMHUB_CONFIG, o $XDG_CONFIG_HOME/gymhub, o ~/.config/gymhub. */
export function rutaConfig() {
  if (process.env.GYMHUB_CONFIG) return process.env.GYMHUB_CONFIG;
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(base, "gymhub", "config.json");
}

export const carpetaPorDefecto = () => (esWSL() ? "/mnt/d/GIMNASIO" : join(homedir(), "GIMNASIO"));

export const POR_DEFECTO = Object.freeze({
  carpeta: null,
  unidad: "kg",
  barra_kg: 20,
  discos_kg: [25, 20, 15, 10, 5, 2.5, 1.25],
  semana_empieza: "lunes",
  descanso_s_por_defecto: 120,
});

export function leerConfig() {
  const guardada = leerJSON(rutaConfig(), {}) || {};
  return { ...POR_DEFECTO, ...guardada };
}

export function guardarConfig(cambios) {
  const actual = leerJSON(rutaConfig(), {}) || {};
  const nueva = { ...POR_DEFECTO, ...actual, ...cambios };
  escribirJSON(rutaConfig(), nueva);
  return nueva;
}

/**
 * Convierte la ruta que escribe la persona en una ruta del sistema:
 * `D:\GIMNASIO` → `/mnt/d/GIMNASIO` (en WSL), `~` se expande y una relativa se resuelve
 * desde `base` (el directorio de la sesión).
 */
export function normalizarRuta(ruta, base = process.cwd()) {
  let r = String(ruta ?? "").trim().replace(/^["']|["']$/g, "");
  if (!r) return null;
  const win = r.match(/^([A-Za-z]):[\\/](.*)$/);
  if (win && (esWSL() || process.platform !== "win32")) {
    r = `/mnt/${win[1].toLowerCase()}/${win[2].replace(/\\/g, "/")}`;
  }
  if (r === "~" || r.startsWith("~/")) r = join(homedir(), r.slice(1));
  if (!isAbsolute(r)) r = resolve(base, r);
  return r.replace(/\/+$/, "") || "/";
}

/**
 * La carpeta de datos activa: `--carpeta`/GYMHUB_CARPETA si se dan; si no, la carpeta en la que
 * se abrió Claude Code, si es una carpeta de gymhub (lo normal con la instalación de proyecto);
 * si no, la de la config.
 */
export function carpetaActiva(opciones = {}) {
  if (opciones.carpeta) return normalizarRuta(opciones.carpeta);
  if (process.env.GYMHUB_CARPETA) return normalizarRuta(process.env.GYMHUB_CARPETA);
  if (tieneEstructura(process.cwd())) return process.cwd();
  return leerConfig().carpeta;
}

/** Rutas dentro de la carpeta de datos (FORMATO §1). */
export function rutas(carpeta) {
  const g = join(carpeta, ".gymhub");
  return {
    carpeta,
    contexto: join(carpeta, "CONTEXTO"),
    procesado: join(carpeta, "CONTEXTO", "procesado"),
    ficha: join(carpeta, "FICHA.md"),
    convenciones: join(carpeta, "convenciones.md"),
    ejercicios: join(carpeta, "ejercicios.md"),
    sesiones: join(carpeta, "sesiones"),
    records: join(carpeta, "records.md"),
    plantillas: join(carpeta, "plantillas"),
    semanas: join(carpeta, "semanas"),
    revision: join(carpeta, "revision.md"),
    gymhub: g,
    datos: join(g, "datos.json"),
    procesados: join(g, "procesados.json"),
    generadas: join(g, "generadas.json"),
    importacion: join(g, "importacion.json"),
    proceso: join(g, "proceso.json"),
    vivo: join(g, "vivo.json"),
    navegar: join(g, "navegar.json"),
    eventos: join(g, "eventos.json"),
    cache: join(g, "cache-sesiones.json"),
    copias: join(g, "copias"),
    web: join(g, "web"),
  };
}

/** ¿Tiene la carpeta la estructura de gymhub? */
export const tieneEstructura = (carpeta) =>
  !!carpeta && existsSync(join(carpeta, "FICHA.md")) && existsSync(join(carpeta, "sesiones"));
