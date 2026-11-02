import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { leerCatalogo, anadirFilas, anadirAlias, filaCatalogo, PATRONES_RADAR } from "../lib/catalogo.mjs";
import { RAIZ } from "./ayuda.mjs";

const TEXTO = readFileSync(join(RAIZ, "templates/GIMNASIO/ejercicios.md"), "utf8");

test("el catálogo precargado es válido y no tiene alias ambiguos", () => {
  const c = leerCatalogo(TEXTO);
  assert.deepEqual(c.errores, []);
  assert.deepEqual([...c.ambiguos], []);
  assert.ok(c.ejercicios.size >= 115, `hay ${c.ejercicios.size} ejercicios`);
  for (const p of PATRONES_RADAR) {
    assert.ok([...c.ejercicios.values()].some((e) => e.patron === p && e.principal), `falta un principal en ${p}`);
  }
});

test("buscar por nombre, alias, id, en español o inglés y sin tildes", () => {
  const c = leerCatalogo(TEXTO);
  for (const [n, id] of [["banca", "press-banca"], ["Bench Press", "press-banca"], ["BP", "press-banca"],
    ["press plano", "press-banca"], ["squat", "sentadilla"], ["Jalón al pecho", "jalon-pecho"], ["jalon", "jalon-pecho"],
    ["RDL", "peso-muerto-rumano"], ["hip-thrust", "hip-thrust"], ["HT", "hip-thrust"], ["dips", "fondos"],
    ["sentadilla búlgara", "sentadilla-bulgara"], ["OHP", "press-militar"], ["plank", "plancha"]]) {
    assert.equal(c.buscar(n), id, n);
  }
  assert.equal(c.buscar("algo que no existe"), null);
});

test("fusión: un id puesto como alias de otro se une a él", () => {
  let t = anadirFilas(TEXTO, [filaCatalogo({ id: "press-banca-pausa", nombre: "Banca con pausa", alias: ["paused bench"], grupo: "pecho", secundarios: ["triceps"], carga: "barra", patron: "empuje-horizontal" })]);
  let c = leerCatalogo(t);
  assert.equal(c.buscar("paused bench"), "press-banca-pausa");
  t = anadirAlias(t, "press-banca", ["press-banca-pausa"]);
  c = leerCatalogo(t);
  assert.equal(c.canonico("press-banca-pausa"), "press-banca");
  assert.equal(c.buscar("paused bench"), "press-banca");
  assert.deepEqual(c.errores, []);
});

test("un nombre que encaja con dos ejercicios no se adivina, y el resultado no depende del orden de la tabla", () => {
  const cab = "| id | nombre | alias | grupo | secundarios | carga | patron | principal |\n|---|---|---|---|---|---|---|---|\n";
  const a = "| remo-barra | Remo con barra | remo | espalda-alta | biceps | barra | tiron-horizontal | si |";
  const b = "| remo-ergometro | Remo ergómetro | remo | | | maquina | cardio | no |";
  for (const t of [cab + a + "\n" + b, cab + b + "\n" + a]) {
    const c = leerCatalogo(t);
    assert.ok(c.ambiguos.has("remo"));
    assert.equal(c.buscar("remo"), null);
    assert.equal(c.buscar("Remo"), null);
    assert.equal(c.buscar("remo con barra"), "remo-barra");
    assert.equal(c.buscar("Remo ergómetro"), "remo-ergometro");
  }
});

test("sinónimos, mayúsculas, tildes y guiones llevan al mismo ejercicio", () => {
  const c = leerCatalogo(TEXTO);
  for (const n of ["press banca", "PRESS BANCA", "Press Banca", "press-banca", "  press   banca ", "bench press", "BENCH-PRESS"]) assert.equal(c.buscar(n), "press-banca", n);
  for (const n of ["jalón al pecho", "jalon al pecho", "JALÓN AL PECHO", "lat pulldown"]) assert.equal(c.buscar(n), "jalon-pecho", n);
});
