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
