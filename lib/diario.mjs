// Vista Diario (PLAN §2.4): molestias por zona y semana, sensaciones y línea de tiempo con hitos.
import { inicioSemana, sumarDias, semanaISO, diasEntre, media, redondear, fechaCorta, aFecha, claveTexto } from "./util.mjs";
import { resumenEjercicio, horasMinutos } from "./panel.mjs";
import { nombreZona } from "./records.mjs";
import { textoValor } from "./records.mjs";

const PESO_ESTADO = { bien: 0, molestia: 1, dolor: 2 };

/** Primera frase de un texto (para la línea de tiempo). */
export function primeraFrase(t) {
  const s = String(t ?? "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  const m = s.match(/^(.{8,}?[.!?])(\s|$)/);
  const f = m ? m[1] : s;
  return f.length > 140 ? f.slice(0, 137) + "…" : f;
}

/** Filas de molestias: una por zona, una celda por semana (12) con el peor estado mencionado. */
export function molestiasPorSemana(base, { semanas = 12, empieza = "lunes" } = {}) {
  const fin = inicioSemana(base.hoy, empieza);
  const ini = sumarDias(fin, -7 * (semanas - 1));
  const zonas = new Map();
  for (const s of base.sesiones) for (const m of s.molestias) {
    const z = nombreZona(m);
    if (!zonas.has(z)) zonas.set(z, { zona: z, clave: claveTexto(m.zona), celdas: Array(semanas).fill(null), menciones: [] });
    const fila = zonas.get(z);
    fila.menciones.push({ fecha: s.fecha, estado: m.estado });
    if (s.fecha < ini) continue;
    const k = Math.floor(diasEntre(ini, s.fecha) / 7);
    if (k >= 0 && k < semanas && (fila.celdas[k] === null || PESO_ESTADO[m.estado] > PESO_ESTADO[fila.celdas[k]])) fila.celdas[k] = m.estado;
  }
  const filas = [...zonas.values()].filter((f) => f.celdas.some((x) => x !== null) || f.menciones.some((x) => x.estado !== "bien" && diasEntre(x.fecha, base.hoy) <= 84));
  // Aviso (FORMATO §3.9): la molestia se repite en 3 o más sesiones seguidas en las que se menciona la zona.
  for (const f of filas) {
    let seguidas = 0;
    for (const m of [...f.menciones].reverse()) { if (m.estado === "bien") break; seguidas++; }
    f.repite = seguidas >= 3 && diasEntre(f.menciones.at(-1).fecha, base.hoy) <= 28 ? seguidas : 0;
    delete f.menciones;
  }
  return {
    semanas: Array.from({ length: semanas }, (_, i) => ({ inicio: sumarDias(ini, 7 * i), semana: semanaISO(sumarDias(ini, 7 * i)).semana })),
    filas: filas.sort((a, b) => b.celdas.filter((x) => x && x !== "bien").length - a.celdas.filter((x) => x && x !== "bien").length),
  };
}

export function sensacionesSemanales(base, { semanas = 12, empieza = "lunes" } = {}) {
  const fin = inicioSemana(base.hoy, empieza);
  const ini = sumarDias(fin, -7 * (semanas - 1));
  const out = Array.from({ length: semanas }, (_, i) => ({ inicio: sumarDias(ini, 7 * i), pre: [], post: [], sueno: [] }));
  for (const s of base.sesiones) {
    if (s.fecha < ini || s.fecha > base.hoy) continue;
    const w = out[Math.floor(diasEntre(ini, s.fecha) / 7)];
    if (s.pre !== null) w.pre.push(s.pre);
    if (s.post !== null) w.post.push(s.post);
    if (s.sueno_h !== null) w.sueno.push(s.sueno_h);
  }
  const suenos = out.flatMap((w) => w.sueno);
  return { semanas: out.map((w) => ({ inicio: w.inicio, pre: redondear(media(w.pre), 1), post: redondear(media(w.post), 1) })), sueno_medio: horasMinutos(media(suenos)) };
}

/** Línea de tiempo: sesiones (de la más reciente a la más antigua) e hitos intercalados. */
export function lineaDeTiempo(c) {
  const { base, catalogo } = c;
  const anio = aFecha(base.hoy).getFullYear();
  const entradas = [];
  const vistos = new Set();
  let programa = null;
  for (const s of base.sesiones) {
    if (s.programa && s.programa !== programa) {
      entradas.push({ t: "h", fecha: s.fecha, fecha_texto: fechaCorta(s.fecha, anio), texto: `${programa ? "Cambio de programa" : "Inicio de programa"}: ${s.programa}${s.semana_programa ? ` · semana ${s.semana_programa}` : ""}`, simbolo: "◆" });
      programa = s.programa;
    }
    for (const e of s.ejercicios) {
      if (vistos.has(e.id) || !e.series.some((x) => x.trabajo)) continue;
      vistos.add(e.id);
      if (base.sesiones.indexOf(s) > 0 && s.fecha !== base.desde) entradas.push({ t: "h", fecha: s.fecha, fecha_texto: fechaCorta(s.fecha, anio), texto: `Primera vez: ${(catalogo?.obtener(e.id)?.nombre ?? e.nombre).toLowerCase()}`, simbolo: "◆" });
    }
    const ejercicios = s.ejercicios.map((e) => { const r = resumenEjercicio(e); return r.series ? `${catalogo?.obtener(e.id)?.nombre ?? e.nombre} ${r.texto}` : null; }).filter(Boolean);
    const cardio = s.cardio.map((x) => `${x.actividad}${x.minutos ? ` ${x.minutos} min` : ""}${x.distancia_km ? ` · ${x.distancia_km} km` : ""}`);
    entradas.push({
      t: "s", fecha: s.fecha, fecha_texto: fechaCorta(s.fecha, anio), titulo: s.titulo || s.tipo || "Sesión", tipo: s.tipo,
      pre: s.pre, post: s.post, sueno: horasMinutos(s.sueno_h), frase: primeraFrase(s.notas), notas: s.notas || "",
      ejercicios: [...ejercicios, ...cardio].join(" · "), ids: s.ejercicios.map((e) => e.id),
      prs: s.prs.map((p) => `${p.nombre.toLowerCase()} ${p.texto}`), molestias: s.molestias.map((m) => ({ zona: nombreZona(m), clave: claveTexto(m.zona), estado: m.estado })),
      ruta: s.ruta,
    });
  }
  for (const e of base.eventos) {
    if (e.tipo === "pausa") entradas.push({ t: "h", fecha: e.desde, fecha_texto: e.hasta !== e.desde ? `${fechaCorta(e.desde, anio)} – ${fechaCorta(e.hasta, anio)}` : fechaCorta(e.desde, anio), texto: `Pausa declarada${e.texto ? ` · ${e.texto}` : ""} (la racha no se rompe)`, simbolo: "◇" });
    else if (e.tipo === "hito") entradas.push({ t: "h", fecha: e.desde, fecha_texto: fechaCorta(e.desde, anio), texto: e.texto || "Hito", simbolo: "◆" });
  }
  return entradas.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : a.t === "h" ? 1 : -1));
}

export function construirDiario(c) {
  const { base, config } = c;
  const empieza = config.semana_empieza || "lunes";
  const mol = molestiasPorSemana(base, { empieza });
  return {
    vacio: base.total_sesiones === 0,
    resumen: { sesiones: base.total_sesiones, desde: base.desde ? aFecha(base.desde).getFullYear() : null },
    molestias: mol,
    avisos: mol.filas.filter((f) => f.repite).map((f) => ({ zona: f.zona, texto: `Se repite: ${f.zona} en ${f.repite} sesiones seguidas · valora consultarlo` })),
    sensaciones: sensacionesSemanales(base, { empieza }),
    linea: lineaDeTiempo(c),
  };
}
export { textoValor };
