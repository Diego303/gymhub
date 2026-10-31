// Vista Progreso (PLAN §2.2): mapa muscular, pared de récords, bloque, discos e historial.
import { join } from "node:path";
import { rutas } from "./config.mjs";
import { GRUPOS, AGREGADOS, NOMBRE_GRUPO } from "./catalogo.mjs";
import { tablaDiscos } from "./discos.mjs";
import { intensidadEntre } from "./semanas.mjs";
import { textoValor } from "./records.mjs";
import { leerJSON, inicioSemana, sumarDias, semanaISO, diasEntre, media, sumar, redondear, MESES, aFecha, fechaCorta } from "./util.mjs";

export const nivelMapa = (s) => (s >= 16 ? 4 : s >= 12 ? 3 : s >= 8 ? 2 : s >= 4 ? 1 : 0);

export function mapaMuscular(c) {
  const { base, ficha, config } = c;
  const ini = inicioSemana(base.hoy, config.semana_empieza || "lunes");
  const g = {};
  for (const s of base.sesiones.filter((x) => x.fecha >= ini && x.fecha <= base.hoy)) for (const [k, v] of Object.entries(s.grupos)) g[k] = (g[k] || 0) + v;
  const grupos = Object.fromEntries(GRUPOS.map((k) => [k, { series: redondear(g[k] || 0, 1), nivel: nivelMapa(g[k] || 0), nombre: NOMBRE_GRUPO[k] }]));
  const ordenados = GRUPOS.filter((k) => g[k]).sort((a, b) => g[b] - g[a]);
  // «Olvidados»: los grupos que la persona quiere trabajar (FICHA.md) y que van por debajo de 4 series.
  const quiere = new Set(Object.keys(ficha.series_objetivo || {}).flatMap((k) => AGREGADOS[k] ?? (GRUPOS.includes(k) ? [k] : [])));
  const base_ = quiere.size ? [...quiere] : GRUPOS.filter((k) => !["antebrazo", "aductor", "trapecio", "lumbar"].includes(k));
  const olvidados = base_.filter((k) => (g[k] || 0) < 4).sort((a, b) => (g[a] || 0) - (g[b] || 0)).slice(0, 3);
  return {
    grupos,
    mas: ordenados[0] ? { grupo: ordenados[0], nombre: NOMBRE_GRUPO[ordenados[0]], series: redondear(g[ordenados[0]], 1) } : null,
    olvidados: olvidados.map((k) => ({ grupo: k, nombre: NOMBRE_GRUPO[k], series: redondear(g[k] || 0, 1) })),
  };
}

/**
 * Bloque: las últimas 6 semanas. Intensidad = % medio del e1RM vigente (el mejor de las 12 semanas
 * anteriores) en las series de trabajo de los ejercicios principales. Volumen = toneladas.
 */
export function bloque(c, { semanas = 6 } = {}) {
  const { base, config } = c;
  const empieza = config.semana_empieza || "lunes";
  const actual = inicioSemana(base.hoy, empieza);
  const principales = new Set([...base.porEjercicio.values()].filter((h) => h.escala === "kg" && h.ficha?.principal).map((h) => h.id));
  const filas = [];
  for (let i = semanas - 1; i >= 0; i--) {
    const ini = sumarDias(actual, -7 * i), fin = sumarDias(ini, 6);
    const ses = base.sesiones.filter((s) => s.fecha >= ini && s.fecha <= fin);
    const intensidad = intensidadEntre(base, ini, fin, principales);
    const sp = ses.map((s) => s.semana_programa).filter((x) => x !== null && x !== undefined);
    filas.push({
      inicio: ini, sesiones: ses.length, intensidad: intensidad === null ? null : Math.round(intensidad),
      toneladas: redondear(sumar(ses.map((s) => s.toneladas_kg)) / 1000, 1),
      etiqueta: sp.length ? `SEM ${sp.at(-1)}` : `S${semanaISO(ini).semana}`, actual: i === 0,
    });
  }
  const maxT = Math.max(0, ...filas.map((f) => f.toneladas || 0));
  for (const f of filas) {
    f.volumen_pct = maxT ? Math.round(((f.toneladas || 0) / maxT) * 100) : 0;
    f.descarga = !f.actual && f.sesiones > 0 && f.volumen_pct < 70 && f.intensidad !== null && f.intensidad < 72;
    // Altura de la barra de intensidad: del 50 % (0) al 95 % (100), como en la maqueta.
    f.intensidad_alto = f.intensidad === null ? 0 : Math.max(4, Math.min(100, Math.round(((f.intensidad - 50) / 45) * 100)));
  }
  const programa = base.sesiones.at(-1)?.programa ?? null;
  return { programa, semanas: filas };
}

export function construirProgreso(c, datos) {
  const { base, config, carpeta } = c;
  const anio = base.hoy.slice(0, 4), mes = base.hoy.slice(0, 7);
  const discos = tablaDiscos({ barra: config.barra_kg ?? 20, discos: config.discos_kg ?? [25, 20, 15, 10, 5, 2.5, 1.25] });
  const pedido = leerJSON(join(rutas(carpeta).gymhub, "discos.json"), null)?.kg ?? null;
  const ini = inicioSemana(base.hoy, config.semana_empieza || "lunes");
  const semana = base.sesiones.filter((s) => s.fecha >= ini && s.fecha <= base.hoy);
  const pesos = base.sesiones.filter((s) => s.peso_corporal_kg);
  const desde = base.desde ? aFecha(base.desde) : null;
  return {
    vacio: base.total_sesiones === 0,
    mapa: mapaMuscular(c),
    records: c.records.slice(0, 12).map((r) => ({ id: r.id, nombre: r.nombre, valor: r.texto_valor, tipo: r.escala === "kg" ? "e1RM" : r.escala, serie: r.serie, fecha: r.fecha, fecha_texto: fechaCorta(r.fecha, Number(anio)), nuevo: r.nuevo })),
    records_total: c.records.length,
    prs_mes: base.prs.filter((p) => p.fecha.slice(0, 7) === mes).length,
    prs_anio: base.prs.filter((p) => p.fecha.slice(0, 4) === anio).length,
    pr_nuevo: c.records.some((r) => r.nuevo),
    bloque: bloque(c),
    discos: { ...discos, valor: pedido ?? 100 },
    historial: {
      sesiones: base.total_sesiones, toneladas: redondear(base.toneladas_total, 0),
      desde: desde ? `${MESES[desde.getMonth()]} ${desde.getFullYear()}` : null,
      cardio_semana_min: Math.round(sumar(semana.map((s) => s.cardio_min))),
      peso: pesos.length ? { kg: pesos.at(-1).peso_corporal_kg, fecha: pesos.at(-1).fecha } : null,
    },
  };
}
export { textoValor };
