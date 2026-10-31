// Récords por ejercicio, records.md y el «Estado actual» de FICHA.md.
import { num, fechaCorta, diasEntre, aFecha } from "./util.mjs";
import { secciones, ponerSeccion } from "./ficha.mjs";

/** Valor de un récord en texto: «92,5 kg», «PC+20 kg», «nivel 11», «90 s», «15 reps». */
export function textoValor(escala, valor) {
  switch (escala) {
    case "kg": return `${num(valor)} kg`;
    case "lastre": return `PC${valor >= 0 ? "+" : "−"}${num(Math.abs(valor))} kg`;
    case "nivel": return `nivel ${num(valor)}`;
    case "tiempo": return `${num(valor, 0)} s`;
    case "reps": return `${num(valor, 0)} reps`;
    default: return String(valor);
  }
}

/** El mejor registro de cada ejercicio, del más usado al menos usado (principales primero). */
export function recordsPorEjercicio(base) {
  const out = [];
  for (const h of base.porEjercicio.values()) {
    let mejor = null;
    for (const s of h.sesiones) if (s.mejor && (!mejor || s.mejor.valor[0] > mejor.mejor.valor[0] + 1e-9 || (Math.abs(s.mejor.valor[0] - mejor.mejor.valor[0]) <= 1e-9 && s.mejor.valor[1] > mejor.mejor.valor[1]))) mejor = s;
    if (!mejor) continue;
    out.push({
      id: h.id, nombre: h.nombre, escala: h.escala, valor: mejor.mejor.valor[0], e1rm: mejor.mejor.e1rm,
      texto_valor: textoValor(h.escala, mejor.mejor.valor[0]), serie: mejor.mejor.texto, fecha: mejor.fecha,
      nuevo: base.hoy ? diasEntre(mejor.fecha, base.hoy) <= 7 && diasEntre(mejor.fecha, base.hoy) >= 0 : false,
      principal: !!h.ficha?.principal, sesiones: h.sesiones.length,
    });
  }
  return out.sort((a, b) => Number(b.principal) - Number(a.principal) || b.sesiones - a.sesiones || a.nombre.localeCompare(b.nombre));
}

/** Rehace records.md conservando «Marcas declaradas». */
export function escribirRecordsMd(textoAnterior, base, records) {
  const sec = secciones(textoAnterior || "");
  const marcas = (Object.entries(sec).find(([k]) => k.startsWith("marcas declaradas"))?.[1] ?? ["<!-- Marcas que apuntaste sin detalle de la sesión. Se muestran como referencia. -->"]).join("\n").trim();
  const lineas = ["# Récords", "", "## PRs calculados", "<!-- Los genera gymhub a partir de tus sesiones y se rehacen en cada /gymhub:refresh: no los edites aquí. -->", ""];
  if (!records.length) lineas.push("Todavía no hay sesiones con series de trabajo.");
  else {
    lineas.push("| ejercicio | mejor | serie | fecha |", "|---|---|---|---|");
    for (const r of records) lineas.push(`| ${r.nombre} | ${r.texto_valor}${r.escala === "kg" ? " (e1RM)" : ""} | ${r.serie} | ${r.fecha} |`);
    const ult = base.prs.slice(-30).reverse();
    if (ult.length) {
      lineas.push("", "### Últimos PRs", "");
      for (const p of ult) lineas.push(`- ${p.fecha} · ${p.nombre} · ${textoValor(p.escala, p.valor)}${p.escala === "kg" ? " e1RM" : ""} (${p.texto})`);
    }
  }
  lineas.push("", "## Marcas declaradas", marcas, "");
  return lineas.join("\n");
}

/** Molestias activas: zonas cuyo último estado (en 21 días) no es «bien». */
export function molestiasActivas(base, dias = 21) {
  const ultimo = new Map();
  for (const s of base.sesiones) for (const m of s.molestias) ultimo.set(`${m.zona}|${m.lado ?? ""}`, { ...m, fecha: s.fecha });
  return [...ultimo.values()].filter((m) => m.estado !== "bien" && (!base.hoy || diasEntre(m.fecha, base.hoy) <= dias))
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
}

export const nombreZona = (m) => `${m.zona}${m.lado && m.lado !== "ambos" ? ` ${m.lado}.` : ""}`;

/** Reescribe la sección «Estado actual» de FICHA.md con cifras del script. */
export function actualizarEstadoFicha(textoFicha, base, records) {
  const anio = base.hoy ? aFecha(base.hoy).getFullYear() : null;
  const principales = records.filter((r) => r.escala === "kg" && (r.principal || r.sesiones >= 5)).slice(0, 6);
  const mol = molestiasActivas(base);
  const cuerpo = [
    "<!-- Lo actualiza /gymhub:refresh con cifras calculadas. No hace falta tocarlo. -->",
    `- e1RM: ${principales.length ? principales.map((r) => `${r.nombre.toLowerCase()} ${num(r.valor)}`).join(" · ") : "sin datos todavía"}`,
    `- Molestias activas: ${mol.length ? mol.map((m) => `${nombreZona(m)} (${m.estado}, ${fechaCorta(m.fecha, anio)})`).join(" · ") : "ninguna"}`,
    `- Sesiones: ${base.total_sesiones}${base.ultima ? ` · última ${base.ultima}` : ""} · racha ${base.racha.actual}`,
  ].join("\n");
  return ponerSeccion(textoFicha, "Estado actual", cuerpo);
}
