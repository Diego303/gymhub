// Los subcomandos de bin/gymhub.mjs ejecutados en el mismo proceso (los demás tests los lanzan como
// proceso aparte, y esa cobertura no cuenta): importar entero con muestra, lote, guardar --fichero y
// cerrar; el registro en vivo (entreno, serie, fin); y ayuda, formato, guía, estado, leer y web.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { temporal } from "./ayuda.mjs";
import { ejecutar } from "../lib/cli.mjs";

let t, carpeta;
/** Ejecuta un subcomando y devuelve { codigo, salida }. */
async function orden(...args) {
  const salida = [], log = console.log, escribir = process.stdout.write;
  console.log = (...x) => salida.push(x.join(" "));
  process.stdout.write = (x) => { salida.push(String(x)); return true; };
  try { return { codigo: await ejecutar([args[0], "--carpeta", carpeta, ...args.slice(1)]), salida: salida.join("\n") }; } finally { console.log = log; process.stdout.write = escribir; }
}
before(async () => {
  t = temporal();
  carpeta = join(t.dir, "G");
  Object.assign(process.env, { GYMHUB_CONFIG: join(t.dir, "config.json"), GYMHUB_NO_ABRIR: "1", GYMHUB_NO_AVISO: "1", GYMHUB_HOY: "2026-03-31" });
  const log = console.log; console.log = () => {};
  try { await ejecutar(["configurar", carpeta]); } finally { console.log = log; }
});
after(() => { for (const k of ["GYMHUB_CONFIG", "GYMHUB_NO_ABRIR", "GYMHUB_NO_AVISO", "GYMHUB_HOY"]) delete process.env[k]; t.limpiar(); });

const sesion = (f, kg) => `---\nfecha: ${f}\ntitulo: Torso\nconfianza: alta\n---\n## Ejercicios\n### Press banca\n<!-- id: press-banca -->\n| # | tipo | carga | reps | rpe | rir | nota |\n|---|---|---|---|---|---|---|\n| 1 | trabajo | ${kg} kg | 5 | 8 | | |\n`;

test("importar entero en el mismo proceso: preparar, muestra, lote, guardar --fichero, estado y cerrar", async () => {
  const lineas = [];
  for (let d = 1; d <= 24; d++) lineas.push(`${String(d).padStart(2, "0")}/03/2026\nbanca 5x${60 + d}\n`);
  writeFileSync(join(carpeta, "CONTEXTO", "notas.txt"), lineas.join("\n"));
  writeFileSync(join(carpeta, "CONTEXTO", "foto.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]));
  writeFileSync(join(carpeta, "CONTEXTO", "audio.m4a"), "x");
  let r = await orden("refresh", "preparar");
  assert.match(r.salida, /25 elementos nuevos/);
  assert.match(r.salida, /MUESTREO/);
  assert.match((await orden("refresh", "muestra", "5")).salida, /^MUESTRA: 5 de 25 elementos/);
  r = await orden("refresh", "lote");
  assert.match(r.salida, /^LOTE 1 de 2/);
  assert.match((await orden("refresh", "lote", "2")).salida, /IMAGEN: léela con la herramienta Read/); // la foto va por la fecha del fichero
  const { leerJSON } = await import("../lib/util.mjs");
  const imp = leerJSON(join(carpeta, ".gymhub", "importacion.json"));
  for (const l of imp.lotes) {
    const bloques = l.ids.map((id) => { const e = imp.elementos[id]; return e.tipo === "imagen" ? `@@@ ignorar elementos=${id} · motivo: foto sin entreno` : `@@@ sesion elementos=${id}\n${sesion(e.fecha_pista, 60)}`; });
    mkdirSync(join(carpeta, ".gymhub", "entrada"), { recursive: true });
    writeFileSync(join(carpeta, ".gymhub", "entrada", `lote-${l.n}.md`), bloques.join("\n"));
    r = await orden("refresh", "guardar", String(l.n), "--fichero", `.gymhub/entrada/lote-${l.n}.md`);
    assert.equal(r.codigo, 0, r.salida);
    assert.match(r.salida, new RegExp(`^Lote ${l.n} guardado`));
  }
  assert.match((await orden("refresh", "estado")).salida, /SIGUIENTE: refresh cerrar/);
  r = await orden("refresh", "cerrar");
  assert.match(r.salida, /^Listo · 24 sesiones nuevas/);
  assert.match((await orden("refresh", "estado")).salida, /Última importación cerrada/);
  assert.match((await orden("refresh", "lote")).salida, /No hay importación en curso/);
  assert.equal((await orden("refresh", "inventada")).codigo, 2);
  assert.match((await orden("catalogo")).salida, /press-banca · Press banca/);
});

test("registro en vivo en el mismo proceso: entreno con calentamiento, series con descanso y fin", async () => {
  mkdirSync(join(carpeta, "plantillas"), { recursive: true });
  writeFileSync(join(carpeta, "plantillas", "torso-a.md"), "---\nnombre: Torso A\ntipo: torso\n---\n- Press banca · 3×5 · 100 kg · 3 min\n- Remo con barra · 3×8 · 60 kg\n");
  let r = await orden("entreno", "torso");
  assert.match(r.salida, /^Entreno de hoy: Torso A/);
  assert.match(r.salida, /Calentamiento para press banca \(trabajo 100 kg\): 20×10 \[barra\] → 50×5 \[15\] → 70×3 \[25\] → 85×1 \[25\+5\+2,5\]/);
  r = await orden("serie", "--ejercicio", "press banca", "--", "banca", "5x100", "@8");
  assert.match(r.salida, /Apuntado: «banca 5x100 @8» · Press banca 1\/3 · descanso 3:00 · sin aviso/);
  const vivo = JSON.parse(readFileSync(join(carpeta, ".gymhub", "vivo.json"), "utf8"));
  assert.deepEqual([vivo.entreno, vivo.descanso_s, vivo.serie_actual.n], [true, 180, 1]);
  r = await orden("fin", "--post", "8", "--notas", "bien");
  assert.match(r.salida, /^Entreno cerrado/);
  assert.match(readFileSync(join(carpeta, "CONTEXTO", "2026-03-31-en-vivo.md"), "utf8"), /banca 5x100 @8[\s\S]*fin del entreno · sensación post: 8 · notas: bien/);
  assert.equal((await orden("serie")).codigo, 2);
});

test("ayuda, formato, guía, estado, leer, web y discos en el mismo proceso", async () => {
  assert.match((await orden("ayuda")).salida, /refresh +preparar/);
  const f = await orden("formato");
  assert.ok(f.codigo === 0 || /falta docs\/FORMATO\.md/.test(f.salida));
  assert.match((await orden("guia", "guardar")).salida, /Cómo se guarda lo que normalizas/);
  assert.equal((await orden("guia", "no-existe")).codigo, 1);
  assert.match((await orden("estado")).salida, /node: v\d+/);
  assert.match((await orden("leer", "FICHA.md")).salida, /# Ficha/);
  assert.match((await orden("leer", "sesiones")).salida, /2026/);
  assert.equal((await orden("leer", "no-existe.md")).codigo, 1);
  assert.match((await orden("web", "progreso", "--no-abrir")).salida, /vista progreso · versión \w+ · sin abrir/);
  assert.equal((await orden("web", "inventada")).codigo, 2);
  assert.match((await orden("discos", "102,5")).salida, /por lado: 25 \+ 15 \+ 1,25/);
  assert.equal((await orden("discos", "nada")).codigo, 2);
  assert.match((await orden("publicar")).salida, /^Publicado datos\.js/);
  assert.equal(existsSync(join(carpeta, ".gymhub", "discos.json")), true);
});
