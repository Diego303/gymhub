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
await derivarCarpeta(carpeta, { md: true, hoy });
const p = publicar(carpeta);
console.log(`Demo: ${g.sesiones} sesiones sintéticas (${g.desde} → ${g.hasta}) · ${p.ruta}`);
