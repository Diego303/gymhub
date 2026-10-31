import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { cpSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { temporal, cli, RAIZ } from "./ayuda.mjs";
import { contexto } from "../lib/derivar.mjs";
import { construirDiario, primeraFrase } from "../lib/diario.mjs";
import { construirEjercicios } from "../lib/ejercicio.mjs";
import { generarDosAnios } from "./fixtures/dosanios.mjs";

let t, carpeta, dos;
before(() => {
  t = temporal();
  carpeta = join(t.dir, "G"); dos = join(t.dir, "DOS");
  cli(t.dir, ["configurar", carpeta]); cli(t.dir, ["configurar", dos]);
  process.env.GYMHUB_CONFIG = join(t.dir, "config.json");
  cpSync(join(RAIZ, "tests/fixtures/sesiones"), join(carpeta, "sesiones"), { recursive: true });
  generarDosAnios(dos);
});
after(() => t.limpiar());
const diario = () => construirDiario(contexto(carpeta, { hoy: "2026-10-31" }));

test("primera frase de las notas", () => {
  assert.equal(primeraFrase("Subí 2,5 kg en banca y salieron todas. Algo de tensión."), "Subí 2,5 kg en banca y salieron todas.");
  assert.equal(primeraFrase(""), "");
});

test("molestias por zona y semana: el peor estado de cada semana", () => {
  const d = diario();
  const h = d.molestias.filas.find((f) => f.zona === "hombro izq.");
  assert.equal(h.celdas[11], "molestia", "lunes molestia y miércoles bien → molestia");
  assert.equal(h.celdas[10], null);
  assert.deepEqual(d.avisos, []);
});

test("aviso cuando una molestia se repite en 3 sesiones seguidas (FORMATO §3.9)", () => {
  for (const [f, est] of [["2026-10-29", "molestia"], ["2026-10-31", "dolor"]]) {
    writeFileSync(join(carpeta, `sesiones/2026/${f}.md`), `---\nfecha: ${f}\ntipo: torso\nmolestias:\n  - zona: hombro\n    lado: izq\n    estado: ${est}\nconfianza: alta\n---\n## Notas\nMe tira el hombro.\n`);
  }
  // 26 molestia · 28 bien · 29 molestia · 31 dolor → solo 2 seguidas
  assert.deepEqual(diario().avisos, []);
  writeFileSync(join(carpeta, "sesiones/2026/2026-10-28.md"), `---\nfecha: 2026-10-28\ntipo: pierna\nmolestias:\n  - zona: hombro\n    lado: izq\n    estado: molestia\nconfianza: alta\n---\n## Notas\n`);
  const av = diario().avisos;
  assert.equal(av.length, 1);
  assert.equal(av[0].texto, "Se repite: hombro izq. en 4 sesiones seguidas · valora consultarlo");
  assert.equal(diario().molestias.filas[0].celdas[11], "dolor");
});

test("línea de tiempo: de la más reciente a la más antigua, con hitos de programa y primera vez", () => {
  const l = diario().linea;
  assert.equal(l[0].t, "s"); assert.equal(l[0].fecha, "2026-10-31");
  const hitos = l.filter((e) => e.t === "h").map((e) => `${e.fecha} ${e.texto}`);
  assert.ok(hitos.includes("2026-10-26 Inicio de programa: Fuerza base · semana 3"));
  assert.ok(hitos.includes("2026-10-26 Primera vez: remo con mancuerna"));
  assert.ok(!hitos.some((h) => h.startsWith("2026-10-19 Primera vez")), "la primera sesión del historial no marca «primera vez»");
  const pr = l.find((e) => e.fecha === "2026-10-30");
  assert.deepEqual(pr.prs, ["press banca 85 kg × 5"]);
  assert.match(pr.ejercicios, /^Press banca 1×5 · 85 kg$/);
});

test("ejercicios: lista con ≥ 3 sesiones y ficha con mejor peso por reps, marca, frecuencia y menciones", () => {
  const e = construirEjercicios(contexto(dos, { hoy: "2026-10-31" }));
  assert.equal(e.lista.length, 7);
  const b = e.fichas["press-banca"];
  assert.equal(b.n_sesiones, 104); assert.equal(b.n_series, 312);
  assert.equal(b.kpis.actual.valor, 130.1); // 111,5 × 7/6 = 130,08
  assert.deepEqual([b.kpis.marca.kg, b.kpis.marca.reps, b.kpis.marca.fecha], [111.5, "5", "2026-10-26"]);
  // mejor de 8 semanas (130,08) frente a hace un año (hasta el 28-11-2025, semana 55 → 87,5 × 7/6 = 102,08): +27,4 %
  assert.equal(b.kpis.var12, 27.4);
  assert.equal(b.kpis.frecuencia, 4.3); // 52 lunes en los últimos 365 días (semanas 52–103) / 12
  assert.deepEqual(b.tabla.slice(0, 6).map((r) => r.kg), [111.5, 111.5, 111.5, 111.5, 111.5, null]);
  assert.equal(b.tabla[0].carga, "111,5 kg");
  assert.equal(b.tabla[0].reciente, true);
  assert.equal(b.notas.length, 6);
  assert.equal(b.notas[0].texto, "La banca salió fluida.");
  assert.deepEqual(b.rangos["6M"].desde, "2026-05-02");
  const d = e.fichas.dominadas;
  assert.equal(d.escala, "kg", "PC+10 con peso corporal de FICHA.md → e1RM en kg");
  assert.equal(d.kpis.actual.valor, 105);
  assert.equal(e.lista.find((x) => x.id === "peso-muerto").var12, 0);
});
