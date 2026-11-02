// Modelo base: lo que se calcula a partir de las sesiones ya leídas. De aquí salen todas
// las cifras de la web (Panel, Progreso, Análisis, Diario, Ejercicios) y de los comandos.
import { esTrabajo, rpeEfectivo, kgCarga, factorVolumen, repsE1rm, repsVolumen, e1rm, escalaSerie, valorSerie, mayor } from "./series.mjs";
import { diasDePausa } from "./eventos.mjs";
import { inicioSemana, diasEntre, sumarDias, media, sumar, decimalEs } from "./util.mjs";

const ORDEN_ESCALA = ["kg", "carga", "lastre", "nivel", "tiempo", "reps"];

export const textoSerie = (x) => {
  if (!x) return "";
  const c = x.carga?.tipo === "vacia" ? "" : x.carga?.texto ?? "";
  const r = x.reps?.texto ?? "";
  return decimalEs([c, r].filter(Boolean).join(" × "));
};

export function franjaHora(inicio) {
  const m = String(inicio ?? "").match(/^(\d{1,2})[:.h](\d{2})?/);
  if (!m) return null;
  const h = Number(m[1]);
  return h < 13 ? "mañana" : h < 20 ? "tarde" : "noche";
}

/**
 * @param sesiones resultado de leerSesion() (sin errores), en cualquier orden
 * @param ctx { catalogo, ficha, config, equivalencias: Map, eventos: [], hoy: "AAAA-MM-DD" }
 */
/** Orden de las sesiones: por fecha y, el mismo día, AAAA-MM-DD.md, -2, -3… (sin depender del idioma del sistema). */
const sufijo = (ruta) => Number(String(ruta ?? "").match(/\d{4}-\d{2}-\d{2}-(\d+)\.md$/)?.[1] ?? 1);
export const ordenSesiones = (a, b) => (a.fecha !== b.fecha ? (a.fecha < b.fecha ? -1 : 1)
  : sufijo(a.ruta) - sufijo(b.ruta) || (String(a.ruta) < String(b.ruta) ? -1 : String(a.ruta) > String(b.ruta) ? 1 : 0));

export function calcularBase(sesiones, ctx) {
  const { catalogo, ficha = {}, config = {}, equivalencias = new Map(), eventos = [], hoy } = ctx;
  const ordenadas = [...sesiones].sort(ordenSesiones);

  // Peso corporal vigente en cada sesión: el de la sesión, el último anotado o el de FICHA.md.
  let ultimoPeso = null;
  const S = ordenadas.map((s) => {
    if (s.peso_corporal_kg) ultimoPeso = s.peso_corporal_kg;
    const pc = s.peso_corporal_kg || ultimoPeso || ficha.peso_corporal_kg || null;
    const ejercicios = s.ejercicios.map((e) => derivarEjercicio(e, { pc, equivalencias, catalogo }));
    const grupos = {}, patrones = {};
    let series_trabajo = 0, toneladas_kg = 0;
    const rpes = [];
    for (const e of ejercicios) {
      const f = catalogo?.obtener(e.id);
      for (const x of e.series) {
        if (!x.trabajo) continue;
        series_trabajo++;
        toneladas_kg += x.tonelaje || 0;
        if (x.rpeEf !== null) rpes.push(x.rpeEf);
        if (f) {
          if (f.grupo) grupos[f.grupo] = (grupos[f.grupo] || 0) + 1;
          for (const g of f.secundarios) grupos[g] = (grupos[g] || 0) + 0.5;
          patrones[f.patron] = (patrones[f.patron] || 0) + 1;
        }
      }
    }
    return {
      fecha: s.fecha, ruta: s.ruta, titulo: s.titulo, tipo: s.tipo, programa: s.programa, semana_programa: s.semana_programa,
      inicio: s.inicio, duracion_min: s.duracion_min, sueno_h: s.sueno_h, pre: s.sensacion_pre, post: s.sensacion_post,
      peso_corporal_kg: s.peso_corporal_kg, pc, molestias: s.molestias, confianza: s.confianza, notas: s.notas,
      calentamiento: s.calentamiento, cardio: s.cardio, cardio_min: sumar(s.cardio.map((c) => c.minutos)),
      sin_detalle: !s.ejercicios.length && !s.cardio.length,
      ejercicios, series_trabajo, toneladas_kg, grupos, patrones, rpe_medio: media(rpes), franja: franjaHora(s.inicio), prs: [],
    };
  });

  // Historial por ejercicio, escala de cada uno y PRs (cronológicos).
  const porEjercicio = new Map();
  S.forEach((s, idx) => {
    for (const e of s.ejercicios) {
      if (!e.series.some((x) => x.trabajo)) continue;
      if (!porEjercicio.has(e.id)) {
        const f = catalogo?.obtener(e.id);
        porEjercicio.set(e.id, { id: e.id, nombre: f?.nombre ?? e.nombre, ficha: f, sesiones: [], escalas: {} });
      }
      const h = porEjercicio.get(e.id);
      for (const x of e.series) if (x.trabajo && x.escala) h.escalas[x.escala] = (h.escalas[x.escala] || 0) + 1;
      h.sesiones.push({ idx, fecha: s.fecha, ruta: s.ruta, ej: e });
    }
  });
  const prs = [];
  for (const h of porEjercicio.values()) {
    const cuentas = Object.entries(h.escalas);
    h.escala = cuentas.sort((a, b) => b[1] - a[1] || ORDEN_ESCALA.indexOf(a[0]) - ORDEN_ESCALA.indexOf(b[0]))[0]?.[0] ?? null;
    let mejorHasta = null, previas = 0;
    h.sesiones = h.sesiones.map((r) => {
      const trabajo = r.ej.series.filter((x) => x.trabajo);
      const enEscala = trabajo.filter((x) => x.escala === h.escala);
      let mejor = null;
      for (const x of enEscala) if (!mejor || mayor(valorSerie(h.escala, x), valorSerie(h.escala, mejor), h.escala)) mejor = x;
      const valor = mejor ? valorSerie(h.escala, mejor) : null;
      const esPR = !!(mejor && mejorHasta && previas >= 2 && mayor(valor, mejorHasta, h.escala));
      if (mejor) { if (!mejorHasta || mayor(valor, mejorHasta, h.escala)) mejorHasta = valor; previas++; }
      const fila = {
        idx: r.idx, fecha: r.fecha, ruta: r.ruta, series_trabajo: trabajo.length,
        e1rm: Math.max(0, ...trabajo.map((x) => x.e1rm || 0)) || null,
        mejor: mejor ? { texto: textoSerie(mejor), kg: mejor.kg, reps: repsE1rm(mejor.reps), rpe: mejor.rpeEf, e1rm: mejor.e1rm, valor } : null,
        pr: esPR, series: trabajo,
      };
      if (esPR) {
        const pr = { fecha: r.fecha, id: h.id, nombre: h.nombre, escala: h.escala, valor: valor[0], texto: fila.mejor.texto, e1rm: fila.mejor.e1rm };
        prs.push(pr);
        S[r.idx].prs.push(pr);
      }
      return fila;
    });
  }
  prs.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));

  // Semanas
  const empieza = config.semana_empieza || "lunes";
  const semanas = new Map();
  for (const s of S) {
    const k = inicioSemana(s.fecha, empieza);
    if (!semanas.has(k)) semanas.set(k, { inicio: k, sesiones: [], series_trabajo: 0, toneladas_kg: 0, grupos: {}, patrones: {}, rpes: [] });
    const w = semanas.get(k);
    w.sesiones.push(s);
    w.series_trabajo += s.series_trabajo;
    w.toneladas_kg += s.toneladas_kg;
    for (const [g, v] of Object.entries(s.grupos)) w.grupos[g] = (w.grupos[g] || 0) + v;
    for (const [p, v] of Object.entries(s.patrones)) w.patrones[p] = (w.patrones[p] || 0) + v;
    for (const e of s.ejercicios) for (const x of e.series) if (x.trabajo && x.rpeEf !== null) w.rpes.push(x.rpeEf);
  }
  for (const w of semanas.values()) w.rpe_medio = media(w.rpes);

  const pausas = diasDePausa(eventos);
  const racha = calcularRacha(S.map((s) => s.fecha), { hoy, umbral: ficha.racha_umbral_dias || 4, pausas });

  return {
    hoy, sesiones: S, porEjercicio, prs, semanas, racha, pausas, eventos,
    total_sesiones: S.length, nivel: 1 + Math.floor(S.length / 25),
    toneladas_total: sumar(S.map((s) => s.toneladas_kg)) / 1000,
    desde: S[0]?.fecha ?? null, ultima: S.at(-1)?.fecha ?? null,
  };
}

function derivarEjercicio(e, { pc, equivalencias, catalogo }) {
  const id = catalogo ? catalogo.canonico(e.id) : e.id;
  const equivalencia = equivalencias.get(id) ?? equivalencias.get(e.id) ?? null;
  const series = e.series.map((x) => {
    const kg = kgCarga(x.carga, { pesoCorporal: pc, equivalencia });
    const trabajo = esTrabajo(x.tipo);
    const r1 = repsE1rm(x.reps);
    const val = trabajo ? e1rm(kg, r1) : null;
    const tonelaje = trabajo && kg !== null && kg > 0 ? kg * factorVolumen(x.carga) * repsVolumen(x.reps) : 0;
    return {
      n: x.n, tipo: x.tipo, trabajo, carga: x.carga, reps: x.reps, rpe: x.rpe, rir: x.rir, rpeEf: rpeEfectivo(x), nota: x.nota,
      kg, e1rm: val, tonelaje, escala: trabajo ? escalaSerie(x.carga, x.reps, kg) : null,
    };
  });
  return { id, id_original: e.id, nombre: e.nombre, superserie: e.superserie, series };
}

/**
 * Racha: días de entreno seguidos, sin contar los descansos. Se rompe cuando hay `umbral`
 * días o más sin entrenar (los días de una pausa declarada no cuentan como «sin entrenar»).
 */
export function calcularRacha(fechas, { hoy, umbral = 4, pausas = new Set() }) {
  const dias = [...new Set(fechas)].sort();
  if (!dias.length) return { actual: 0, mejor: 0, ultima: null, desde: null };
  const huecoSinEntrenar = (a, b) => {
    // días entre a y b (excluidos ambos) que no son de pausa
    let n = 0;
    for (let i = 1; i < diasEntre(a, b); i++) if (!pausas.has(sumarDias(a, i))) n++;
    return n;
  };
  let mejor = 1, actual = 1, desde = dias[0];
  for (let i = 1; i < dias.length; i++) {
    if (huecoSinEntrenar(dias[i - 1], dias[i]) >= umbral) { actual = 1; desde = dias[i]; }
    else actual++;
    mejor = Math.max(mejor, actual);
  }
  const ultima = dias.at(-1);
  const viva = !hoy || ultima >= hoy || huecoSinEntrenar(ultima, hoy) < umbral;
  return { actual: viva ? actual : 0, mejor, ultima, desde: viva ? desde : null };
}
