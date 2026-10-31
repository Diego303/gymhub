import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { cpSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { temporal, cli, RAIZ } from "./ayuda.mjs";
import { contexto } from "../lib/derivar.mjs";
import { construirProgreso, nivelMapa } from "../lib/progreso.mjs";
import { discosPorLado, tablaDiscos, textoDiscos } from "../lib/discos.mjs";

let t, carpeta;
before(() => {
  t = temporal();
  carpeta = join(t.dir, "G");
  cli(t.dir, ["configurar", carpeta]);
  process.env.GYMHUB_CONFIG = join(t.dir, "config.json");
  cpSync(join(RAIZ, "tests/fixtures/sesiones"), join(carpeta, "sesiones"), { recursive: true });
});
after(() => t.limpiar());
const progreso = () => construirProgreso(contexto(carpeta, { hoy: "2026-10-31" }), {});

test("mapa muscular: series de la semana en 5 tonos, el más trabajado y los olvidados", () => {
  const p = progreso();
  assert.deepEqual([0, 3.5, 4, 8, 12, 16, 30].map(nivelMapa), [0, 0, 1, 2, 3, 4, 4]);
  assert.deepEqual(p.mapa.grupos.pecho, { series: 4, nivel: 1, nombre: "Pecho" });
  assert.equal(p.mapa.grupos.dorsal.series, 5);
  assert.deepEqual(p.mapa.mas, { grupo: "dorsal", nombre: "Dorsal", series: 5 });
  assert.deepEqual(p.mapa.olvidados.map((o) => o.grupo), ["trapecio", "femoral", "gemelo"]);
});

test("bloque: % del e1RM vigente en los principales y toneladas normalizadas", () => {
  const b = progreso().bloque;
  assert.equal(b.semanas.length, 6);
  const [s43, s44] = b.semanas.slice(-2);
  assert.equal(s43.intensidad, 86); // 75 kg / 87,5 de e1RM
  assert.equal(s44.intensidad, 84); // banca, sentadilla y dominadas frente a su e1RM vigente
  assert.equal(s43.etiqueta, "S43");
  assert.equal(s44.etiqueta, "SEM 3", "con semana_programa se usa su etiqueta");
  assert.equal(s44.toneladas, 4.7);
  assert.equal(s44.volumen_pct, 100);
  assert.equal(s43.volumen_pct, 9);
  assert.equal(s44.actual, true);
  assert.equal(b.semanas[0].intensidad, null, "semana sin sesiones");
});

test("récords con fecha corta, PRs del mes y del año, historial", () => {
  const p = progreso();
  assert.equal(p.records[0].nombre, "Press banca");
  assert.equal(p.records[0].valor, "99,2 kg");
  assert.equal(p.records[0].fecha_texto, "30 oct");
  assert.equal(p.records[0].nuevo, true);
  assert.equal(p.prs_mes, 1);
  assert.equal(p.prs_anio, 1);
  assert.deepEqual(p.historial, { sesiones: 4, toneladas: 5, desde: "oct 2026", cardio_semana_min: 20, peso: { kg: 80, fecha: "2026-10-28" } });
});

test("discos: por lado, con la barra y los discos de la config, y la tabla de la web", () => {
  assert.deepEqual(discosPorLado(100), { por_lado: [25, 15], sobra: 0 });
  assert.deepEqual(discosPorLado(120), { por_lado: [25, 25], sobra: 0 });
  assert.deepEqual(discosPorLado(57.5), { por_lado: [15, 2.5, 1.25], sobra: 0 });
  assert.deepEqual(discosPorLado(20), { por_lado: [], sobra: 0 });
  assert.equal(discosPorLado(15), null);
  assert.deepEqual(discosPorLado(100, { barra: 15, discos: [20, 10, 5] }), { por_lado: [20, 20, 2.5].slice(0, 2), sobra: 5 });
  assert.equal(textoDiscos(discosPorLado(57.5)), "por lado: 15 + 2,5 + 1,25");
  const tabla = tablaDiscos();
  assert.equal(tabla.paso, 2.5);
  assert.deepEqual(tabla.tabla["140"], [25, 25, 10]);
  assert.equal(Object.keys(tabla.tabla).length, 113);
  assert.equal(progreso().discos.valor, 100);
  writeFileSync(join(carpeta, ".gymhub/discos.json"), JSON.stringify({ kg: 142.5 }));
  assert.equal(progreso().discos.valor, 142.5);
});

test("un ejercicio a más de 10 repeticiones progresa por carga (sin e1RM falso)", async () => {
  writeFileSync(join(carpeta, "sesiones/2026/2026-10-31.md"), `---\nfecha: 2026-10-31\ntipo: tiron\nconfianza: alta\n---\n## Ejercicios\n### Face pull\n<!-- id: face-pull -->\n| # | tipo | carga | reps | rpe | rir | nota |\n|---|---|---|---|---|---|---|\n| 1 | trabajo | 25 kg | 15 | | | |\n| 2 | trabajo | 27.5 kg | 12 | | | |\n`);
  const c = contexto(carpeta, { hoy: "2026-10-31" });
  const r = c.records.find((x) => x.id === "face-pull");
  assert.equal(r.escala, "carga");
  assert.equal(r.texto_valor, "27,5 kg");
  assert.equal(r.serie, "27,5 kg × 12");
});
