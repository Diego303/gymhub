import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { leerFicha, ponerClave, anadirLesion } from "../lib/ficha.mjs";
import { RAIZ } from "./ayuda.mjs";

const PLANTILLA = readFileSync(join(RAIZ, "templates/GIMNASIO/FICHA.md"), "utf8");

test("la plantilla de FICHA.md se lee con valores por defecto", () => {
  const f = leerFicha(PLANTILLA);
  assert.equal(f.dias_semana, 4);
  assert.deepEqual(f.objetivos, {}); // los ejemplos van comentados
  assert.equal(f.series_objetivo.pecho, 12);
  assert.equal(f.series_objetivo.espalda, 14);
  assert.equal(f.sueno_objetivo_h, 8);
  assert.equal(f.racha_umbral_dias, 4);
  assert.equal(f.peso_corporal_kg, null);
  assert.deepEqual(f.lesiones, []);
  assert.equal(f.referencias["empuje-vertical"], 0.62);
  assert.deepEqual(f.rangos["empuje:tiron"], [0.9, 1.1]);
});

test("FICHA.md del plan: objetivos, series, lesiones con prehab", () => {
  const f = leerFicha(`# Ficha
## Objetivos
- dias_semana: 4
- sentadilla: 140 kg
- press-banca: 100 kg
- peso-muerto: 180 kg
## Series objetivo por semana
pecho 14 · espalda 16 · cuadriceps 10 · femoral 8 · hombro 12 · bíceps 6
## Datos
- peso_corporal: 78,2 kg
- racha_umbral_dias: 3
## Lesiones y limitaciones
- Rodilla: prehab antes de pierna   (ejemplo; texto libre)
## Referencias de fuerza
banca 1,0 · militar 0,6 · sentadilla 1,25
## Estado actual   ← lo actualiza /refresh
- e1RM: sentadilla 108
`);
  assert.equal(f.dias_semana, 4);
  assert.deepEqual(f.objetivos.sentadilla, { valor: 140, unidad: "kg" });
  assert.equal(Object.keys(f.objetivos).length, 3);
  assert.equal(f.series_objetivo.biceps, 6);
  assert.equal(f.peso_corporal_kg, 78.2);
  assert.equal(f.racha_umbral_dias, 3);
  assert.deepEqual(f.prehab, [{ zona: "rodilla", texto: "prehab antes de pierna" }]);
  assert.equal(f.referencias["empuje-vertical"], 0.6);
  assert.equal(f.referencias.rodilla, 1.25);
  assert.equal(f.referencias.cadera, 1.55);
});

test("ponerClave y anadirLesion editan solo su sección", () => {
  let t = ponerClave(PLANTILLA, "Objetivos", "dias_semana", "5");
  t = ponerClave(t, "Objetivos", "sentadilla", "140 kg");
  t = ponerClave(t, "Datos", "peso_corporal", "80 kg");
  t = anadirLesion(t, "Hombro izq.: evitar press tras nuca");
  const f = leerFicha(t);
  assert.equal(f.dias_semana, 5);
  assert.deepEqual(f.objetivos.sentadilla, { valor: 140, unidad: "kg" });
  assert.equal(f.peso_corporal_kg, 80);
  assert.deepEqual(f.lesiones, ["Hombro izq.: evitar press tras nuca"]);
  assert.match(t, /## Referencias de fuerza\nbanca 1,0/);
  assert.equal((t.match(/^## /gm) || []).length, (PLANTILLA.match(/^## /gm) || []).length);
});
