// G1 · convenciones.md: cada convención que entiende el script se aplica; si chocan, avisa.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { leerEquivalencias, leerOrdenFechas } from "../lib/convenciones.mjs";
import { leerCatalogo } from "../lib/catalogo.mjs";
import { kgCarga } from "../lib/series.mjs";
import { leerCarga } from "../lib/canonico.mjs";
import { RAIZ } from "./ayuda.mjs";

const CAT = leerCatalogo(readFileSync(join(RAIZ, "templates/GIMNASIO/ejercicios.md"), "utf8"));

test("la equivalencia de nivel se entiende también como en el ejemplo de FORMATO §4 (sin «equivalencia»)", () => {
  const conv = "## Unidades y máquinas\n- \"flecha N\" = posición de máquina (nivel N)\n- jalón: nivel 1 = 5 kg, +5 kg por nivel\n- las mancuernas se apuntan por mano\n";
  const eq = leerEquivalencias(conv, CAT);
  assert.deepEqual(eq.get("jalon-pecho"), { nivel: 1, base: 5, paso: 5 });
  assert.equal(eq.size, 1, "las demás líneas no son equivalencias");
  assert.equal(kgCarga(leerCarga("nivel 7"), { equivalencia: eq.get("jalon-pecho") }), 35);
  // La forma de la plantilla sigue valiendo
  assert.deepEqual(leerEquivalencias("- equivalencia jalon-pecho: nivel 2 = 10 kg, +2,5 kg por nivel", CAT).get("jalon-pecho"), { nivel: 2, base: 10, paso: 2.5 });
});

test("si dos convenciones chocan, avisa (y sigue usando la misma que antes)", async () => {
  const { leerConvenciones } = await import("../lib/convenciones.mjs");
  const conv = "## Fechas\n- orden: día/mes\n- orden: mes/día\n## Unidades\n- jalón: nivel 1 = 5 kg, +5 kg por nivel\n- equivalencia jalon-pecho: nivel 1 = 10 kg, +5 kg por nivel\n";
  const r = leerConvenciones(conv, CAT);
  assert.equal(r.orden, "dm");
  assert.deepEqual(r.equivalencias.get("jalon-pecho"), { nivel: 1, base: 10, paso: 5 });
  assert.equal(r.avisos.length, 2, r.avisos.join("\n"));
  assert.match(r.avisos[0], /convenciones\.md: el orden de las fechas aparece con dos valores \(día\/mes y mes\/día\); se usa día\/mes/);
  assert.match(r.avisos[1], /convenciones\.md: jalon-pecho tiene dos equivalencias distintas; se usa la última/);
  // Sin choques, sin avisos; sin fichero, los valores por defecto
  assert.deepEqual(leerConvenciones("- orden: día/mes\n- orden: dd/mm\n", CAT).avisos, []);
  const vacio = leerConvenciones(null, CAT);
  assert.equal(vacio.orden, null);
  assert.equal(vacio.equivalencias.size, 0);
  assert.deepEqual(vacio.avisos, []);
});

test("los avisos de convenciones llegan a datos.json y a lo que lee Claude («contexto»)", async () => {
  const { temporal, cli } = await import("./ayuda.mjs");
  const { writeFileSync } = await import("node:fs");
  const { derivarCarpeta } = await import("../lib/derivar.mjs");
  const t = temporal();
  try {
    const carpeta = join(t.dir, "G");
    assert.equal(cli(t.dir, ["configurar", carpeta]).codigo, 0);
    writeFileSync(join(carpeta, "convenciones.md"), "- orden: día/mes\n- orden: mes/día\n");
    process.env.GYMHUB_CONFIG = join(t.dir, "config.json");
    const datos = await derivarCarpeta(carpeta);
    assert.ok(datos.avisos.some((a) => /orden de las fechas/.test(a)), datos.avisos.join("\n"));
    assert.match(cli(t.dir, ["contexto", "--carpeta", carpeta]).salida, /AVISO: convenciones\.md: el orden de las fechas/);
  } finally { delete process.env.GYMHUB_CONFIG; t.limpiar(); }
});

test("el orden de fechas de convenciones.md decide las fechas ambiguas al separar CONTEXTO/", async () => {
  const { separarTexto } = await import("../lib/separar.mjs");
  const texto = "03/04/2025\nbanca 3x5 60\n\n05/04/2025\nsentadilla 3x5 80\n";
  const pistas = (orden) => separarTexto(texto, { rel: "CONTEXTO/notas.txt", orden }).map((e) => [e.fecha_pista, e.fecha_ambigua]);
  assert.deepEqual(pistas(leerOrdenFechas("## Fechas\n- orden: día/mes\n")), [["2025-04-03", false], ["2025-04-05", false]]);
  assert.deepEqual(pistas(leerOrdenFechas("- orden: mes/día")), [["2025-03-04", false], ["2025-05-04", false]]);
  // Sin convención, la fecha queda marcada como ambigua para que Claude pregunte
  assert.ok(pistas(leerOrdenFechas(null)).every(([, ambigua]) => ambigua));
});

test("sin convenciones.md, todo funciona con los valores por defecto", async () => {
  const { temporal, cli } = await import("./ayuda.mjs");
  const { rmSync } = await import("node:fs");
  const t = temporal();
  try {
    const carpeta = join(t.dir, "G");
    assert.equal(cli(t.dir, ["configurar", carpeta]).codigo, 0);
    rmSync(join(carpeta, "convenciones.md"));
    const r = cli(t.dir, ["contexto", "--carpeta", carpeta]);
    assert.equal(r.codigo, 0, r.error);
    assert.match(r.salida, /convenciones\.md de esta persona \(todavía vacío\)/);
    assert.equal(cli(t.dir, ["publicar", "--carpeta", carpeta]).codigo, 0);
  } finally { t.limpiar(); }
});
