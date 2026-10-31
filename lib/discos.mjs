// Discos por lado para un peso total (con la barra y los discos de la config).
export const COLOR_DISCO = { 25: "#E24B4A", 20: "#378ADD", 15: "#EF9F27", 10: "#1D9E75", 5: "#F1EFE8", 2.5: "#444441", 1.25: "#B4B2A9" };
export const ALTO_DISCO = { 25: 58, 20: 54, 15: 48, 10: 42, 5: 34, 2.5: 28, 1.25: 22 };

/** { por_lado: [20, 20, 10], sobra: 0 } o null si el peso no llega a la barra. */
export function discosPorLado(total, { barra = 20, discos = [25, 20, 15, 10, 5, 2.5, 1.25] } = {}) {
  if (!(total >= barra)) return null;
  let lado = (total - barra) / 2;
  const por_lado = [];
  for (const d of [...discos].sort((a, b) => b - a)) {
    while (lado >= d - 1e-9) { por_lado.push(d); lado -= d; }
  }
  return { por_lado, sobra: Math.round(lado * 2 * 100) / 100 };
}

/** Tabla precalculada para la calculadora de la web: de la barra a 300 kg, en pasos del disco más pequeño ×2. */
export function tablaDiscos({ barra = 20, discos = [25, 20, 15, 10, 5, 2.5, 1.25], hasta = 300 } = {}) {
  const paso = Math.min(...discos) * 2;
  const tabla = {};
  for (let kg = barra; kg <= hasta + 1e-9; kg = Math.round((kg + paso) * 100) / 100) tabla[String(kg)] = discosPorLado(kg, { barra, discos }).por_lado;
  return { barra, paso, hasta, discos, colores: Object.fromEntries(discos.map((d) => [d, COLOR_DISCO[d] ?? "#888780"])), altos: Object.fromEntries(discos.map((d) => [d, ALTO_DISCO[d] ?? 30])), tabla };
}

export const textoDiscos = (r) => (!r ? "no llega a la barra" : r.por_lado.length ? `por lado: ${r.por_lado.map((d) => String(d).replace(".", ",")).join(" + ")}${r.sobra ? ` (sobran ${String(r.sobra).replace(".", ",")} kg)` : ""}` : "solo la barra");
