// Vista Análisis (PLAN §2.3): todas las métricas, calculadas sobre el modelo base. Cada una
// devuelve null (n/d) cuando no hay datos suficientes, con el motivo.
import { PATRONES_RADAR, NOMBRE_PATRON } from "./catalogo.mjs";
import { objetivosFicha } from "./panel.mjs";
import { inicioSemana, sumarDias, diasEntre, media, sumar, redondear, aFecha, MESES, num } from "./util.mjs";

const DIA = 864e5;
const enRango = (fecha, desde, hasta) => fecha >= desde && fecha <= hasta;

/** Ejercicio de referencia de cada patrón: los «principal: si»; si no hace ninguno, su más frecuente en kg. */
export function referenciasPatron(base) {
  const out = {};
  for (const p of PATRONES_RADAR) {
    const candidatos = [...base.porEjercicio.values()].filter((h) => h.ficha?.patron === p && h.escala === "kg");
    const principales = candidatos.filter((h) => h.ficha?.principal);
    out[p] = (principales.length ? principales : candidatos.sort((a, b) => b.sesiones.length - a.sesiones.length).slice(0, 1)).map((h) => h.id);
  }
  return out;
}

const mejorE1rm = (base, ids, desde, hasta) => {
  let m = 0;
  for (const id of ids) for (const s of base.porEjercicio.get(id)?.sesiones ?? []) if (enRango(s.fecha, desde, hasta) && s.e1rm > m) m = s.e1rm;
  return m || null;
};

/** Radar de fuerza: mejor e1RM de 12 semanas por patrón ÷ su referencia, normalizado al más fuerte (= 100). */
export function radarFuerza(base, referencias, { hasta = base.hoy } = {}) {
  const refs = referenciasPatron(base);
  const desde = sumarDias(hasta, -83);
  const crudo = {};
  for (const p of PATRONES_RADAR) {
    const e = mejorE1rm(base, refs[p], desde, hasta);
    crudo[p] = e ? e / (referencias[p] || 1) : null;
  }
  const max = Math.max(0, ...Object.values(crudo).filter(Boolean));
  if (!max) return null;
  return Object.fromEntries(PATRONES_RADAR.map((p) => [p, crudo[p] ? Math.round((crudo[p] / max) * 100) : null]));
}

const seriesPatron = (base, desde, hasta) => {
  const out = Object.fromEntries(PATRONES_RADAR.map((p) => [p, 0]));
  for (const s of base.sesiones) if (enRango(s.fecha, desde, hasta)) for (const p of PATRONES_RADAR) out[p] += s.patrones[p] || 0;
  return out;
};
const seriesGrupos = (base, desde, hasta) => {
  const out = {};
  for (const s of base.sesiones) if (enRango(s.fecha, desde, hasta)) for (const [g, v] of Object.entries(s.grupos)) out[g] = (out[g] || 0) + v;
  return out;
};

/** Radar de volumen: series de trabajo por patrón en 4 semanas, normalizadas al patrón con más series. */
export function radarVolumen(base, { hasta = base.hoy } = {}) {
  const s = seriesPatron(base, sumarDias(hasta, -27), hasta);
  const max = Math.max(...Object.values(s));
  if (!max) return null;
  return Object.fromEntries(PATRONES_RADAR.map((p) => [p, Math.round((s[p] / max) * 100)]));
}

function ratio(nombre, valor, rango, textos) {
  if (valor === null || !isFinite(valor)) return { nombre, valor: null, rango, estado: "n/d", texto: "sin datos suficientes" };
  const estado = valor < rango[0] ? "bajo" : valor > rango[1] ? "alto" : "ok";
  const ESCALA = 2.2;
  const pos = (v) => Math.max(0, Math.min(100, Math.round((v / ESCALA) * 100)));
  return { nombre, valor: redondear(valor, 2), rango, estado, texto: textos[estado], pos: pos(valor), pos_min: pos(rango[0]), pos_max: pos(rango[1]) };
}

export function ratios(base, rangos) {
  const hoy = base.hoy, d4 = sumarDias(hoy, -27), d12 = sumarDias(hoy, -83);
  const sp = seriesPatron(base, d4, hoy);
  const empuje = sp["empuje-horizontal"] + sp["empuje-vertical"], tiron = sp["tiron-horizontal"] + sp["tiron-vertical"];
  const g = seriesGrupos(base, d4, hoy);
  const refs = referenciasPatron(base);
  const banca = mejorE1rm(base, refs["empuje-horizontal"], d12, hoy), remo = mejorE1rm(base, refs["tiron-horizontal"], d12, hoy);
  return [
    ratio("Empuje : tirón (series)", tiron ? empuje / tiron : null, rangos["empuje:tiron"], { bajo: "tiras más que empujas", alto: "empujas más que tiras", ok: "en rango" }),
    ratio("Cuádriceps : femoral", g.femoral ? (g.cuadriceps || 0) / g.femoral : null, rangos["cuadriceps:femoral"], { bajo: "cuádriceps corto", alto: "femoral corto", ok: "en rango" }),
    ratio("Banca : remo (fuerza)", banca && remo ? banca / remo : null, rangos["banca:remo"], { bajo: "banca corta frente al remo", alto: "remo corto frente a la banca", ok: "en rango" }),
  ];
}

/** Carga aguda:crónica = toneladas de 7 días ÷ (toneladas de 28 días ÷ 4). Hacen falta 4 semanas de datos. */
export function agudaCronica(base) {
  const hoy = base.hoy;
  if (!base.desde || diasEntre(base.desde, hoy) < 28) return { valor: null, motivo: "hacen falta 4 semanas de datos" };
  const t = (dias) => sumar(base.sesiones.filter((s) => enRango(s.fecha, sumarDias(hoy, -(dias - 1)), hoy)).map((s) => s.toneladas_kg));
  const cronica = t(28) / 4;
  if (!cronica) return { valor: null, motivo: "sin volumen en las últimas 4 semanas" };
  const v = t(7) / cronica;
  const pos = (x) => Math.max(0, Math.min(100, Math.round(((x - 0.5) / 1.5) * 100)));
  return { valor: redondear(v, 2), zona: [0.8, 1.3], estado: v < 0.8 ? "bajo" : v > 1.3 ? "alto" : "ok", pos: pos(v), pos_min: pos(0.8), pos_max: pos(1.3) };
}

/**
 * Disposición hoy (0-100): sueño de la última noche (40 %, frente al objetivo), inverso del RPE medio
 * de 7 días (30 %: RPE 6 → 100, 10 → 0) y última sensación pre (30 %). Lo que falta se excluye y
 * su peso se reparte.
 */
export function disposicion(base, suenoObjetivo = 8) {
  const hoy = base.hoy;
  const comps = [];
  const conSueno = [...base.sesiones].reverse().find((s) => s.sueno_h !== null && diasEntre(s.fecha, hoy) <= 1);
  if (conSueno) comps.push({ clave: "sueño", peso: 40, valor: Math.min(100, (conSueno.sueno_h / suenoObjetivo) * 100), texto: `sueño ${num(conSueno.sueno_h)} h` });
  const rpes = base.sesiones.filter((s) => diasEntre(s.fecha, hoy) <= 6 && s.fecha <= hoy).flatMap((s) => s.ejercicios.flatMap((e) => e.series.filter((x) => x.trabajo && x.rpeEf !== null).map((x) => x.rpeEf)));
  if (rpes.length) { const r = media(rpes); comps.push({ clave: "rpe", peso: 30, valor: Math.max(0, Math.min(100, (10 - r) * 25)), texto: `RPE 7 días ${num(r)}` }); }
  const conPre = [...base.sesiones].reverse().find((s) => s.pre !== null && diasEntre(s.fecha, hoy) <= 7);
  if (conPre) comps.push({ clave: "sensación", peso: 30, valor: conPre.pre * 10, texto: `sensación ${num(conPre.pre)}` });
  if (!comps.length) return { valor: null, motivo: "sin sueño, RPE ni sensaciones recientes" };
  const pesoTotal = sumar(comps.map((c) => c.peso));
  const valor = Math.round(sumar(comps.map((c) => c.valor * c.peso)) / pesoTotal);
  return { valor, estado: valor >= 70 ? "ok" : valor >= 50 ? "medio" : "bajo", componentes: comps.map((c) => c.texto), excluidos: ["sueño", "rpe", "sensación"].filter((k) => !comps.some((c) => c.clave === k)) };
}

/** Regresión lineal (mínimos cuadrados) de y sobre x. */
export function regresion(puntos) {
  const n = puntos.length;
  const mx = media(puntos.map((p) => p[0])), my = media(puntos.map((p) => p[1]));
  let num_ = 0, den = 0;
  for (const [x, y] of puntos) { num_ += (x - mx) * (y - my); den += (x - mx) ** 2; }
  const pendiente = den ? num_ / den : 0;
  return { pendiente, ordenada: my - pendiente * mx, n };
}

/** Mejor e1RM por semana (calendario) de un ejercicio entre dos fechas: [[índice de semana, e1RM]]. */
function semanales(base, id, desde, hasta, empieza) {
  const porSemana = new Map();
  for (const s of base.porEjercicio.get(id)?.sesiones ?? []) {
    if (!enRango(s.fecha, desde, hasta) || !s.e1rm) continue;
    const k = inicioSemana(s.fecha, empieza);
    porSemana.set(k, Math.max(porSemana.get(k) || 0, s.e1rm));
  }
  return [...porSemana.entries()].sort().map(([k, v]) => [diasEntre(desde, k) / 7, v, k]);
}

/**
 * Predicción: regresión del mejor e1RM semanal de las últimas 12 semanas (≥ 6 puntos). Pendiente
 * < 0,2 kg/sem → estancado; más de 12 meses → «> 1 año».
 */
export function prediccion(c, { semanas = 12, minimo = 6 } = {}) {
  const { base, config } = c;
  const hoy = base.hoy, desde = sumarDias(hoy, -(semanas * 7 - 1));
  return objetivosFicha(c).map((o) => {
    const pts = semanales(base, o.id, desde, hoy, config.semana_empieza || "lunes");
    const fila = { id: o.id, nombre: o.nombre, objetivo: redondear(o.objetivo, 1) };
    if (pts.length < minimo) return { ...fila, estado: "n/d", texto: `pocos datos (${pts.length} de ${minimo} semanas)` };
    const { pendiente, ordenada } = regresion(pts.map(([x, y]) => [x, y]));
    const xHoy = diasEntre(desde, hoy) / 7;
    const actual = Math.max(...pts.slice(-2).map((p) => p[1]));
    const base_ = { ...fila, actual: redondear(actual, 1), pendiente: redondear(pendiente, 2), n: pts.length };
    if (actual >= o.objetivo) return { ...base_, estado: "conseguido", texto: "conseguido" };
    if (pendiente < 0.2) return { ...base_, estado: "estancado", texto: "estancado" };
    const estimadoHoy = ordenada + pendiente * xHoy;
    const semanasFalta = (o.objetivo - Math.max(estimadoHoy, actual)) / pendiente;
    if (semanasFalta > 52) return { ...base_, estado: "lejos", texto: "> 1 año" };
    const f = aFecha(sumarDias(hoy, Math.round(semanasFalta * 7)));
    const anioHoy = aFecha(hoy).getFullYear();
    return { ...base_, estado: "ok", fecha: sumarDias(hoy, Math.round(semanasFalta * 7)), texto: `~${MESES[f.getMonth()]}${f.getFullYear() !== anioHoy ? ` ${String(f.getFullYear()).slice(2)}` : ""}` };
  });
}

/** Estancados: hechos en las últimas 4 semanas sin mejorar su mejor marca desde hace 4 semanas o más. */
export function estancados(base, { semanas = 4 } = {}) {
  const hoy = base.hoy, out = [];
  for (const h of base.porEjercicio.values()) {
    if (h.escala !== "kg" || h.sesiones.length < 4) continue;
    const recientes = h.sesiones.filter((s) => diasEntre(s.fecha, hoy) <= semanas * 7 - 1);
    if (!recientes.length) continue;
    let mejor = 0, ultimaMejora = null;
    for (const s of h.sesiones) if (s.e1rm && s.e1rm > mejor + 1e-9) { mejor = s.e1rm; ultimaMejora = s.fecha; }
    if (!ultimaMejora) continue;
    const sem = Math.floor(diasEntre(ultimaMejora, hoy) / 7);
    if (sem >= semanas) out.push({ id: h.id, nombre: h.nombre, semanas: sem, desde: ultimaMejora, principal: !!h.ficha?.principal });
  }
  return out.sort((a, b) => Number(b.principal) - Number(a.principal) || b.semanas - a.semanas);
}

/**
 * Lo que dicen tus datos: e1RM relativo de cada sesión (frente a la media de las 5 sesiones
 * anteriores de cada ejercicio) comparado entre grupos. Solo con n ≥ 30 sesiones y ≥ 10 por grupo.
 */
export function loQueDicen(base, suenoObjetivo = 8, { minTotal = 30, minGrupo = 10 } = {}) {
  const hist = new Map();
  const rel = [];
  for (const s of base.sesiones) {
    const vals = [];
    for (const e of s.ejercicios) {
      const best = Math.max(0, ...e.series.filter((x) => x.trabajo && x.e1rm).map((x) => x.e1rm));
      if (!best) continue;
      const h = hist.get(e.id) || [];
      if (h.length >= 3) vals.push(best / media(h.slice(-5)) - 1);
      h.push(best); hist.set(e.id, h);
    }
    if (vals.length) rel.push({ s, r: media(vals) });
  }
  const resultados = [];
  if (rel.length < minTotal) return { n: rel.length, hallazgos: [], motivo: `hacen falta ${minTotal} sesiones comparables (hay ${rel.length})` };
  const comparar = (nombre, clasificar, etiquetas) => {
    const grupos = {};
    for (const x of rel) { const k = clasificar(x.s); if (k !== null) (grupos[k] ||= []).push(x.r); }
    const validos = Object.entries(grupos).filter(([, v]) => v.length >= minGrupo);
    if (validos.length < 2) return;
    const medias = validos.map(([k, v]) => [k, media(v), v.length]).sort((a, b) => b[1] - a[1]);
    const [mejor, peor] = [medias[0], medias.at(-1)];
    const dif = (mejor[1] - peor[1]) * 100;
    resultados.push({ factor: nombre, dif: redondear(dif, 1), n: sumar(validos.map(([, v]) => v.length)), texto: etiquetas(mejor[0], peor[0], dif), grupos: medias.map(([k, m, n]) => ({ grupo: k, rel_pct: redondear(m * 100, 1), n })) });
  };
  comparar("sueño", (s) => (s.sueno_h === null ? null : s.sueno_h >= suenoObjetivo ? "≥" : "<"), (a, _b, d) => `Con ${a === "≥" ? "≥" : "<"} ${num(suenoObjetivo)} h de sueño tu e1RM rinde +${num(d)} %`);
  comparar("hora", (s) => s.franja, (a, b, d) => `Entrenando por la ${a} rindes +${num(d)} % que por la ${b}`);
  let anterior = null;
  const descanso = new Map();
  for (const s of base.sesiones) { if (anterior) { const d = diasEntre(anterior, s.fecha) - 1; descanso.set(s, d >= 2 ? "2+" : String(Math.max(0, d))); } anterior = s.fecha; }
  comparar("descanso", (s) => descanso.get(s) ?? null, (a, b, d) => `Con ${a} día${a === "1" ? "" : "s"} de descanso antes rindes +${num(d)} % que con ${b}`);
  const hallazgos = resultados.filter((x) => Math.abs(x.dif) >= 0.5).sort((a, b) => Math.abs(b.dif) - Math.abs(a.dif)).slice(0, 2);
  return { n: rel.length, hallazgos, motivo: hallazgos.length ? null : "sin diferencias claras entre grupos" };
}

/** Adherencia: sesiones hechas ÷ (días por semana × semanas) en 12 semanas, sin contar las pausas. */
export function adherencia(base, diasSemana = 4, { semanas = 12 } = {}) {
  const hoy = base.hoy, desde = sumarDias(hoy, -(semanas * 7 - 1));
  if (!base.desde || base.desde > desde) return { valor: null, motivo: `hacen falta ${semanas} semanas de datos` };
  let diasValidos = 0;
  for (let i = 0; i < semanas * 7; i++) if (!base.pausas.has(sumarDias(desde, i))) diasValidos++;
  const esperadas = (diasSemana * diasValidos) / 7;
  const hechas = base.sesiones.filter((s) => enRango(s.fecha, desde, hoy) && !base.pausas.has(s.fecha)).length;
  return { valor: esperadas ? Math.min(100, Math.round((hechas / esperadas) * 100)) : null, hechas, esperadas: redondear(esperadas, 1) };
}

export function construirAnalisis(c) {
  const { base, ficha } = c;
  const hace12 = sumarDias(base.hoy, -84);
  const fuerza = radarFuerza(base, ficha.referencias), fuerzaAntes = radarFuerza(base, ficha.referencias, { hasta: hace12 });
  const volumen = radarVolumen(base), volumenAntes = radarVolumen(base, { hasta: hace12 });
  const flojo = (r) => {
    if (!r) return null;
    const v = PATRONES_RADAR.filter((p) => r[p] !== null).sort((a, b) => r[a] - r[b])[0];
    return v ? { patron: v, nombre: NOMBRE_PATRON[v], valor: r[v] } : null;
  };
  return {
    vacio: base.total_sesiones === 0,
    // El orden de la maqueta: empuje horiz., empuje vert., tirón vert., tirón horiz., cadera, rodilla
    ejes: ["empuje-horizontal", "empuje-vertical", "tiron-vertical", "tiron-horizontal", "cadera", "rodilla"].map((p) => ({ patron: p, nombre: NOMBRE_PATRON[p] })),
    radar: {
      fuerza: { ahora: fuerza, antes: fuerzaAntes, flojo: flojo(fuerza), nota: "e1RM de 12 semanas frente a tus referencias de FICHA.md" },
      volumen: { ahora: volumen, antes: volumenAntes, flojo: flojo(volumen), nota: "series de trabajo de 4 semanas" },
    },
    ratios: ratios(base, ficha.rangos),
    aguda_cronica: agudaCronica(base),
    disposicion: disposicion(base, ficha.sueno_objetivo_h || 8),
    prediccion: prediccion(c),
    estancados: estancados(base).slice(0, 5),
    datos: loQueDicen(base, ficha.sueno_objetivo_h || 8),
    adherencia: adherencia(base, ficha.dias_semana || 4),
  };
}
export { DIA };
