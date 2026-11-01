// G1 · Formato estándar: ida y vuelta, entradas hostiles, casos de entrenamiento y errores claros.
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { leerSesion, escribirSesion } from "../lib/canonico.mjs";
import { cargarSesiones } from "../lib/sesiones.mjs";
import { rutas } from "../lib/config.mjs";
import { temporal } from "./ayuda.mjs";

const SESION = `---
fecha: 2026-03-12
titulo: Torso
confianza: alta
---

# 2026-03-12 · Torso

## Ejercicios

### Press banca
<!-- id: press-banca -->
| # | tipo | carga | reps | rpe | rir | nota |
|---|---|---|---|---|---|---|
| 1 | trabajo | 80 kg | 5 | 8 | | |
`;

test("la caché de sesiones de otra versión del parser no se usa", () => {
  const t = temporal();
  try {
    const dir = join(t.dir, "sesiones", "2026");
    mkdirSync(dir, { recursive: true });
    const f = join(dir, "2026-03-12.md");
    writeFileSync(f, SESION);
    const st = statSync(f);
    // Una caché escrita por una versión anterior (versión 2), con el fichero sin cambios.
    const viejo = { ...leerSesion(SESION, "sesiones/2026/2026-03-12.md"), titulo: "LEÍDO CON EL PARSER VIEJO" };
    mkdirSync(rutas(t.dir).gymhub, { recursive: true });
    writeFileSync(rutas(t.dir).cache, JSON.stringify({ version: 2, ficheros: { "sesiones/2026/2026-03-12.md": { mtimeMs: st.mtimeMs, size: st.size, sesion: viejo } } }));
    const { validas } = cargarSesiones(t.dir);
    assert.equal(validas[0].titulo, "Torso");
    // Y la caché nueva sí se usa mientras el parser no cambie.
    const c = JSON.parse(readFileSync(rutas(t.dir).cache, "utf8"));
    assert.notEqual(c.version, 2);
    assert.equal(cargarSesiones(t.dir).validas[0].titulo, "Torso");
  } finally { t.limpiar(); }
});

test("escribirSesion produce lo que leerSesion lee (sesión mínima)", () => {
  const s = leerSesion(SESION);
  assert.deepEqual(s.errores, []);
  assert.equal(escribirSesion(leerSesion(escribirSesion(s))), escribirSesion(s));
});

test("un texto original que contiene «</details>» se conserva entero y no se mezcla con las notas", () => {
  const s = { ...leerSesion(SESION), notas: "Bien.", original: "copiado de una web:\n<details>x</details>\nfin del texto" };
  const r = leerSesion(escribirSesion(s));
  assert.equal(r.original, s.original);
  assert.equal(r.notas, "Bien.");
});

test("una «|» dentro de una celda se escapa al escribir y se lee entera", () => {
  const s = leerSesion(SESION);
  s.ejercicios[0].series[0].nota = "agarre | cerrado";
  s.cardio = [{ actividad: "cinta | suave", minutos: 20, distancia_km: null, ritmo: null, pulso_medio: null, kcal: null, nota: "a|b" }];
  const texto = escribirSesion(s);
  assert.match(texto, /agarre \\\| cerrado/);
  const r = leerSesion(texto);
  assert.equal(r.ejercicios[0].series[0].nota, "agarre | cerrado");
  assert.equal(r.cardio[0].actividad, "cinta | suave");
  assert.equal(r.cardio[0].nota, "a|b");
  assert.deepEqual(r.errores, []);
});

test("una fila con más celdas que la cabecera es un error claro (no se pierde nada en silencio)", () => {
  const r = leerSesion(SESION.replace("| 1 | trabajo | 80 kg | 5 | 8 | | |", "| 1 | trabajo | 80 kg | 5 | 8 | | agarre | cerrado |"));
  assert.ok(r.errores.some((e) => /más celdas que la cabecera/.test(e) && /\\\|/.test(e)), r.errores.join("\n"));
});

test("el borrador de un CSV escapa la «|» de las notas", async () => {
  const { separarCSV } = await import("../lib/separar.mjs");
  const [e] = separarCSV("date,exercise,weight,reps,notes\n2026-03-12,Bench,80,5,grip | wide\n", { rel: "CONTEXTO/a.csv" });
  const r = leerSesion(e.borrador.replace("<!-- id: ? -->", "<!-- id: press-banca -->").replace("fecha: 2026-03-12", "fecha: 2026-03-12"));
  assert.equal(r.ejercicios[0].series[0].nota, "grip | wide");
});

test("el texto suelto que no es una tabla se conserva al guardar (notas de ejercicio, líneas sueltas, cardio)", () => {
  const md = `---
fecha: 2026-03-12
titulo: Torso
confianza: alta
---

# 2026-03-12 · Torso
Párrafo antes de la primera sección.

## Ejercicios
Circuito: 3 vueltas, EMOM 12 min.

### Press banca
<!-- id: press-banca -->
Agarre cerrado, pausa de 1 s en el pecho.
| # | tipo | carga | reps | rpe | rir | nota |
|---|---|---|---|---|---|---|
| 1 | trabajo | 80 kg | 5 | 8 | | |
La última costó.

## Cardio
Intervalos 30/30.
| actividad | minutos | distancia_km | ritmo | pulso_medio | kcal | nota |
|---|---|---|---|---|---|---|
| cinta | 20 | 2.5 | | 130 | | |

## Notas
Bien.
`;
  const a = leerSesion(md);
  assert.deepEqual(a.errores, []);
  const b = leerSesion(escribirSesion(a));
  assert.equal(b.ejercicios[0].nota, "Agarre cerrado, pausa de 1 s en el pecho.\nLa última costó.");
  assert.deepEqual(b.sueltas, { cabecera: "Párrafo antes de la primera sección.", ejercicios: "Circuito: 3 vueltas, EMOM 12 min.", cardio: "Intervalos 30/30." });
  assert.equal(escribirSesion(b), escribirSesion(a));
});

test("una línea que empieza por «# » dentro de una sección es texto, no se borra", () => {
  const s = { ...leerSesion(SESION), notas: "# 3 series más que la semana pasada\nbien", calentamiento: "# movilidad\nhombro" };
  const r = leerSesion(escribirSesion(s));
  assert.equal(r.notas, s.notas);
  assert.equal(r.calentamiento, s.calentamiento);
  assert.equal(r.titulo, "Torso");
});

test("los textos del frontmatter no cambian al guardar (barras, tabuladores, espacios, números como texto)", async () => {
  const { leerYAML } = await import("../lib/canonico.mjs");
  for (const titulo of ["barra \\ invertida", "tab\taquí", "-5", "-0.5", " espacios ", "007", "null", "a: b", "#3 del bloque", "comillas \"dobles\"", "línea\nnueva", "Ünïcödé 🏋️"]) {
    const r = leerSesion(escribirSesion({ ...leerSesion(SESION), titulo }));
    assert.equal(r.titulo, titulo, JSON.stringify(titulo));
  }
  // Un valor entre comillas seguido de un comentario
  assert.equal(leerYAML('titulo: "Torso" # comentario').titulo, "Torso");
  assert.equal(leerYAML("titulo: 'Torso' # comentario").titulo, "Torso");
  assert.equal(leerYAML('titulo: "a \\"b\\" c"').titulo, 'a "b" c');
});

test("un fichero con BOM y fines de línea de Windows (Bloc de notas) se lee igual", async () => {
  const conBom = "\uFEFF" + SESION.replace(/\n/g, "\r\n");
  const r = leerSesion(conBom);
  assert.deepEqual(r.errores, []);
  assert.equal(r.ejercicios[0].series[0].carga.valor, 80);
  const { leerPlantilla } = await import("../lib/plantillas.mjs");
  assert.equal(leerPlantilla("\uFEFF---\r\nnombre: Pierna A\r\ndia: lunes\r\n---\r\n- Sentadilla · 5×5 · 120 kg\r\n", "a.md").nombre, "Pierna A");
  const { leerRepaso } = await import("../lib/semanas.mjs");
  assert.equal(leerRepaso("\uFEFF---\r\nsemana: 2026-W44\r\n---\r\n## Repaso\r\n- ✓ bien\r\n").semana, "2026-W44");
});

test("dos secciones desconocidas con el mismo título no se pisan", () => {
  const r = leerSesion(SESION + "\n## Observaciones\nprimera\n\n## Notas\nbien\n\n## Observaciones\nsegunda\n");
  assert.equal(r.otras.Observaciones, "primera\n\nsegunda");
  assert.equal(leerSesion(escribirSesion(r)).otras.Observaciones, "primera\n\nsegunda");
});

test("las columnas que no son del formato se conservan y avisan; sin «carga» o «reps» es un error", () => {
  const extra = SESION.replace("| # | tipo | carga | reps | rpe | rir | nota |\n|---|---|---|---|---|---|---|\n| 1 | trabajo | 80 kg | 5 | 8 | | |",
    "| # | tipo | carga | reps | rpe | rir | nota | descanso |\n|---|---|---|---|---|---|---|---|\n| 1 | trabajo | 80 kg | 5 | 8 | | | 3 min |");
  const a = leerSesion(extra);
  assert.deepEqual(a.errores, []);
  assert.ok(a.avisos.some((x) => /columna «descanso»/.test(x)), a.avisos.join("\n"));
  const b = leerSesion(escribirSesion(a));
  assert.equal(b.ejercicios[0].series[0].extra.descanso, "3 min");
  assert.match(escribirSesion(b), /\| nota \| descanso \|/);
  const sinCarga = leerSesion(SESION.replace("| # | tipo | carga | reps |", "| # | tipo | peso | reps |"));
  assert.ok(sinCarga.errores.some((e) => /Press banca: la tabla no tiene la columna «carga»/.test(e)), sinCarga.errores.join("\n"));
});

test("cada error dice en qué línea está", () => {
  const md = `---
fecha: 2026-03-12
titulo: Torso
sensacion_pre: 14
molestias:
  - zona: hombro
    estado: regular
---

# 2026-03-12 · Torso

## Ejercicios

### Press banca
<!-- id: press-banca -->
| # | tipo | carga | reps | rpe | rir | nota |
|---|---|---|---|---|---|---|
| 1 | trabajo | 80 kg | 5 | 8 | | |
| 2 | trabajo | ochenta | 5 | 12 | | |

### Remo
| # | tipo | carga | reps | rpe | rir | nota |
|---|---|---|---|---|---|---|
| 1 | normal | 60 kg | muchas | | | |
`;
  const e = leerSesion(md).errores.join("\n");
  for (const re of [/sensacion_pre fuera de 0-10 .*\(línea 4\)/, /molestia hombro: estado desconocido .*\(línea 5\)/,
    /Press banca, serie 2 \(línea 19\): carga no válida «ochenta»/, /Press banca, serie 2 \(línea 19\): RPE fuera de 1-10/,
    /Remo: falta el id .*\(línea 21\)/, /Remo, serie 1 \(línea 24\): tipo de serie desconocido «normal»/, /Remo, serie 1 \(línea 24\): repeticiones no válidas «muchas»/]) {
    assert.match(e, re);
  }
  assert.match(leerSesion("sin frontmatter").errores[0], /\(línea 1\)/);
});

test("una fecha en el futuro (un año mal escrito) es un error claro y no cuenta en las cifras", async () => {
  const { validarSesion } = await import("../lib/canonico.mjs");
  const futura = leerSesion(SESION.replace(/2026-03-12/g, "2062-03-12"));
  assert.match(validarSesion(futura, null, { hoy: "2026-11-01" }).join("\n"), /fecha en el futuro «2062-03-12» \(hoy es 2026-11-01\).*\(línea 2\)/);
  // Mañana se admite (zonas horarias); pasado mañana no.
  assert.deepEqual(validarSesion(leerSesion(SESION.replace(/2026-03-12/g, "2026-11-02")), null, { hoy: "2026-11-01" }), []);
  assert.equal(validarSesion(leerSesion(SESION.replace(/2026-03-12/g, "2026-11-03")), null, { hoy: "2026-11-01" }).length, 1);
  const t = temporal();
  try {
    mkdirSync(join(t.dir, "sesiones", "2062"), { recursive: true });
    writeFileSync(join(t.dir, "sesiones", "2062", "2062-03-12.md"), SESION.replace(/2026-03-12/g, "2062-03-12"));
    const r = cargarSesiones(t.dir, null, { hoy: "2026-11-01" });
    assert.equal(r.validas.length, 0);
    assert.match(r.conErrores[0].errores[0], /fecha en el futuro/);
  } finally { t.limpiar(); }
});

test("espacios detrás de los «---» del frontmatter no invalidan la sesión", () => {
  const r = leerSesion(SESION.replace(/^---$/gm, "---  "));
  assert.deepEqual(r.errores, []);
  assert.equal(r.titulo, "Torso");
});

test("espacios al final de la línea del id (<!-- id: … -->   ) no dejan el ejercicio sin id", () => {
  const r = leerSesion(SESION.replace("<!-- id: press-banca -->", "  <!-- id: press-banca -->   "));
  assert.deepEqual(r.errores, []);
  assert.equal(r.ejercicios[0].id, "press-banca");
});
