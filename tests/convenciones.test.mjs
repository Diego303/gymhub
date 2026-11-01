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
