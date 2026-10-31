// Crea una carpeta de demo con el historial SINTÉTICO de ~2 años y publica su web.
//   node scripts/demo.mjs <carpeta> [--hoy 2026-10-31] [--proceso]   (usa una config aislada en <carpeta>/../config-demo.json)
import { join, dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const carpeta = resolve(args[0] || "demo/GIMNASIO");
const hoy = args.includes("--hoy") ? args[args.indexOf("--hoy") + 1] : "2026-10-31";
process.env.GYMHUB_CONFIG = process.env.GYMHUB_CONFIG || join(dirname(carpeta), "config-demo.json");
process.env.GYMHUB_HOY = hoy;
process.env.GYMHUB_NO_ABRIR = "1";
spawnSync(process.execPath, [join(RAIZ, "bin/gymhub.mjs"), "configurar", carpeta], { stdio: "ignore", env: process.env });
const { generarHistorial } = await import("../tests/fixtures/historial.mjs");
const { derivarCarpeta } = await import("../lib/derivar.mjs");
const { publicar, ponerProceso } = await import("../lib/publicar.mjs");
const { escribirJSON } = await import("../lib/util.mjs");
const g = generarHistorial(carpeta, { hoy });
escribirJSON(join(carpeta, ".gymhub/importacion.json"), { version: 1, estado: "cerrada", ultimo_refresh: new Date(Date.now() - 3 * 3600e3).toISOString(), lotes: [] });
if (args.includes("--proceso")) ponerProceso(carpeta, { activo: true, fase: "normalizando", lote: 7, lotes_total: 18, pct: 41, mensaje: "Normalizando · lote 7 de 18 (2024-03)", dudas: 1 });
// Dos repasos de /gymhub:semana inventados (la semana actual y la de hace dos), para ver la pestaña Semana.
const { componerRepaso } = await import("../lib/semanas.mjs");
const { writeFileSync, mkdirSync } = await import("node:fs");
const REPASOS = {
  "2026-W44": ["- ✓ Llevas 3 de 4 sesiones y la de pierna B es hoy.", "- ▲ Abdomen y gemelo se han quedado por debajo del 70 % de tu media.", "- ! Molestias en el hombro izq. en 3 sesiones seguidas; se repite: valora consultarlo.", "- → Próxima semana: core al final de dos sesiones y vigilar el volumen de empuje.",
    "¿Cómo te has sentido?: Con energía, aunque el jueves llegué cansado del trabajo.", "¿Molestias?: Hombro izquierdo algo cargado tras banca; nada que limite.", "¿Qué priorizas la semana que viene?: Core y dormir al menos 7 h."],
  "2026-W42": ["- ✓ Cumpliste el objetivo: 4 de 4 sesiones y con más volumen que tu media.", "- ★ 2 PRs: remo con barra 62,5 kg × 10 y curl femoral tumbado 55 kg × 12.", "- → Próxima semana: mantén el plan e intenta subir 2,5 kg en los básicos.",
    "¿Cómo te has sentido?: Muy bien, con ganas.", "¿Molestias?: Ninguna.", "¿Qué priorizas la semana que viene?: Subir peso en banca."],
};
mkdirSync(join(carpeta, "semanas"), { recursive: true });
for (const [clave, l] of Object.entries(REPASOS)) {
  const rep = l.filter((x) => x.startsWith("- ")), pre = l.filter((x) => !x.startsWith("- ")).map((x) => `- ${x}`);
  writeFileSync(join(carpeta, "semanas", `${clave}.md`), componerRepaso(clave, `## Repaso\n${rep.join("\n")}\n\n## Preguntas\n${pre.join("\n")}\n`, clave === "2026-W44" ? "2026-10-31T21:10" : "2026-10-18T20:45").texto);
}
await derivarCarpeta(carpeta, { md: true, hoy });
const p = publicar(carpeta);
console.log(`Demo: ${g.sesiones} sesiones sintéticas (${g.desde} → ${g.hasta}) · ${p.ruta}`);
