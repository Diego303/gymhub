import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { leerSesion, escribirSesion, leerCarga, leerReps, leerYAML, validarSesion } from "../lib/canonico.mjs";
import { leerCatalogo } from "../lib/catalogo.mjs";
import { RAIZ } from "./ayuda.mjs";

const FIX = join(RAIZ, "tests/fixtures/sesiones/2026");
const leer = (f) => leerSesion(readFileSync(join(FIX, f), "utf8"), `sesiones/2026/${f}`);
const CAT = leerCatalogo(readFileSync(join(RAIZ, "templates/GIMNASIO/ejercicios.md"), "utf8"));

test("cargas: kg, lb, /lado, /mano, PC, lastre, asistida, banda, nivel, %1RM", () => {
  assert.deepEqual(leerCarga("80 kg"), { tipo: "peso", texto: "80 kg", valor: 80, unidad: "kg", por: null });
  assert.equal(leerCarga("185 lb").unidad, "lb");
  assert.equal(leerCarga("7,5 kg").valor, 7.5);
  assert.equal(leerCarga("7'5 kg").valor, 7.5);
  assert.equal(leerCarga("20 kg/lado").por, "lado");
  assert.equal(leerCarga("22.5 kg/mano").por, "mano");
  assert.deepEqual(leerCarga("PC"), { tipo: "pc", texto: "PC", extra: 0, unidad: "kg" });
  assert.equal(leerCarga("PC+10 kg").extra, 10);
  assert.equal(leerCarga("PC-20 kg").extra, -20);
  assert.equal(leerCarga("banda roja").color, "roja");
  assert.equal(leerCarga("banda 15 kg").kg, 15);
  assert.equal(leerCarga("nivel 7").valor, 7);
  assert.equal(leerCarga("80 %1RM").valor, 80);
  assert.equal(leerCarga("").tipo, "vacia");
  assert.equal(leerCarga("ochenta").tipo, "error");
});

test("repeticiones: número, por lado, fallo, tiempo y distancia", () => {
  assert.equal(leerReps("5").n, 5);
  assert.deepEqual(leerReps("8/8"), { tipo: "lados", texto: "8/8", n: 16, min: 8 });
  assert.equal(leerReps("fallo").tipo, "fallo");
  assert.equal(leerReps("45s").s, 45);
  assert.equal(leerReps("2 min").s, 120);
  assert.equal(leerReps("400 m").m, 400);
  assert.equal(leerReps("1 km").m, 1000);
  assert.equal(leerReps("muchas").tipo, "error");
});

test("YAML del frontmatter: comentarios, comillas, nulos y lista de molestias", () => {
  const y = leerYAML(`fecha: 2026-03-12
titulo: Torso pesado
tipo: torso             # ver §2.3
programa: null
inicio: "18:30"
sueno_h: 7
molestias:
  - zona: hombro
    lado: izq           # izq | der | ambos | null
    estado: molestia
  - zona: rodilla
    lado: null
    estado: bien
fuente: "CONTEXTO/notas-marzo.md · bloque 3"`);
  assert.equal(y.fecha, "2026-03-12");
  assert.equal(y.tipo, "torso");
  assert.equal(y.programa, null);
  assert.equal(y.inicio, "18:30");
  assert.equal(y.sueno_h, 7);
  assert.deepEqual(y.molestias, [{ zona: "hombro", lado: "izq", estado: "molestia" }, { zona: "rodilla", lado: null, estado: "bien" }]);
  assert.equal(y.fuente, "CONTEXTO/notas-marzo.md · bloque 3");
});

test("una sesión completa: frontmatter, ejercicios, superserie, cardio, notas y original", () => {
  const s = leer("2026-10-28.md");
  assert.deepEqual(s.errores, []);
  assert.equal(s.fecha, "2026-10-28");
  assert.equal(s.peso_corporal_kg, 80);
  assert.equal(s.ejercicios.length, 4);
  assert.deepEqual(s.ejercicios.map((e) => e.id), ["sentadilla", "jalon-pecho", "dominadas", "plancha"]);
  assert.equal(s.ejercicios[2].superserie, "A");
  assert.equal(s.ejercicios[2].orden_superserie, 1);
  assert.equal(s.ejercicios[0].series.length, 3);
  assert.equal(s.ejercicios[0].series[1].rpe, 7.5);
  assert.equal(s.ejercicios[2].series[0].rir, 2);
  assert.deepEqual(s.cardio, [{ actividad: "cinta", minutos: 20, distancia_km: 2.5, ritmo: null, pulso_medio: 130, kcal: null, nota: "inclinación 10" }]);
  assert.equal(s.notas, "Hombro bien hoy.");
  const o = leer("2026-10-26.md");
  assert.match(o.original, /^26\/10 torso: banca/);
  assert.equal(o.calentamiento, "- 5 min bici · rotaciones de hombro 2×15");
  assert.equal(o.ejercicios[0].series[0].tipo, "aproximacion");
});

test("errores: tipo, carga, reps, RPE, id que falta o no está en el catálogo, fecha", () => {
  const s = leerSesion(`---
fecha: 2026-02-30
sensacion_pre: 12
molestias:
  - zona: rodilla
    estado: fatal
---
## Ejercicios
### Cosa
| # | tipo | carga | reps | rpe | rir | nota |
|---|---|---|---|---|---|---|
| 1 | normal | ochenta | muchas | 11 | | |
### Banca
<!-- id: press-bancaa -->
| # | tipo | carga | reps | rpe | rir | nota |
|---|---|---|---|---|---|---|
| 1 | trabajo | 80 kg | 5 | 7-8 | | |
`, "sesiones/2026/2026-03-01.md");
  const e = validarSesion(s, CAT).join("\n");
  for (const re of [/fecha imposible/, /no coincide con el fichero/, /sensacion_pre fuera de 0-10/, /estado desconocido «fatal»/,
    /tipo de serie desconocido «normal»/, /carga no válida «ochenta»/, /repeticiones no válidas «muchas»/, /RPE fuera de 1-10/,
    /Cosa: falta el id/, /«press-bancaa» no está en el catálogo/]) assert.match(e, re);
  assert.equal(s.ejercicios[1].series[0].rpe, 7.5, "el rango 7-8 se guarda como la media");
  assert.match(s.avisos.join(), /RPE en rango «7-8»/);
});

test("escribirSesion → leerSesion conserva el contenido", () => {
  for (const f of ["2026-10-26.md", "2026-10-28.md", "2026-10-30.md"]) {
    const a = leer(f);
    const b = leerSesion(escribirSesion(a), a.ruta);
    assert.deepEqual(b.errores, []);
    for (const k of ["fecha", "titulo", "tipo", "programa", "semana_programa", "inicio", "sueno_h", "sensacion_pre", "peso_corporal_kg", "molestias", "notas", "original", "calentamiento", "cardio"]) {
      assert.deepEqual(b[k], a[k], `${f}: ${k}`);
    }
    assert.deepEqual(b.ejercicios.map((e) => [e.id, e.superserie, e.series.map((x) => [x.tipo, x.carga.texto, x.reps.texto, x.rpe, x.rir])]),
      a.ejercicios.map((e) => [e.id, e.superserie, e.series.map((x) => [x.tipo, x.carga.texto, x.reps.texto, x.rpe, x.rir])]), f);
  }
});
