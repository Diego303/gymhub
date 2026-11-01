// pnpm test:rendimiento (G6): 5 años inventados (~1.000 sesiones, ~20.000 series) en os.tmpdir().
//   - métricas completas (leer, validar, calcular todas las vistas) < 2 s, en frío y con caché
//   - datos.js publicado < 1 s, y de un tamaño razonable (< 3 MB)
// Va en su propio paso (no en paralelo con la suite) y toma la mejor de 3 medidas de cada cosa.
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generarCincoAnios } from "../tests/fixtures/cinco-anios.mjs";
import { TEXTO_CATALOGO } from "../tests/fixtures/ayuda-metricas.mjs";
import { writeFileSync } from "node:fs";

const dir = mkdtempSync(join(tmpdir(), "gymhub-rendimiento-"));
process.env.GYMHUB_CONFIG = join(dir, "config.json");
const carpeta = join(dir, "G");
const { crearEstructura } = await import("../lib/estructura.mjs");
const { contexto, VISTAS_WEB } = await import("../lib/derivar.mjs");
const { construirDatos } = await import("../lib/vistas.mjs");
const { publicar } = await import("../lib/publicar.mjs");
const { rutas } = await import("../lib/config.mjs");
const { escribirJSON } = await import("../lib/util.mjs");
let fallos = 0;
const comprobar = (nombre, ms, limite) => { const ok = ms < limite; if (!ok) fallos++; console.log(`${ok ? "✔" : "✖"} ${nombre}: ${Math.round(ms)} ms (límite ${limite} ms)`); };
try {
  crearEstructura(carpeta);
  writeFileSync(join(carpeta, "ejercicios.md"), TEXTO_CATALOGO);
  const { sesiones, series } = generarCincoAnios(carpeta);
  console.log(`5 años inventados: ${sesiones} sesiones, ${series} series de trabajo`);
  const medir = (fn, n = 3) => { let mejor = Infinity, r; for (let i = 0; i < n; i++) { const t0 = performance.now(); r = fn(i); mejor = Math.min(mejor, performance.now() - t0); } return { ms: mejor, r }; };
  const calcular = () => { const c = contexto(carpeta, { hoy: "2026-10-31" }); return { c, datos: construirDatos(c, VISTAS_WEB) }; };
  const frio = medir(() => { rmSync(rutas(carpeta).cache, { force: true }); return calcular(); });
  if (frio.r.c.conErrores.length) throw new Error(`${frio.r.c.conErrores.length} sesiones con errores`);
  comprobar("métricas completas en frío (sin caché)", frio.ms, 2000);
  const caliente = medir(() => calcular());
  comprobar("métricas completas con la caché de sesiones", caliente.ms, 2000);
  escribirJSON(rutas(carpeta).datos, caliente.r.datos);
  comprobar("publicar datos.js", medir(() => publicar(carpeta)).ms, 1000);
  const kb = statSync(join(carpeta, ".gymhub", "web", "datos.js")).size / 1024;
  const ok = kb < 3 * 1024;
  if (!ok) fallos++;
  console.log(`${ok ? "✔" : "✖"} tamaño de datos.js: ${Math.round(kb)} KB (límite 3.072 KB)`);
} finally { rmSync(dir, { recursive: true, force: true }); }
process.exit(fallos ? 1 : 0);
