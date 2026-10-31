// datos.json: lo que pinta la web, ya calculado. La página no calcula nada.
import { leerJSON, sumarDias, inicioSemana, semanaISO, redondear, diasEntre, aFecha } from "./util.mjs";
import { rutas } from "./config.mjs";
import { textoSerie } from "./base.mjs";

export const ESQUEMA = 1;

/** Nivel 0–4 del calendario según las series de trabajo del día. */
export function nivelCalendario(series, sinDetalle) {
  if (sinDetalle && !series) return 1;
  if (!series) return 0;
  return series < 10 ? 1 : series < 18 ? 2 : series < 26 ? 3 : 4;
}

/** Calendario de N semanas (columnas) × 7 días, como el de GitHub. */
export function calendario(base, { semanas = 12, empieza = "lunes" } = {}) {
  const porDia = new Map();
  for (const s of base.sesiones) {
    const d = porDia.get(s.fecha) || { series: 0, sesiones: 0, sinDetalle: false, tipos: [] };
    d.series += s.series_trabajo; d.sesiones++; d.sinDetalle ||= s.sin_detalle; d.tipos.push(s.tipo || s.titulo || "");
    porDia.set(s.fecha, d);
  }
  const fin = inicioSemana(base.hoy, empieza);
  const ini = sumarDias(fin, -7 * (semanas - 1));
  const columnas = [];
  for (let w = 0; w < semanas; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const f = sumarDias(ini, w * 7 + d);
      const x = porDia.get(f);
      col.push({
        fecha: f, futuro: f > base.hoy, pausa: base.pausas.has(f),
        nivel: f > base.hoy ? -1 : nivelCalendario(x?.series || 0, x?.sinDetalle),
        series: x?.series || 0, sesiones: x?.sesiones || 0, tipos: x?.tipos || [],
      });
    }
    columnas.push(col);
  }
  return { desde: ini, semanas: columnas };
}

export function construirDatos(c) {
  const { base, config, carpeta } = c;
  const r = rutas(carpeta);
  const ultimoRefresh = leerJSON(r.importacion, null)?.ultimo_refresh ?? null;
  const datos = {
    esquema: ESQUEMA,
    carpeta,
    hoy: base.hoy,
    unidad: config.unidad || "kg",
    vacio: base.total_sesiones === 0,
    ultimo_refresh: ultimoRefresh,
    resumen: {
      sesiones_total: base.total_sesiones,
      toneladas_total: redondear(base.toneladas_total, 1),
      desde: base.desde,
      ultima: base.ultima,
      nivel: base.nivel,
      racha: base.racha.actual,
      racha_mejor: base.racha.mejor,
    },
    errores: c.conErrores,
    avisos: c.avisos.slice(0, 50),
    records: c.records.map((x) => ({ ...x, valor: redondear(x.valor, 1), e1rm: redondear(x.e1rm, 1) })),
    prs: base.prs.slice(-50).map((p) => ({ ...p, valor: redondear(p.valor, 1), e1rm: redondear(p.e1rm, 1) })),
    semanas: [...base.semanas.values()].slice(-52).map((w) => ({
      inicio: w.inicio, clave: semanaISO(w.inicio).clave, sesiones: w.sesiones.length, series_trabajo: w.series_trabajo,
      toneladas: redondear(w.toneladas_kg / 1000, 2), rpe_medio: redondear(w.rpe_medio, 1),
    })),
    calendario: calendario(base, { empieza: config.semana_empieza }),
  };
  for (const [nombre, fn] of VISTAS) {
    try { datos[nombre] = fn(c, datos); } catch (e) { datos[nombre] = { error: e.message }; }
  }
  return datos;
}

/** Las vistas de la web se registran aquí (panel, progreso, análisis, diario, ejercicios). */
export const VISTAS = [];
export const registrarVista = (nombre, fn) => VISTAS.push([nombre, fn]);
export { textoSerie, diasEntre, aFecha };
