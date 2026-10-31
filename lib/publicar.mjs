// Publica la web: copia dashboard.html y escribe datos.js + version.js de forma atómica.
// La página relee version.js cada segundo (0,5 s con un proceso activo) y solo carga
// datos.js cuando cambia la versión (docs/notas-tecnicas.md §2.8).
import { join } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { rutas } from "./config.mjs";
import { escribirAtomico, leerJSON, escribirJSON, hashCorto, leerTexto } from "./util.mjs";
import { RAIZ_PLUGIN } from "./estructura.mjs";

export const PLANTILLA_WEB = join(RAIZ_PLUGIN, "web", "dashboard.html");

/** Versión de la página del plugin (hash de su plantilla). */
export const versionWeb = () => hashCorto(readFileSync(PLANTILLA_WEB, "utf8"));

/**
 * Copia la plantilla a .gymhub/web/ si falta o si el plugin trae otra versión (con su versión
 * dentro, para que una página abierta sepa que tiene que recargarse).
 */
export function instalarWeb(carpeta) {
  const r = rutas(carpeta);
  const destino = join(r.web, "dashboard.html");
  const plantilla = readFileSync(PLANTILLA_WEB, "utf8");
  const pagina = plantilla.replace("__GYMHUB_VERSION_WEB__", hashCorto(plantilla));
  if (leerTexto(destino) !== pagina) escribirAtomico(destino, pagina);
  return destino;
}

export const PROCESO_VACIO = { activo: false, fase: "listo", lote: null, lotes_total: null, pct: null, mensaje: null, dudas: 0 };

export function leerProceso(carpeta) { return { ...PROCESO_VACIO, ...(leerJSON(rutas(carpeta).proceso, {}) || {}) }; }
export function ponerProceso(carpeta, cambios) {
  const p = { ...leerProceso(carpeta), ...cambios, actualizado: new Date().toISOString() };
  escribirJSON(rutas(carpeta).proceso, p);
  return p;
}

/** Pide a la web abierta (o a la próxima que se abra) que muestre una vista. */
export function ponerNavegar(carpeta, vista, extra = {}) {
  const anterior = leerJSON(rutas(carpeta).navegar, {}) || {};
  const nav = { id: (anterior.id || 0) + 1, vista, ...extra, t: new Date().toISOString() };
  escribirJSON(rutas(carpeta).navegar, nav);
  return nav;
}

/**
 * Escribe datos.js (window.GYMHUB = {...}) y después version.js. La versión es un hash
 * del contenido sin la hora de generación, así que la página no repinta si nada cambió.
 */
export function publicar(carpeta, datos = null) {
  const r = rutas(carpeta);
  // Siempre: así, tras actualizar el plugin, cualquier publicación (un /refresh, un /semana…) deja la página nueva.
  instalarWeb(carpeta);
  const base = datos ?? leerJSON(r.datos, {}) ?? {};
  const cuerpo = {
    ...base,
    proceso: leerProceso(carpeta),
    vivo: leerJSON(r.vivo, null),
    navegar: leerJSON(r.navegar, null),
  };
  delete cuerpo.generado;
  cuerpo.version_web = versionWeb(); // dentro del hash: si se actualiza la página, cambia la versión
  const json = JSON.stringify(cuerpo);
  const version = hashCorto(json);
  const generado = new Date().toISOString();
  const texto = `window.GYMHUB = ${JSON.stringify({ version, generado, ...cuerpo })};\n`;
  escribirAtomico(join(r.web, "datos.js"), texto);
  escribirAtomico(join(r.web, "version.js"), `window.GYMHUB_VERSION = ${JSON.stringify(version)};\n`);
  return { version, ruta: join(r.web, "dashboard.html"), bytes: Buffer.byteLength(texto) };
}
