// Leer todas las sesiones de sesiones/ (con caché por mtime y tamaño en .gymhub/).
import { readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { rutas } from "./config.mjs";
import { leerSesion, validarSesion } from "./canonico.mjs";
import { leerJSON, escribirJSON, hashCorto } from "./util.mjs";

// La caché guarda lo que devuelve el parser: su versión es la del código del parser, así que
// cualquier cambio en canonico.mjs (o aquí) invalida las cachés de las carpetas que ya existen.
const aqui = dirname(fileURLToPath(import.meta.url));
const VERSION_CACHE = "p-" + hashCorto(readFileSync(join(aqui, "canonico.mjs"), "utf8") + readFileSync(join(aqui, "sesiones.mjs"), "utf8"));

export function listarSesiones(carpeta) {
  const raiz = rutas(carpeta).sesiones;
  if (!existsSync(raiz)) return [];
  const out = [];
  const recorrer = (dir) => {
    for (const n of readdirSync(dir)) {
      if (n.startsWith(".")) continue;
      const p = join(dir, n);
      const st = statSync(p);
      if (st.isDirectory()) recorrer(p);
      else if (n.endsWith(".md")) out.push({ ruta: relative(carpeta, p).split("\\").join("/"), abs: p, mtimeMs: st.mtimeMs, size: st.size });
    }
  };
  recorrer(raiz);
  return out.sort((a, b) => (a.ruta < b.ruta ? -1 : a.ruta > b.ruta ? 1 : 0)); // orden fijo, sin depender del idioma
}

/** Lee y valida todas las sesiones. Devuelve { validas, conErrores: [{ruta, errores}], avisos }. */
export function cargarSesiones(carpeta, catalogo = null, { hoy = null } = {}) {
  const r = rutas(carpeta);
  const cache = leerJSON(r.cache, null);
  const previa = cache?.version === VERSION_CACHE ? cache.ficheros : {};
  const nueva = {};
  const validas = [], conErrores = [], avisos = [];
  for (const f of listarSesiones(carpeta)) {
    let s;
    const c = previa[f.ruta];
    if (c && c.mtimeMs === f.mtimeMs && c.size === f.size) s = c.sesion;
    else s = leerSesion(readFileSync(f.abs, "utf8"), f.ruta);
    nueva[f.ruta] = { mtimeMs: f.mtimeMs, size: f.size, sesion: s };
    const errores = validarSesion(s, catalogo, { hoy });
    if (errores.length) conErrores.push({ ruta: f.ruta, errores });
    else validas.push(s);
    for (const a of s.avisos) avisos.push(`${f.ruta}: ${a}`);
  }
  try { escribirJSON(r.cache, { version: VERSION_CACHE, ficheros: nueva }); } catch { /* la caché es opcional */ }
  return { validas, conErrores, avisos };
}
