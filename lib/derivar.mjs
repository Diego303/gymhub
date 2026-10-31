// Recalcula todo a partir de sesiones/*.md: .gymhub/datos.json (lo que pinta la web) y,
// si se pide, records.md y el «Estado actual» de FICHA.md. La IA normaliza; esto calcula.
import { rutas, leerConfig } from "./config.mjs";
import { leerTexto, escribirJSON, escribirAtomico, hoyISO } from "./util.mjs";
import { leerFicha } from "./ficha.mjs";
import { leerCatalogo } from "./catalogo.mjs";
import { leerEquivalencias } from "./convenciones.mjs";
import { leerEventos } from "./eventos.mjs";
import { cargarSesiones } from "./sesiones.mjs";
import { calcularBase } from "./base.mjs";
import { recordsPorEjercicio, escribirRecordsMd, actualizarEstadoFicha } from "./records.mjs";
import { construirDatos } from "./vistas.mjs";
import { construirPanel } from "./panel.mjs";
import { construirProgreso } from "./progreso.mjs";
import { construirAnalisis } from "./analisis.mjs";
import { construirDiario } from "./diario.mjs";
import { construirEjercicios } from "./ejercicio.mjs";
import { construirSemana } from "./semanas.mjs";

/** Las vistas de la web, en orden. */
export const VISTAS_WEB = [["panel", construirPanel], ["progreso", construirProgreso], ["analisis", construirAnalisis], ["diario", construirDiario], ["ejercicios", construirEjercicios], ["semana", construirSemana]];

/** Lee todo lo necesario de la carpeta y calcula el modelo base. */
export function contexto(carpeta, { hoy = hoyISO() } = {}) {
  const r = rutas(carpeta);
  const config = leerConfig();
  const fichaTexto = leerTexto(r.ficha, "");
  const ficha = leerFicha(fichaTexto);
  const catalogo = leerCatalogo(leerTexto(r.ejercicios, ""));
  const equivalencias = leerEquivalencias(leerTexto(r.convenciones, ""), catalogo);
  const { eventos, errores: erroresEventos } = leerEventos(leerTexto(`${carpeta}/eventos.md`, ""));
  const { validas, conErrores, avisos } = cargarSesiones(carpeta, catalogo);
  const ctx = { carpeta, config, ficha, fichaTexto, catalogo, equivalencias, eventos, hoy };
  const base = calcularBase(validas, ctx);
  return { ...ctx, base, conErrores, avisos: [...avisos, ...erroresEventos], records: recordsPorEjercicio(base) };
}

export async function derivarCarpeta(carpeta, { md = false, hoy } = {}) {
  const r = rutas(carpeta);
  const c = contexto(carpeta, { hoy });
  const datos = construirDatos(c, VISTAS_WEB);
  escribirJSON(r.datos, datos);
  if (md) {
    const antes = leerTexto(r.records, "");
    const nuevo = escribirRecordsMd(antes, c.base, c.records);
    if (nuevo !== antes) escribirAtomico(r.records, nuevo);
    if (c.fichaTexto) {
      const f = actualizarEstadoFicha(c.fichaTexto, c.base, c.records);
      if (f !== c.fichaTexto) escribirAtomico(r.ficha, f);
    }
  }
  return datos;
}
