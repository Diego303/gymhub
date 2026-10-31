// Vista Ejercicios (PLAN §2.4b): la ficha completa de cada ejercicio con su historial.
import { NOMBRE_GRUPO } from "./catalogo.mjs";
import { objetivosFicha, ejeY } from "./panel.mjs";
import { textoValor } from "./records.mjs";
import { primeraFrase } from "./diario.mjs";
import { sumarDias, diasEntre, redondear, fechaCorta, aFecha, claveTexto, MESES, media, decimalEs } from "./util.mjs";

const REPS_TABLA = [1, 2, 3, 4, 5, 6, 8, 10];
const UNIDAD = { kg: "kg", carga: "kg", lastre: "kg de lastre", nivel: "nivel", tiempo: "s", reps: "reps" };

/** Valor de una sesión en la escala del ejercicio (e1RM en kg; si no, su valor principal). */
const valorSesion = (s, escala) => (escala === "kg" ? s.e1rm : s.mejor?.valor?.[0] ?? null);

function menciones(base, h, catalogo) {
  const f = h.ficha ?? catalogo?.obtener(h.id);
  const claves = [h.nombre, h.id.replace(/-/g, " "), ...(f?.alias ?? [])].map(claveTexto).filter((k) => k.length >= 4);
  const out = [];
  for (const s of [...base.sesiones].reverse()) {
    if (!s.notas) continue;
    for (const frase of s.notas.split(/(?<=[.!?])\s+|\n+/)) {
      const k = claveTexto(frase);
      if (claves.some((c) => new RegExp(`(^| )${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( |$)`).test(k))) { out.push({ fecha: s.fecha, texto: primeraFrase(frase) }); break; }
    }
    if (out.length >= 6) break;
  }
  return out;
}

export function fichaEjercicio(c, h) {
  const { base, catalogo } = c;
  const hoy = base.hoy, anio = aFecha(hoy).getFullYear();
  const f = h.ficha;
  const escala = h.escala;
  const ses = h.sesiones.filter((s) => s.mejor);
  const valores = ses.map((s) => valorSesion(s, escala));
  const ultima = ses.at(-1);
  const objetivo = objetivosFicha(c).find((o) => o.id === h.id)?.objetivo ?? null;
  // Mejor marca: la mayor carga levantada (con sus reps y fecha).
  let marca = null;
  for (const s of ses) for (const x of s.series) if (x.kg && (!marca || x.kg > marca.kg + 1e-9)) marca = { kg: x.kg, reps: x.reps?.texto, fecha: s.fecha, texto: decimalEs(`${x.carga.texto} × ${x.reps?.texto}`) };
  // Variación en 12 meses: mejor de las últimas 8 semanas frente a las 8 semanas de hace un año.
  const mejorEntre = (d, a) => Math.max(0, ...ses.filter((s) => s.fecha >= d && s.fecha <= a).map((s) => valorSesion(s, escala) || 0)) || null;
  const ahora = mejorEntre(sumarDias(hoy, -55), hoy);
  const antes = mejorEntre(sumarDias(hoy, -365 - 28), sumarDias(hoy, -365 + 28));
  const var12 = ahora && antes ? redondear((ahora / antes - 1) * 100, 1) : null;
  const ult12 = ses.filter((s) => diasEntre(s.fecha, hoy) <= 365);
  const meses = Math.max(1, Math.min(12, diasEntre(ses[0]?.fecha ?? hoy, hoy) / 30.44));
  // Puntos del gráfico y ejes por rango (la página solo filtra y dibuja)
  const puntos = ses.map((s) => ({ fecha: s.fecha, v: redondear(valorSesion(s, escala), 1), serie: s.mejor.texto, rpe: s.mejor.rpe, series: s.series_trabajo, pr: s.pr }));
  const mesMejor = new Map();
  for (const p of puntos) { const k = p.fecha.slice(0, 7); if (!mesMejor.has(k) || p.v > mesMejor.get(k).v) mesMejor.set(k, p); }
  const rangos = {};
  for (const [r, dias] of [["6M", 182], ["1A", 365], ["Todo", null]]) {
    const desde = dias ? sumarDias(hoy, -dias) : ses[0]?.fecha ?? hoy;
    const vs = puntos.filter((p) => p.fecha >= desde).map((p) => p.v);
    rangos[r] = { desde, ...ejeY([...vs, escala === "kg" ? objetivo : null]) };
  }
  // Mejor peso por repeticiones (a esas reps o más)
  const tabla = REPS_TABLA.map((r) => {
    let m = null;
    for (const s of ses) for (const x of s.series) {
      const n = x.reps?.tipo === "n" ? x.reps.n : x.reps?.tipo === "lados" ? x.reps.min : 0;
      if (x.kg && n >= r && (!m || x.kg > m.kg + 1e-9)) m = { kg: x.kg, carga: x.carga.texto, fecha: s.fecha };
    }
    return m ? { reps: r, kg: redondear(m.kg, 1), carga: decimalEs(m.carga), fecha: m.fecha, fecha_texto: fechaCorta(m.fecha, anio), reciente: diasEntre(m.fecha, hoy) <= 60 } : { reps: r, kg: null };
  });
  const maxTabla = Math.max(0, ...tabla.map((t) => t.kg || 0));
  for (const t of tabla) t.pct = t.kg && maxTabla ? Math.round((t.kg / maxTabla) * 100) : 0;
  // Series de trabajo por mes (últimos 12)
  const porMes = [];
  const d = aFecha(hoy);
  for (let i = 11; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const k = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
    porMes.push({ mes: k, etiqueta: MESES[m.getMonth()], series: ses.filter((s) => s.fecha.startsWith(k)).reduce((a, s) => a + s.series_trabajo, 0) });
  }
  const maxMes = Math.max(1, ...porMes.map((m) => m.series));
  for (const m of porMes) m.pct = Math.round((m.series / maxMes) * 100);
  return {
    id: h.id, nombre: h.nombre, escala, unidad: UNIDAD[escala] ?? "",
    chips: [NOMBRE_GRUPO[f?.grupo] ?? f?.grupo, f?.patron, f?.carga].filter(Boolean),
    objetivo: objetivo ? redondear(objetivo, 1) : null,
    desde: ses[0]?.fecha ?? null, desde_texto: ses[0] ? fechaCorta(ses[0].fecha, anio - 100) : null,
    n_sesiones: h.sesiones.length, n_series: h.sesiones.reduce((a, s) => a + s.series_trabajo, 0),
    kpis: {
      actual: ultima ? { valor: redondear(valorSesion(ultima, escala), 1), texto: escala === "kg" ? null : textoValor(escala, valorSesion(ultima, escala)), fecha: ultima.fecha, fecha_texto: fechaCorta(ultima.fecha, anio) } : null,
      marca: marca ? { ...marca, kg: redondear(marca.kg, 1), fecha_texto: fechaCorta(marca.fecha, anio) } : null,
      var12, frecuencia: redondear(ult12.length / Math.min(12, meses), 1), prs: ses.filter((s) => s.pr).length,
    },
    puntos, mensual: [...mesMejor.values()].map((p) => ({ fecha: p.fecha, v: p.v })), rangos,
    tabla, por_mes: porMes,
    ultimas: ses.slice(-6).reverse().map((s) => ({ fecha: s.fecha, fecha_texto: fechaCorta(s.fecha, anio), series: s.series_trabajo, mejor: s.mejor.texto, rpe: s.mejor.rpe, valor: redondear(valorSesion(s, escala), 1), pr: s.pr })),
    notas: menciones(base, h, catalogo).map((m) => ({ ...m, fecha_texto: fechaCorta(m.fecha, anio) })),
  };
}

/** Minigráfico: las 20 últimas sesiones normalizadas a 0-1. */
function sparkline(h) {
  const v = h.sesiones.filter((s) => s.mejor).slice(-20).map((s) => valorSesion(s, h.escala) || 0);
  const mn = Math.min(...v), mx = Math.max(...v);
  return v.map((x) => (mx > mn ? redondear((x - mn) / (mx - mn), 3) : 0.5));
}

export function construirEjercicios(c) {
  const { base } = c;
  const hoy = base.hoy;
  const lista = [...base.porEjercicio.values()].filter((h) => h.sesiones.length >= 3 && h.escala).sort((a, b) => b.sesiones.length - a.sesiones.length);
  return {
    vacio: !lista.length,
    lista: lista.map((h) => {
      const ses = h.sesiones.filter((s) => s.mejor);
      const actual = ses.length ? valorSesion(ses.at(-1), h.escala) : null;
      const hace = ses.filter((s) => diasEntre(s.fecha, hoy) >= 330 && diasEntre(s.fecha, hoy) <= 400);
      const ref = hace.length ? media(hace.map((s) => valorSesion(s, h.escala) || 0)) : null;
      const reciente = ses.filter((s) => diasEntre(s.fecha, hoy) <= 56).map((s) => valorSesion(s, h.escala) || 0);
      return {
        id: h.id, nombre: h.nombre, grupo: NOMBRE_GRUPO[h.ficha?.grupo] ?? h.ficha?.grupo ?? "", escala: h.escala,
        actual: redondear(actual, 1), texto_actual: actual === null ? "—" : textoValor(h.escala, actual),
        spark: sparkline(h), var12: ref && reciente.length ? Math.round((Math.max(...reciente) / ref - 1) * 100) : null, sesiones: h.sesiones.length,
      };
    }),
    fichas: Object.fromEntries(lista.map((h) => [h.id, fichaEjercicio(c, h)])),
  };
}
