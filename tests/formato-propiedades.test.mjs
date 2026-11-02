// G1 · Propiedades del formato estándar con sesiones aleatorias (semilla fija; GYMHUB_SEMILLA=<n> para otra).
//   parse(serialize(m)) = m   ·   serialize es idempotente   ·   leerSesion nunca lanza
import { test } from "node:test";
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { leerSesion, escribirSesion, validarSesion } from "../lib/canonico.mjs";
import { calcularBase } from "../lib/base.mjs";
import { leerCatalogo } from "../lib/catalogo.mjs";
import { prng, semillaBase, sesionAleatoria } from "./fixtures/aleatorio.mjs";
import { RAIZ } from "./ayuda.mjs";

const N = Number(process.env.GYMHUB_N ?? 600);
/** El modelo sin lo que depende de dónde está cada línea (la ruta y los números de línea). */
const modelo = (s) => JSON.parse(JSON.stringify(s, (k, v) => (k === "linea" || k === "ruta" ? undefined : v)));
const conSemilla = (semilla, fn) => { try { fn(); } catch (e) { e.message = `[semilla ${semilla}] ${e.message}`; throw e; } };

test(`ida y vuelta: parse(serialize(m)) = m con ${N} sesiones aleatorias`, () => {
  const base = semillaBase();
  for (let i = 0; i < N; i++) {
    const semilla = base + i;
    conSemilla(semilla, () => {
      const gen = sesionAleatoria(prng(semilla));
      const t1 = escribirSesion(gen);
      const m1 = leerSesion(t1);
      assert.deepEqual(m1.errores, [], "el validador acepta lo que escribe el serializador");
      // Nada de lo generado se pierde ni cambia en la primera escritura
      for (const k of ["fecha", "titulo", "tipo", "programa", "semana_programa", "inicio", "duracion_min", "sueno_h", "sensacion_pre", "sensacion_post", "peso_corporal_kg", "fuente", "confianza", "calentamiento", "notas", "original"]) {
        assert.deepEqual(m1[k] ?? null, gen[k] === "" ? (k === "calentamiento" || k === "notas" ? "" : null) : gen[k] ?? null, k);
      }
      assert.deepEqual(m1.extra, gen.extra);
      assert.deepEqual(m1.otras, gen.otras);
      assert.deepEqual(m1.molestias, gen.molestias);
      assert.equal(m1.ejercicios.length, gen.ejercicios.length);
      gen.ejercicios.forEach((e, j) => {
        const f = m1.ejercicios[j];
        assert.equal(f.nombre, e.nombre); assert.equal(f.id, e.id); assert.equal(f.nota ?? null, e.nota ?? null);
        assert.equal(f.superserie ?? null, e.superserie ?? null);
        e.series.forEach((x, k) => {
          const y = f.series[k];
          assert.equal(y.tipo, x.tipo); assert.equal(y.carga.texto, x.carga.texto); assert.equal(y.reps.texto, x.reps.texto);
          assert.equal(y.rpe, x.rpe); assert.equal(y.rir, x.rir); assert.equal(y.nota, x.nota);
          assert.notEqual(y.carga.tipo, "error", x.carga.texto); assert.notEqual(y.reps.tipo, "error", x.reps.texto);
        });
      });
      assert.deepEqual(m1.cardio.map((c) => [c.actividad, c.minutos, c.distancia_km, c.nota]), gen.cardio.map((c) => [c.actividad, c.minutos, c.distancia_km, c.nota]));
      // Y desde ahí, la ida y vuelta es exacta e idempotente
      const t2 = escribirSesion(m1);
      const m2 = leerSesion(t2);
      assert.ok(isDeepStrictEqual(modelo(m2), modelo(m1)), "parse(serialize(m)) = m");
      assert.equal(escribirSesion(m2), t2, "serialize es idempotente");
    });
  }
});

test("leerSesion nunca lanza con texto mutado al azar, y lo que da por bueno se puede calcular", () => {
  const base = semillaBase() + 100000;
  const catalogo = leerCatalogo(readFileSync(join(RAIZ, "templates/GIMNASIO/ejercicios.md"), "utf8"));
  const RAROS = ["|", "#", "-", "<", ">", "`", "\n", "\r", "\t", "\\", "---", "## ", "### ", "<!-- id: x -->", "﻿", "💪", "ñ", " ", "\0", "</details>", ":", "\"", "'"];
  for (let i = 0; i < 2000; i++) {
    const semilla = base + i;
    conSemilla(semilla, () => {
      const g = prng(semilla);
      let t = escribirSesion(sesionAleatoria(g));
      for (let k = g.ent(1, 8); k > 0; k--) {
        const p = g.ent(0, t.length);
        switch (g.ent(0, 4)) {
          case 0: t = t.slice(0, p) + t.slice(p + g.ent(1, 20)); break; // borrar un trozo
          case 1: t = t.slice(0, p) + g.uno(RAROS) + t.slice(p); break; // meter algo raro
          case 2: t = t.slice(0, p); break; // truncar
          case 3: { const l = t.split("\n"); const a = g.ent(0, l.length - 1), b = g.ent(0, l.length - 1); [l[a], l[b]] = [l[b], l[a]]; t = l.join("\n"); break; }
          default: t = t.replace(/\d/, String(g.ent(0, 99))); // cambiar un número
        }
      }
      const s = leerSesion(t, `sesiones/x/${i}.md`);
      assert.ok(Array.isArray(s.errores) && Array.isArray(s.avisos));
      const errores = validarSesion(s, catalogo, { hoy: "2026-11-01" });
      if (!errores.length) calcularBase([s], { catalogo, hoy: "2026-11-01" });
    });
  }
});
