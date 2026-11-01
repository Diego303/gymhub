// G2 · Métricas en los límites: 0 kg, asistidas por encima del peso corporal, objetivos a 0, ningún
// NaN ni Infinity, tendencias con 0, 1 y 2 puntos, y formato de horas.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { calcularBase } from "../lib/base.mjs";
import { leerSesion } from "../lib/canonico.mjs";
import { leerCatalogo } from "../lib/catalogo.mjs";
import { leerFicha } from "../lib/ficha.mjs";
import { construirAnalisis } from "../lib/analisis.mjs";
import { RAIZ } from "./ayuda.mjs";

export const CAT = leerCatalogo(readFileSync(join(RAIZ, "templates/GIMNASIO/ejercicios.md"), "utf8"));
const CAB = "| # | tipo | carga | reps | rpe | rir | nota |\n|---|---|---|---|---|---|---|";
export const ses = (fecha, filas, { id = "curl-biceps", fm = "" } = {}) =>
  leerSesion(`---\nfecha: ${fecha}\nconfianza: alta\n${fm}---\n## Ejercicios\n### X\n<!-- id: ${id} -->\n${CAB}\n${filas.map((f, i) => `| ${i + 1} | ${f} |`).join("\n")}\n`, `sesiones/${fecha.slice(0, 4)}/${fecha}.md`);

test("un ejercicio a «0 kg» no rompe la vista Análisis y no cuenta como escala de kg", () => {
  const sesiones = ["2026-09-01", "2026-09-08", "2026-09-15", "2026-09-22", "2026-10-20"].map((f) => ses(f, ["trabajo | 0 kg | 10 | | | "]));
  const ficha = leerFicha("");
  const base = calcularBase(sesiones, { catalogo: CAT, hoy: "2026-10-31", ficha });
  assert.equal(base.porEjercicio.get("curl-biceps").escala, "reps");
  const A = construirAnalisis({ base, ficha, config: {}, catalogo: CAT });
  assert.deepEqual(A.estancados, []);
  // Una asistida con más ayuda que el peso corporal (PC−90 con 80 kg) tampoco es «kg»
  const asist = calcularBase([ses("2026-10-01", ["trabajo | PC-90 kg | 8 | | | "], { id: "dominadas", fm: "peso_corporal_kg: 80\n" })], { catalogo: CAT, hoy: "2026-10-31", ficha });
  assert.equal(asist.porEjercicio.get("dominadas").escala, "lastre");
  assert.equal(asist.sesiones[0].toneladas_kg, 0);
});

test("las horas se redondean al minuto sin dar «7h 60m»", async () => {
  const { horasMinutos } = await import("../lib/panel.mjs");
  assert.equal(horasMinutos(7.995), "8h 00m");
  assert.equal(horasMinutos(6.75), "6h 45m");
  assert.equal(horasMinutos(0.004), "0h 00m");
  assert.equal(horasMinutos(null), null);
});

/** Rutas del objeto con números que no son finitos (JSON.stringify los convertiría en null sin avisar). */
export function noFinitos(x, ruta = "datos", out = []) {
  if (typeof x === "number" && !Number.isFinite(x)) out.push(`${ruta} = ${x}`);
  else if (x && typeof x === "object") for (const [k, v] of Object.entries(x)) noFinitos(v, `${ruta}.${k}`, out);
  return out;
}

test("ninguna vista da NaN ni Infinity ni errores: vacío, una sesión, «mini» y una FICHA con ceros", async () => {
  const { temporal } = await import("./ayuda.mjs");
  const { writeFileSync, mkdirSync } = await import("node:fs");
  const { contexto, VISTAS_WEB } = await import("../lib/derivar.mjs");
  const { construirDatos } = await import("../lib/vistas.mjs");
  const { generarMini, HOY } = await import("./fixtures/mini.mjs");
  const catalogo = readFileSync(join(RAIZ, "templates/GIMNASIO/ejercicios.md"), "utf8");
  const casos = {
    vacio: (d) => { writeFileSync(join(d, "FICHA.md"), "# Ficha\n"); writeFileSync(join(d, "ejercicios.md"), catalogo); mkdirSync(join(d, "sesiones")); },
    una: (d) => { casos.vacio(d); mkdirSync(join(d, "sesiones", "2026")); writeFileSync(join(d, "sesiones", "2026", "2026-11-05.md"), "---\nfecha: 2026-11-05\nconfianza: alta\n---\n## Ejercicios\n### Banca\n<!-- id: press-banca -->\n" + CAB + "\n| 1 | trabajo | 60 kg | 5 | 8 | | |\n"); },
    mini: (d) => generarMini(d, { catalogo }),
    ceros: (d) => { generarMini(d, { catalogo }); writeFileSync(join(d, "FICHA.md"), "# Ficha\n## Objetivos\n- dias_semana: 0\n- press-banca: 0 kg\n## Series objetivo por semana\npecho 0 · pierna 0\n## Datos\n- peso_corporal: 0 kg\n- sueno_objetivo: 0 h\n## Referencias de fuerza\nbanca 0 · sentadilla 0\n## Rangos de equilibrio\nempuje:tiron 0–0\n"); },
  };
  for (const [nombre, preparar] of Object.entries(casos)) {
    const t = temporal();
    try {
      process.env.GYMHUB_CONFIG = join(t.dir, "config.json");
      preparar(t.dir);
      const datos = construirDatos(contexto(t.dir, { hoy: HOY }), VISTAS_WEB);
      assert.deepEqual(noFinitos(datos), [], nombre);
      for (const [v] of VISTAS_WEB) assert.equal(datos[v]?.error, undefined, `${nombre}: ${v}: ${datos[v]?.error}`);
      if (nombre === "ceros") assert.deepEqual(datos.panel.objetivos, [], "un objetivo de 0 kg no es un objetivo");
    } finally { delete process.env.GYMHUB_CONFIG; t.limpiar(); }
  }
});
