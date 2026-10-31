// eventos.md: pausas declaradas e hitos que no son sesiones (FORMATO §3.8).
//   - 2024-08-01 → 2024-08-15 · pausa · vacaciones
//   - 2025-01-07 · programa · Fuerza 12 semanas
//   - 2025-03-02 · hito · primera competición
import { sumarDias, diasEntre } from "./util.mjs";

export const TIPOS_EVENTO = ["pausa", "programa", "hito"];

export function leerEventos(texto) {
  const eventos = [], errores = [];
  for (const l of String(texto ?? "").replace(/<!--[\s\S]*?-->/g, "").split("\n")) {
    const m = l.match(/^\s*[-*]\s*(\d{4}-\d{2}-\d{2})(?:\s*(?:→|->|a)\s*(\d{4}-\d{2}-\d{2}))?\s*·\s*([a-záéíóú]+)\s*(?:·\s*(.*))?$/i);
    if (!m) { if (/^\s*[-*]\s*\d{4}-/.test(l)) errores.push(`línea de eventos no entendida: «${l.trim()}»`); continue; }
    let tipo = m[3].toLowerCase();
    if (["vacaciones", "lesion", "lesión", "descanso"].includes(tipo)) tipo = "pausa";
    if (!TIPOS_EVENTO.includes(tipo)) { errores.push(`tipo de evento desconocido «${m[3]}»`); continue; }
    eventos.push({ desde: m[1], hasta: m[2] || m[1], tipo, texto: (m[4] || "").trim() });
  }
  return { eventos, errores };
}

export const lineaEvento = (e) => `- ${e.desde}${e.hasta && e.hasta !== e.desde ? ` → ${e.hasta}` : ""} · ${e.tipo}${e.texto ? ` · ${e.texto}` : ""}`;

/** Conjunto de días (AAAA-MM-DD) cubiertos por pausas declaradas. */
export function diasDePausa(eventos) {
  const dias = new Set();
  for (const e of eventos) {
    if (e.tipo !== "pausa") continue;
    const n = Math.min(diasEntre(e.desde, e.hasta), 400);
    for (let i = 0; i <= n; i++) dias.add(sumarDias(e.desde, i));
  }
  return dias;
}
