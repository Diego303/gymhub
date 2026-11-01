// Pestaña Semana: un agregado por semana (con el inicio de semana de la config) para todo el
// historial, con sus comparaciones, la racha de semanas cumplidas, el resumen del mes y el
// repaso de /gymhub:semana (semanas/AAAA-Www.md). Todo calculado aquí; la web solo lo pinta.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { rutas } from "./config.mjs";
import { AGREGADOS } from "./catalogo.mjs";
import { nombreZona } from "./records.mjs";
import { inicioSemana, sumarDias, semanaISO, diasEntre, media, sumar, redondear, aFecha, MESES, fechaCorta, leerTexto } from "./util.mjs";

export const MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
/** Los grupos de la pestaña (los de la maqueta). */
export const GRUPOS_SEMANA = [
  ["pecho", "Pecho", ["pecho"]], ["espalda", "Espalda", AGREGADOS.espalda], ["pierna", "Pierna", AGREGADOS.pierna],
  ["hombro", "Hombro", ["hombro"]], ["brazos", "Brazos", AGREGADOS.brazos], ["core", "Core", AGREGADOS.core],
];
export const MARCAS_REPASO = ["✓", "★", "▲", "!", "→"];
export const PREGUNTAS_REPASO = ["¿Cómo te has sentido?", "¿Molestias?", "¿Qué priorizas la semana que viene?"];
const PESO = { bien: 0, molestia: 1, dolor: 2 };

/** El jueves de la semana que empieza en `inicio` (decide su semana ISO y su mes). */
export const juevesDe = (inicio) => sumarDias(inicio, (4 - aFecha(inicio).getDay() + 7) % 7);
export const claveSemana = (inicio) => semanaISO(juevesDe(inicio)).clave;

/**
 * Intensidad media: % del e1RM vigente (el mejor de las 12 semanas hasta `fin`) en las series de
 * trabajo de los ejercicios principales entre `ini` y `fin`. null si no hay ninguna.
 */
export function intensidadEntre(base, ini, fin, principales = null) {
  const prin = principales ?? new Set([...base.porEjercicio.values()].filter((h) => h.escala === "kg" && h.ficha?.principal).map((h) => h.id));
  const pcts = [];
  for (const s of base.sesiones) {
    if (s.fecha < ini || s.fecha > fin) continue;
    for (const e of s.ejercicios) {
      if (!prin.has(e.id)) continue;
      const h = base.porEjercicio.get(e.id);
      const vigente = Math.max(0, ...h.sesiones.filter((x) => x.fecha <= fin && diasEntre(x.fecha, fin) <= 84).map((x) => x.e1rm || 0));
      if (!vigente) continue;
      for (const x of e.series) if (x.trabajo && x.kg) pcts.push((x.kg / vigente) * 100);
    }
  }
  return pcts.length ? media(pcts) : null;
}

const delta = (v, b) => (v === null || v === undefined || !b ? null : Math.round(((v - b) / b) * 100));

// ── El repaso de /gymhub:semana (semanas/AAAA-Www.md) ────────────────────────────────────
/**
 * Lee el formato fijo del repaso. Tolera el formato antiguo (Fase 7: «## Qué ajustar»), cuyas
 * viñetas pasan a ser acciones («→»).
 */
export function leerRepaso(texto) {
  const t = String(texto ?? "").replace(/^\uFEFF/, "").replace(/\r/g, "");
  const fm = t.match(/^---\n([\s\S]*?)\n---\n?/);
  const meta = {};
  if (fm) for (const l of fm[1].split("\n")) { const m = l.match(/^(\w+):\s*(.*)$/); if (m) meta[m[1]] = m[2].trim().replace(/^"|"$/g, ""); }
  const seccion = (nombre) => {
    const m = t.match(new RegExp(`^##\\s+${nombre}\\s*\\n([\\s\\S]*?)(?=^##\\s|$(?![\\s\\S]))`, "m"));
    return m ? m[1].replace(/<!--[\s\S]*?-->/g, "").split("\n").map((l) => l.trim()).filter((l) => /^[-*]\s+\S/.test(l)).map((l) => l.replace(/^[-*]\s+/, "")) : null;
  };
  let lineas = (seccion("Repaso") ?? []).map((l) => {
    const marca = MARCAS_REPASO.find((m) => l.startsWith(m));
    return marca ? { marca, texto: l.slice(marca.length).trim() } : { marca: "→", texto: l };
  });
  if (!lineas.length) lineas = (seccion("Qué ajustar") ?? []).map((l) => ({ marca: "→", texto: l }));
  const preguntas = (seccion("Preguntas") ?? []).map((l) => {
    const m = l.match(/^(.*?\?)\s*:\s*(.*)$/) || l.match(/^([^:]+):\s*(.*)$/);
    return m ? { pregunta: m[1].trim(), respuesta: m[2].trim() } : { pregunta: l, respuesta: "" };
  });
  const g = meta.generado?.match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/);
  return {
    semana: meta.semana ?? null, generado: meta.generado ?? null,
    generado_texto: g ? `${fechaCorta(g[1])}${g[2] ? ` · ${g[2]}` : ""}` : null,
    lineas: lineas.slice(0, 5), preguntas,
  };
}

/** Valida el texto de «semana guardar» y devuelve el fichero con el formato fijo, o los errores. */
export function componerRepaso(clave, entrada, generado) {
  const r = leerRepaso(entrada);
  const errores = [];
  const t = String(entrada ?? "");
  if (!/^##\s+Repaso\s*$/m.test(t)) errores.push("falta la sección «## Repaso»");
  if (!/^##\s+Preguntas\s*$/m.test(t)) errores.push("falta la sección «## Preguntas»");
  const brutas = (t.match(/^##\s+Repaso\s*\n([\s\S]*?)(?=^##\s|$(?![\s\S]))/m)?.[1] ?? "").split("\n").map((l) => l.trim()).filter((l) => /^[-*]\s+\S/.test(l));
  if (!brutas.length) errores.push("el repaso necesita al menos una línea");
  if (brutas.length > 5) errores.push(`el repaso tiene ${brutas.length} líneas; como mucho 5`);
  for (const l of brutas) if (!MARCAS_REPASO.some((m) => l.replace(/^[-*]\s+/, "").startsWith(m + " "))) errores.push(`línea sin marcador válido (${MARCAS_REPASO.join(" ")}): «${l}»`);
  if (r.preguntas.length !== 3) errores.push(`hacen falta las 3 preguntas (hay ${r.preguntas.length})`);
  r.preguntas.forEach((p, i) => {
    if (PREGUNTAS_REPASO[i] && p.pregunta !== PREGUNTAS_REPASO[i]) errores.push(`la pregunta ${i + 1} debe ser «${PREGUNTAS_REPASO[i]}»`);
    if (!p.respuesta) errores.push(`falta la respuesta a «${p.pregunta}» (pon «(sin respuesta)» si no la hay)`);
  });
  if (errores.length) return { errores };
  const texto = ["---", `semana: ${clave}`, `generado: ${generado}`, "---", "## Repaso",
    ...r.lineas.map((l) => `- ${l.marca} ${l.texto}`), "", "## Preguntas", ...r.preguntas.map((p) => `- ${p.pregunta}: ${p.respuesta}`), ""].join("\n");
  return { errores: [], texto };
}

// ── El agregado ──────────────────────────────────────────────────────────────────────────
/** Cada zona con molestia o dolor en la semana; `repite` con la regla del Diario (3+ menciones seguidas). */
function molestiasSemana(base, ini, fin) {
  const zonas = new Map();
  for (const s of base.sesiones) {
    if (s.fecha < ini || s.fecha > fin) continue;
    for (const m of s.molestias) {
      if (m.estado === "bien") continue;
      const z = nombreZona(m);
      const x = zonas.get(z) || { zona: z, estado: "molestia", sesiones: 0 };
      x.sesiones++;
      if (PESO[m.estado] > PESO[x.estado]) x.estado = m.estado;
      zonas.set(z, x);
    }
  }
  for (const x of zonas.values()) {
    let seguidas = 0;
    const menciones = base.sesiones.filter((s) => s.fecha <= fin).flatMap((s) => s.molestias.filter((m) => nombreZona(m) === x.zona));
    for (const m of menciones.reverse()) { if (m.estado === "bien") break; seguidas++; }
    x.repite = seguidas >= 3;
  }
  return [...zonas.values()];
}

/**
 * Las semanas de todo el historial, de la primera con sesiones a la de hoy, con sus cifras,
 * comparaciones (anterior y media de las 4 previas, sin las de pausa), estado, racha y mes.
 */
export function calcularSemanas(c) {
  const { base, ficha, config, carpeta } = c;
  if (!base.total_sesiones) return [];
  const empieza = config.semana_empieza || "lunes";
  const objetivo = ficha.dias_semana || 4;
  const hoy = base.hoy;
  const primera = inicioSemana(base.desde, empieza), actual = inicioSemana(hoy, empieza);
  const prin = new Set([...base.porEjercicio.values()].filter((h) => h.escala === "kg" && h.ficha?.principal).map((h) => h.id));
  const dirRepasos = rutas(carpeta).semanas;
  const W = [];
  for (let ini = primera; ini <= actual; ini = sumarDias(ini, 7)) {
    const fin = sumarDias(ini, 6), jueves = juevesDe(ini);
    const ses = base.sesiones.filter((s) => s.fecha >= ini && s.fecha <= fin);
    let diasPausa = 0;
    for (let i = 0; i < 7; i++) if (base.pausas.has(sumarDias(ini, i))) diasPausa++;
    const pausa = diasPausa >= 4;
    const obj = pausa ? null : diasPausa ? Math.max(1, Math.round((objetivo * (7 - diasPausa)) / 7)) : objetivo;
    const gb = {};
    for (const s of ses) for (const [g, v] of Object.entries(s.grupos)) gb[g] = (gb[g] || 0) + v;
    const clave = claveSemana(ini);
    const fichero = join(dirRepasos, `${clave}.md`);
    W.push({
      clave, semana: semanaISO(jueves).semana, inicio: ini, fin, jueves, mes: jueves.slice(0, 7),
      sesiones: ses.length, toneladas_kg: sumar(ses.map((s) => s.toneladas_kg)), series: sumar(ses.map((s) => s.series_trabajo)),
      intensidad: intensidadEntre(base, ini, fin, prin),
      prs: ses.flatMap((s) => s.prs.map((p) => ({ nombre: p.nombre, texto: p.texto, fecha: p.fecha }))),
      grupos: Object.fromEntries(GRUPOS_SEMANA.map(([k, , partes]) => [k, sumar(partes.map((g) => gb[g] || 0))])),
      sueno: media(ses.map((s) => s.sueno_h)), molestias: molestiasSemana(base, ini, fin),
      pausa, dias_pausa: diasPausa, objetivo: obj, en_curso: fin >= hoy,
      repaso: existsSync(fichero) ? leerRepaso(readFileSync(fichero, "utf8")) : null,
    });
  }
  // Estado y racha (las pausas y la semana en curso sin cumplir todavía no la rompen)
  let racha = 0;
  for (const w of W) {
    w.estado = w.pausa ? "pausa" : w.sesiones >= w.objetivo ? "cumplida" : w.en_curso ? "en_curso" : w.sesiones === w.objetivo - 1 ? "a1" : "fallada";
    if (w.estado === "cumplida") racha++;
    else if (w.estado === "fallada" || w.estado === "a1") racha = 0;
    w.racha = racha;
  }
  // Comparaciones: la anterior (si no fue de pausa) y la media de las 4 previas sin las de pausa
  W.forEach((w, i) => {
    const ant = i > 0 && !W[i - 1].pausa ? W[i - 1] : null;
    const prev4 = W.slice(Math.max(0, i - 4), i).filter((x) => !x.pausa);
    const m = (f) => { const v = prev4.map(f).filter((x) => x !== null && x !== undefined); return v.length ? media(v) : null; };
    const kpi = (f) => {
      const v = f(w), a = ant ? f(ant) : null, md = m(f);
      return { valor: v, anterior: a, delta_anterior: w.pausa ? null : delta(v, a), media4: md, delta_media4: w.pausa ? null : delta(v, md) };
    };
    w.kpis = {
      sesiones: kpi((x) => x.sesiones), toneladas: kpi((x) => x.toneladas_kg / 1000), series: kpi((x) => x.series),
      intensidad: kpi((x) => x.intensidad), prs: kpi((x) => x.prs.length),
    };
    const medias = Object.fromEntries(GRUPOS_SEMANA.map(([k]) => [k, m((x) => x.grupos[k])]));
    const max = Math.max(1e-9, ...GRUPOS_SEMANA.flatMap(([k]) => [w.grupos[k], medias[k] || 0]));
    w.grupos_cmp = GRUPOS_SEMANA.map(([k, nombre]) => ({
      clave: k, nombre, series: redondear(w.grupos[k], 1), media4: medias[k] === null ? null : redondear(medias[k], 1),
      aviso: !w.pausa && medias[k] > 0 && w.grupos[k] < 0.7 * medias[k],
      pct: Math.round((w.grupos[k] / max) * 100), pct_media: medias[k] ? Math.round((medias[k] / max) * 100) : 0,
    }));
  });
  return W;
}

/** Resumen de cada mes (por el jueves de sus semanas). */
export function calcularMeses(W) {
  const meses = new Map();
  for (const w of W) {
    if (!meses.has(w.mes)) meses.set(w.mes, []);
    meses.get(w.mes).push(w);
  }
  const resumen = (ws) => ({
    sesiones: sumar(ws.map((w) => w.sesiones)), toneladas: redondear(sumar(ws.map((w) => w.toneladas_kg)) / 1000, 1),
    prs: sumar(ws.map((w) => w.prs.length)), cumplidas: ws.filter((w) => w.estado === "cumplida").length,
    // la semana en curso todavía sin cumplir no cuenta (ni como cumplida ni como fallada)
    semanas: ws.filter((w) => !w.pausa && w.estado !== "en_curso").length,
  });
  return { meses, resumen };
}

/** Lo que pinta la pestaña Semana (datos.semana). */
export function construirSemana(c) {
  const W = calcularSemanas(c);
  if (!W.length) return { vacio: true, semanas: [], defecto: null, actual: null };
  const { meses, resumen } = calcularMeses(W);
  const anio = aFecha(c.base.hoy).getFullYear();
  const mesAnterior = (mes) => { const [a, m] = mes.split("-").map(Number); return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, "0")}`; };
  const semanas = W.map((w, i) => {
    const delMes = meses.get(w.mes), hasta = delMes.filter((x) => x.inicio <= w.inicio);
    const pm = mesAnterior(w.mes), previas = meses.get(pm) ?? [];
    const maxT = Math.max(1e-9, ...delMes.map((x) => x.toneladas_kg));
    const [a, m] = w.mes.split("-").map(Number), [ap, mp] = pm.split("-").map(Number);
    const r1 = (x) => (x === null ? null : redondear(x, 1));
    const k = Object.fromEntries(Object.entries(w.kpis).map(([n, x]) => [n, { ...x, valor: r1(x.valor), anterior: r1(x.anterior), media4: r1(x.media4) }]));
    return {
      i, clave: w.clave, semana: w.semana, inicio: w.inicio, fin: w.fin,
      titulo: `Semana ${w.semana}`, rango: `${fechaCorta(w.inicio)} – ${fechaCorta(w.fin)} ${aFecha(w.fin).getFullYear()}`,
      estado: w.estado, objetivo: w.objetivo, pausa: w.pausa, en_curso: w.en_curso, racha: w.racha,
      kpis: k, prs: w.prs.map((p) => ({ ...p, fecha_texto: fechaCorta(p.fecha, anio) })),
      grupos: w.grupos_cmp, sueno: r1(w.sueno), molestias: w.molestias, repaso: w.repaso,
      mes: {
        clave: w.mes, nombre: MESES_LARGOS[m - 1], anio: a,
        // al mes le quedan semanas después de esta: «en curso» si es la semana actual, «hasta la sem N» si es pasada
        titulo: `Resumen de ${MESES_LARGOS[m - 1]}${sumarDias(w.jueves, 7).slice(0, 7) === w.mes ? (i === W.length - 1 ? " (en curso)" : ` (hasta la sem ${w.semana})`) : ""}`,
        hasta: resumen(hasta), anterior: { nombre: MESES[mp - 1], anio: ap, sin_datos: !previas.length, ...resumen(previas) },
        barras: delMes.map((x) => ({ clave: x.clave, semana: x.semana, toneladas: redondear(x.toneladas_kg / 1000, 1), pct: Math.round((x.toneladas_kg / maxT) * 100), futura: x.inicio > w.inicio, seleccionada: x.clave === w.clave })),
      },
    };
  });
  const ult = semanas.at(-1);
  return { vacio: false, semanas, actual: ult.clave, defecto: W.at(-1).sesiones ? ult.clave : semanas.at(-2)?.clave ?? ult.clave, objetivo: c.ficha.dias_semana || 4 };
}

/** La semana del repaso por defecto para /gymhub:semana: la actual. */
export function semanaDe(c, clave) {
  const W = calcularSemanas(c);
  return clave ? W.find((w) => w.clave === clave) ?? null : W.at(-1) ?? null;
}

/**
 * En sábado o domingo, si la semana en curso tiene sesiones y todavía no tiene repaso, la línea con
 * la que termina /gymhub:refresh. Si no, null.
 */
export function sugerenciaRepaso(c) {
  const hoy = c.base.hoy;
  const dia = aFecha(hoy).getDay(); // 0 domingo, 6 sábado
  if (dia !== 0 && dia !== 6) return null;
  const ini = inicioSemana(hoy, c.config.semana_empieza || "lunes");
  const hay = c.base.sesiones.some((s) => s.fecha >= ini && s.fecha <= hoy);
  if (!hay) return null;
  if (existsSync(join(rutas(c.carpeta).semanas, `${claveSemana(ini)}.md`))) return null;
  return "¿Hacemos el repaso de la semana? → /gymhub:semana";
}
