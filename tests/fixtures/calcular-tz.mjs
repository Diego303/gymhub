// Calcula datos.json (sin la ruta de la carpeta) de un caso inventado y lo imprime: lo usa
// tests/zona-horaria.test.mjs para comparar el resultado en varias zonas horarias.
//   TZ=Europe/Madrid node tests/fixtures/calcular-tz.mjs <mini|horario|aleatorio> <hoy>
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { escribirSesion } from "../../lib/canonico.mjs";
import { contexto, VISTAS_WEB } from "../../lib/derivar.mjs";
import { construirDatos } from "../../lib/vistas.mjs";
import { sumarDias } from "../../lib/util.mjs";
import { generarMini } from "./mini.mjs";
import { TEXTO_CATALOGO } from "./ayuda-metricas.mjs";
import { prng } from "./aleatorio.mjs";

const [caso, hoy] = process.argv.slice(2);
const dir = mkdtempSync(join(tmpdir(), "gymhub-tz-"));
process.env.GYMHUB_CONFIG = join(dir, "config.json");
const sesion = (fecha, kg, extra = {}) => escribirSesion({ fecha, titulo: "S", tipo: "full", sueno_h: 7, sensacion_pre: 7, molestias: [], confianza: "alta", calentamiento: "", cardio: [], notas: "nota", original: null, otras: {}, extra: {},
  ejercicios: [{ id: "press-banca", nombre: "Press banca", superserie: null, orden_superserie: null, nota: null, series: [1, 2, 3].map((n) => ({ n, tipo: "trabajo", carga: { texto: `${kg} kg` }, reps: { texto: "5" }, rpe: 8, rir: null, nota: null })) }], ...extra });
const escribir = (fecha, texto) => { mkdirSync(join(dir, "sesiones", fecha.slice(0, 4)), { recursive: true }); writeFileSync(join(dir, "sesiones", fecha.slice(0, 4), `${fecha}.md`), texto); };
try {
  if (caso === "mini") generarMini(dir, { catalogo: TEXTO_CATALOGO });
  else {
    writeFileSync(join(dir, "ejercicios.md"), TEXTO_CATALOGO);
    writeFileSync(join(dir, "FICHA.md"), "# Ficha\n## Objetivos\n- dias_semana: 3\n- press-banca: 120 kg\n");
    if (caso === "horario") {
      // Días seguidos alrededor de los cambios de hora de Madrid (29 mar, 25 oct) y de Los Ángeles (8 mar, 1 nov) de 2026
      let k = 0;
      for (const ini of ["2026-03-05", "2026-03-26", "2026-10-22", "2026-10-29"]) for (let i = 0; i < 6; i++) escribir(sumarDias(ini, i), sesion(sumarDias(ini, i), 60 + 2.5 * k++));
      writeFileSync(join(dir, "eventos.md"), "- 2026-03-28 → 2026-03-30 · pausa · viaje\n");
    } else {
      const g = prng(4242);
      let f = "2025-12-20";
      for (let i = 0; i < 80; i++) { f = sumarDias(f, g.ent(1, 4)); escribir(f, sesion(f, g.ent(16, 40) * 2.5)); }
    }
  }
  const datos = construirDatos(contexto(dir, { hoy }), VISTAS_WEB);
  delete datos.carpeta;
  process.stdout.write(JSON.stringify(datos));
} finally { rmSync(dir, { recursive: true, force: true }); }
