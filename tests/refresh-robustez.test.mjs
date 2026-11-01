// G3 · Robustez de /refresh y de la escritura: ficheros ilegibles, enlaces rotos, binarios y
// enormes en CONTEXTO/, carpetas que no existen, cerrojos huérfanos y procesos matados a mitad.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, readFileSync, symlinkSync, chmodSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { temporal, cli } from "./ayuda.mjs";
import { preparar } from "../lib/refresh.mjs";
import { leerProceso } from "../lib/publicar.mjs";

let t, carpeta;
beforeEach(() => {
  t = temporal();
  carpeta = join(t.dir, "G");
  cli(t.dir, ["configurar", carpeta]);
  process.env.GYMHUB_CONFIG = join(t.dir, "config.json");
  process.env.GYMHUB_HOY = "2026-03-20";
});
afterEach(() => { try { chmodSync(join(carpeta, "CONTEXTO", "sin-permiso.txt"), 0o644); } catch { /* no estaba */ } t.limpiar(); delete process.env.GYMHUB_HOY; delete process.env.GYMHUB_CONFIG; });

const puedeQuitarPermisos = process.getuid?.() !== 0;

test("un fichero sin permiso o un enlace roto en CONTEXTO/ no tumban el /refresh: se avisa y se sigue", { skip: !puedeQuitarPermisos && "como root se puede leer todo" }, () => {
  writeFileSync(join(carpeta, "CONTEXTO", "bueno.txt"), "12/03/2026\nbanca 5x80\n");
  writeFileSync(join(carpeta, "CONTEXTO", "sin-permiso.txt"), "14/03/2026\nsentadilla 5x100\n");
  chmodSync(join(carpeta, "CONTEXTO", "sin-permiso.txt"), 0o000);
  symlinkSync(join(t.dir, "no-existe.txt"), join(carpeta, "CONTEXTO", "enlace-roto.txt"));
  const r = cli(t.dir, ["refresh", "preparar", "--carpeta", carpeta]);
  assert.equal(r.codigo, 0, r.salida + r.error);
  assert.match(r.salida, /1 elementos nuevos en 1 lotes/);
  assert.match(r.salida, /No se ha podido leer \(se queda en CONTEXTO\/\): CONTEXTO\/enlace-roto\.txt \(enlace roto\), CONTEXTO\/sin-permiso\.txt \(sin permiso de lectura\)/);
  // El banner de la web no se queda en «Separando…»
  assert.equal(leerProceso(carpeta).fase, "normalizando");
});

test("un CONTEXTO que no es una carpeta se avisa y la web no se queda en «Separando…»", async () => {
  const { rmSync } = await import("node:fs");
  const ctx = join(carpeta, "CONTEXTO");
  rmSync(ctx, { recursive: true, force: true });
  writeFileSync(ctx, "no soy una carpeta");
  const { imp } = preparar(carpeta);
  assert.deepEqual(imp.ilegibles, [{ rel: "CONTEXTO/", motivo: "no es una carpeta" }]);
  const p = leerProceso(carpeta);
  assert.equal(p.activo, false);
  assert.equal(p.fase, "listo");
});
