// Vista Panel (PLAN §2.1) y Rex (§2.5): todo calculado aquí; la web solo lo pinta.
import { join } from "node:path";
import { rutas } from "./config.mjs";
import { GRUPOS, AGREGADOS, NOMBRE_GRUPO } from "./catalogo.mjs";
import { leerPlantillas } from "./plantillas.mjs";
import { molestiasActivas, nombreZona } from "./records.mjs";
import { textoSerie } from "./base.mjs";
import { decimalEs, leerJSON, inicioSemana, sumarDias, semanaISO, diaSemana, diasEntre, media, sumar, num, redondear, DIAS, DIAS_LETRA, MESES, aFecha } from "./util.mjs";

export const ABREV_TIPO = { empuje: "emp", tiron: "tir", pierna: "pie", "pierna-gluteo": "glú", torso: "tor", full: "full", pecho: "pec", espalda: "esp", hombro: "hom", brazo: "bra", cardio: "car", movilidad: "mov", deporte: "dep", mixto: "mix" };
export const NOMBRE_TIPO = { empuje: "empuje", tiron: "tirón", pierna: "pierna", "pierna-gluteo": "pierna", torso: "torso", full: "cuerpo entero", pecho: "pecho", espalda: "espalda", hombro: "hombro", brazo: "brazo", cardio: "cardio", movilidad: "movilidad", deporte: "deporte", mixto: "mixto" };
const abrev = (s) => ABREV_TIPO[s?.tipo] ?? String(s?.titulo ?? "").toLowerCase().slice(0, 3) ?? "·";

export const fechaLarga = (iso) => { const d = aFecha(iso); return `${DIAS[diaSemana(iso)]} ${d.getDate()} ${MESES[d.getMonth()]}`; };
export const horasMinutos = (h) => (h === null || h === undefined ? null : `${Math.floor(h)}h ${String(Math.round((h % 1) * 60)).padStart(2, "0")}m`);

/** Resumen «5×5 · 120 kg» de las series de trabajo de un ejercicio en una sesión. */
export function resumenEjercicio(e) {
  const t = e.series.filter((x) => x.trabajo);
  if (!t.length) return { texto: "", series: 0 };
  const cuenta = new Map();
  for (const x of t) { const k = `${x.reps?.texto ?? ""}|${x.carga?.tipo === "vacia" ? "" : x.carga?.texto ?? ""}`; cuenta.set(k, (cuenta.get(k) || 0) + 1); }
  const [k] = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0];
  const [reps, carga] = k.split("|");
  return { texto: decimalEs(`${t.length}×${reps}${carga ? ` · ${carga}` : ""}`), series: t.length };
}

/** El ejercicio de la gráfica de progresión: el elegido con /gymhub:ejercicio, el principal más reciente o el más usado. */
export function ejercicioDestacado(c) {
  const { base, carpeta } = c;
  const elegido = leerJSON(join(rutas(carpeta).gymhub, "panel.json"), {})?.ejercicio;
  const enKg = [...base.porEjercicio.values()].filter((h) => h.escala === "kg" && h.sesiones.length >= 2);
  if (elegido && enKg.some((h) => h.id === elegido)) return elegido;
  const ultimo = (h) => h.sesiones.at(-1).fecha;
  const principales = enKg.filter((h) => h.ficha?.principal).sort((a, b) => (ultimo(a) < ultimo(b) ? 1 : -1));
  if (principales.length) return principales[0].id;
  return enKg.sort((a, b) => b.sesiones.length - a.sesiones.length)[0]?.id ?? null;
}

/** Mejor e1RM por semana de un ejercicio, en las últimas `semanas`. */
export function e1rmSemanal(base, id, { semanas = 12, empieza = "lunes" } = {}) {
  const h = base.porEjercicio.get(id);
  if (!h) return [];
  const desde = sumarDias(inicioSemana(base.hoy, empieza), -7 * (semanas - 1));
  const porSemana = new Map();
  for (const s of h.sesiones) {
    if (s.fecha < desde || !s.e1rm) continue;
    const k = inicioSemana(s.fecha, empieza);
    porSemana.set(k, Math.max(porSemana.get(k) || 0, s.e1rm));
  }
  return [...porSemana.entries()].sort().map(([semana, v]) => ({ semana, e1rm: redondear(v, 1) }));
}

export const ejeY = (valores) => {
  const v = valores.filter((x) => x !== null && x !== undefined);
  if (!v.length) return { min: 0, max: 100 };
  const min = Math.floor((Math.min(...v) * 0.96) / 5) * 5, max = Math.ceil((Math.max(...v) * 1.02) / 5) * 5;
  return { min, max: max > min ? max : min + 5 };
};

/** Objetivos de FICHA.md resueltos a ids del catálogo. */
export function objetivosFicha(c) {
  return Object.entries(c.ficha.objetivos || {}).map(([nombre, o]) => {
    const id = c.catalogo.buscar(nombre) ?? nombre;
    const kg = o.unidad === "lb" ? o.valor * 0.4536 : o.valor;
    return { id, nombre: c.catalogo.obtener(id)?.nombre ?? nombre, objetivo: kg };
  });
}

/** Mejor e1RM de un ejercicio desde una fecha. */
export function mejorDesde(base, id, desde) {
  const h = base.porEjercicio.get(id);
  return h ? Math.max(0, ...h.sesiones.filter((s) => s.fecha >= desde).map((s) => s.e1rm || 0)) || null : null;
}

export function seriesGrupo(grupos, clave) {
  const partes = AGREGADOS[clave] ?? (GRUPOS.includes(clave) ? [clave] : []);
  return sumar(partes.map((g) => grupos[g] || 0));
}

/** La rutina de hoy: la sesión de hoy, la plantilla de hoy o la siguiente según la rotación. */
export function rutinaHoy(c) {
  const { base, catalogo, carpeta } = c;
  const hoy = base.hoy;
  const vivo = leerJSON(rutas(carpeta).vivo, null);
  if (vivo?.entreno && vivo.fecha === hoy && vivo.rutina) return { ...vivo.rutina, origen: "vivo" };
  const hecha = base.sesiones.filter((s) => s.fecha === hoy).at(-1);
  const plantillas = leerPlantillas(rutas(carpeta).plantillas, catalogo);
  if (hecha) {
    return { origen: "hecha", titulo: hecha.titulo || NOMBRE_TIPO[hecha.tipo] || "Sesión de hoy", tipo: hecha.tipo, duracion_min: hecha.duracion_min,
      ejercicios: hecha.ejercicios.map((e) => { const r = resumenEjercicio(e); return { nombre: catalogo.obtener(e.id)?.nombre ?? e.nombre, prescripcion: r.texto, hechas: r.series, total: r.series }; }).filter((e) => e.total) };
  }
  const deHoy = plantillas.find((p) => p.dia === diaSemana(hoy));
  if (deHoy) {
    return { origen: "plantilla", titulo: deHoy.nombre, tipo: deHoy.tipo, duracion_min: Math.max(30, deHoy.ejercicios.length * 13),
      ejercicios: deHoy.ejercicios.map((e) => ({ nombre: (e.id && catalogo.obtener(e.id)?.nombre) || e.nombre, prescripcion: e.prescripcion, hechas: 0, total: e.series || 3 })) };
  }
  // Rotación: el tipo que más veces sigue al último entrenado (12 semanas)
  const recientes = base.sesiones.filter((s) => diasEntre(s.fecha, hoy) <= 84 && !s.sin_detalle && s.tipo);
  if (!recientes.length) return null;
  const ultimo = recientes.at(-1).tipo;
  const siguientes = new Map();
  for (let i = 0; i + 1 < recientes.length; i++) if (recientes[i].tipo === ultimo) siguientes.set(recientes[i + 1].tipo, (siguientes.get(recientes[i + 1].tipo) || 0) + 1);
  const tipo = [...siguientes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ultimo;
  const modelo = [...recientes].reverse().find((s) => s.tipo === tipo);
  if (!modelo) return null;
  const durs = recientes.filter((s) => s.tipo === tipo && s.duracion_min).map((s) => s.duracion_min);
  return { origen: "rotacion", titulo: modelo.titulo || NOMBRE_TIPO[tipo], tipo, duracion_min: durs.length ? Math.round(media(durs)) : null,
    ejercicios: modelo.ejercicios.map((e) => { const r = resumenEjercicio(e); return { nombre: catalogo.obtener(e.id)?.nombre ?? e.nombre, prescripcion: r.texto, hechas: 0, total: r.series }; }).filter((e) => e.total) };
}

/** Sugerencia de descarga: 3 semanas con RPE medio ≥ 8,5 o principales estancados. */
export function descarga(c, semanaActual) {
  const { base } = c;
  const completas = [...base.semanas.values()].filter((w) => w.inicio < semanaActual).slice(-3);
  const motivos = [];
  if (completas.length === 3 && completas.every((w) => w.rpe_medio !== null && w.rpe_medio >= 8.5)) motivos.push("3 semanas seguidas con RPE medio ≥ 8,5");
  const estancados = [];
  for (const h of base.porEjercicio.values()) {
    if (!h.ficha?.principal || h.escala !== "kg") continue;
    const ult = h.sesiones.filter((s) => diasEntre(s.fecha, base.hoy) <= 28);
    const antes = h.sesiones.filter((s) => diasEntre(s.fecha, base.hoy) > 28 && diasEntre(s.fecha, base.hoy) <= 84);
    if (ult.length >= 2 && antes.length >= 2 && Math.max(...ult.map((s) => s.e1rm || 0)) <= Math.max(...antes.map((s) => s.e1rm || 0))) estancados.push(h.nombre.toLowerCase());
  }
  if (estancados.length >= 2) motivos.push(`e1RM estancado en ${estancados.slice(0, 3).join(", ")}`);
  if (!motivos.length) return null;
  const proxima = semanaISO(sumarDias(semanaActual, 7)).semana;
  return { texto: `Descarga sugerida en sem. ${proxima}`, motivo: motivos.join(" · ") };
}

export function construirPanel(c, datos) {
  const { base, ficha, config, records } = c;
  const hoy = base.hoy;
  const empieza = config.semana_empieza || "lunes";
  const ini = inicioSemana(hoy, empieza);
  const deSemana = base.sesiones.filter((s) => s.fecha >= ini && s.fecha <= hoy);
  const objetivo = ficha.dias_semana || 4;
  const t = sumar(deSemana.map((s) => s.toneladas_kg)) / 1000;
  const dia = diasEntre(ini, hoy);
  const anterior = base.sesiones.filter((s) => s.fecha >= sumarDias(ini, -7) && s.fecha <= sumarDias(ini, dia - 7));
  const tAnt = sumar(anterior.map((s) => s.toneladas_kg)) / 1000;
  const prsMes = base.prs.filter((p) => p.fecha.slice(0, 7) === hoy.slice(0, 7));
  const ultima = base.sesiones.at(-1);

  // Progresión
  const id = ejercicioDestacado(c);
  const objs = objetivosFicha(c);
  let progresion = null;
  if (id) {
    const puntos = e1rmSemanal(base, id, { empieza });
    const obj = objs.find((o) => o.id === id)?.objetivo ?? null;
    const p0 = puntos[0], p1 = puntos.at(-1);
    progresion = {
      id, nombre: base.porEjercicio.get(id).nombre, puntos, objetivo: obj ? redondear(obj, 1) : null,
      ultimo: p1?.e1rm ?? null, delta: p0 && p1 && puntos.length > 1 ? redondear(p1.e1rm - p0.e1rm, 1) : null,
      semanas: p0 && p1 ? Math.round(diasEntre(p0.semana, p1.semana) / 7) : 0,
      eje: ejeY([...puntos.map((x) => x.e1rm), obj]),
    };
  }
  const desde8 = sumarDias(hoy, -56);
  const objetivos = objs.map((o) => {
    const actual = mejorDesde(base, o.id, desde8);
    return { id: o.id, nombre: o.nombre, actual: redondear(actual, 1), objetivo: redondear(o.objetivo, 1), pct: actual ? Math.min(100, Math.round((actual / o.objetivo) * 100)) : 0, sin_datos: !actual };
  });

  // Series por grupo
  const gruposSemana = {};
  for (const s of deSemana) for (const [g, v] of Object.entries(s.grupos)) gruposSemana[g] = (gruposSemana[g] || 0) + v;
  const pasadoMiercoles = diaSemana(hoy) > 2;
  const grupos = Object.entries(ficha.series_objetivo || {}).filter(([k]) => AGREGADOS[k] || GRUPOS.includes(k)).map(([k, obj]) => {
    const series = redondear(seriesGrupo(gruposSemana, k), 1);
    const pct = obj ? Math.round((series / obj) * 100) : 0;
    return { clave: k, nombre: NOMBRE_GRUPO[k] ?? k, series, objetivo: obj, pct: Math.min(100, pct), estado: pct >= 100 ? "ok" : pct >= 70 ? "medio" : "bajo", aviso: pct < 70 && pasadoMiercoles };
  });
  const corto = grupos.filter((g) => g.estado === "bajo").sort((a, b) => a.pct - b.pct)[0];

  const rutina = rutinaHoy(c);
  const semana = Array.from({ length: 7 }, (_, i) => {
    const f = sumarDias(ini, i);
    const s = base.sesiones.filter((x) => x.fecha === f);
    const letra = DIAS_LETRA[diaSemana(f)];
    if (s.length) return { fecha: f, letra, texto: s.map(abrev).join("+"), estado: "hecho" };
    if (f === hoy && rutina && rutina.origen !== "hecha" && deSemana.length < objetivo) return { fecha: f, letra, texto: ABREV_TIPO[rutina.tipo] ?? "hoy", estado: "hoy" };
    if (f > hoy) return { fecha: f, letra, texto: "", estado: "futuro" };
    return { fecha: f, letra, texto: "—", estado: base.pausas.has(f) ? "pausa" : "descanso" };
  });

  // Sensaciones (7 días)
  const ult7 = base.sesiones.filter((s) => diasEntre(s.fecha, hoy) <= 6 && s.fecha <= hoy);
  const rpes = ult7.flatMap((s) => s.ejercicios.flatMap((e) => e.series.filter((x) => x.trabajo && x.rpeEf !== null).map((x) => x.rpeEf)));
  const rpe = media(rpes);
  const sueno = media(ult7.map((s) => s.sueno_h));
  const zonas = new Map();
  for (const s of base.sesiones.filter((x) => diasEntre(x.fecha, hoy) <= 21)) for (const m of s.molestias) zonas.set(nombreZona(m), m.estado);

  const rex = construirRex(c, { deSemana, objetivo, rutina });
  const desc = descarga(c, ini);
  const nombreProg = ultima?.programa ? `${ultima.programa}${ultima.semana_programa ? ` · sem ${ultima.semana_programa}` : ""}` : null;
  return {
    vacio: base.total_sesiones === 0,
    cabecera: { semana: semanaISO(hoy).semana, programa: nombreProg, fecha: fechaLarga(hoy), ultimo_refresh: datos.ultimo_refresh },
    kpis: {
      racha: { dias: base.racha.actual, mejor: base.racha.mejor },
      sesiones: { hechas: deSemana.length, objetivo, pct: Math.min(100, Math.round((deSemana.length / objetivo) * 100)) },
      volumen: { t: redondear(t, 1), texto: num(t, 1), delta_pct: tAnt > 0 ? Math.round((t / tAnt - 1) * 100) : null },
      prs_mes: { n: prsMes.length, ultimo: prsMes.at(-1)?.nombre.toLowerCase() ?? null },
    },
    progresion,
    objetivos,
    grupos,
    grupos_nota: corto ? `${corto.nombre} va corto: faltan ${num(corto.objetivo - corto.series, 1)} series` : null,
    rutina,
    semana,
    sensaciones: {
      rpe: redondear(rpe, 1), rpe_pct: rpe ? Math.round(rpe * 10) : 0, sueno: horasMinutos(sueno), n: ult7.length,
      molestias: [...zonas.entries()].map(([zona, estado]) => ({ zona, estado })),
    },
    descarga: desc,
    rex,
    records_n: records.length,
  };
}

/** Rex: estado, bocadillo y detalle (PLAN §2.5). La cuenta atrás la pinta la página. */
export function construirRex(c, { deSemana, objetivo, rutina }) {
  const { base } = c;
  const hoy = base.hoy;
  const vivo = leerJSON(rutas(c.carpeta).vivo, null);
  // Capricho estacional (como en Huddle): calabaza el 31 de octubre y gorro en diciembre.
  const disfraz = hoy.slice(5) === "10-31" ? "calabaza" : hoy.slice(5, 7) === "12" ? "gorro" : null;
  const comun = { racha: base.racha.actual, nivel: base.nivel, disfraz };
  const detalle = `racha ${base.racha.actual} · nivel ${base.nivel}`;
  if (!base.total_sesiones) return { ...comun, estado: "reposo", bocadillo: "¡Hola! Soy Rex", detalle: "deja tus entrenos en CONTEXTO/ y usa /gymhub:refresh" };
  const pr = base.prs.filter((p) => diasEntre(p.fecha, hoy) <= 1 && p.fecha <= hoy).at(-1);
  if (vivo?.entreno && vivo.fecha === hoy) {
    const serie = vivo.serie_actual ? `serie ${vivo.serie_actual.n} de ${vivo.serie_actual.de} · ${vivo.serie_actual.ejercicio.toLowerCase()}` : null;
    const restante = vivo.descanso_s && vivo.descanso_inicio_ms ? vivo.descanso_s - (Date.now() - vivo.descanso_inicio_ms) / 1000 : 0;
    if (restante > 0) return { ...comun, estado: "descansando", bocadillo: "descanso", detalle: serie ?? detalle, descanso: { segundos: vivo.descanso_s, inicio_ms: vivo.descanso_inicio_ms, desfase_ms: vivo.reloj_desfase_ms || 0, restante_s: Math.round(restante) } };
    return { ...comun, estado: "levantando", bocadillo: pr ? `¡PR en ${pr.nombre.toLowerCase()}!` : vivo.serie_actual ? "¡Vamos!" : `¡A por ${(vivo.rutina?.titulo ?? "ello").toLowerCase()}!`, detalle: serie ?? detalle };
  }
  if (pr) return { ...comun, estado: "pr", bocadillo: `¡PR en ${pr.nombre.toLowerCase()}!`, detalle: `${pr.texto} · ${detalle}` };
  if (base.sesiones.some((s) => s.fecha === hoy)) return { ...comun, estado: "reposo", bocadillo: "¡Entreno de hoy hecho!", detalle };
  if (deSemana.length >= objetivo) return { ...comun, estado: "reposo", bocadillo: "Semana cumplida: hoy toca descansar", detalle };
  if (rutina) return { ...comun, estado: "toca", bocadillo: `¡Hoy toca ${NOMBRE_TIPO[rutina.tipo] ?? rutina.titulo.toLowerCase()}!`, detalle };
  return { ...comun, estado: "reposo", bocadillo: "Hoy toca descansar", detalle };
}
