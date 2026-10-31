import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { temporal, cli } from "./ayuda.mjs";

test("configurar crea la estructura, guarda la config y publica la web", () => {
  const t = temporal();
  try {
    const carpeta = join(t.dir, "GIMNASIO");
    const r = cli(t.dir, ["configurar", carpeta]);
    assert.equal(r.codigo, 0, r.salida + r.error);
    for (const f of ["FICHA.md", "convenciones.md", "ejercicios.md", "revision.md", "records.md", "CONTEXTO/LEEME.md",
      "CONTEXTO/procesado", "sesiones", "plantillas/LEEME.md", "semanas", ".gymhub/web/dashboard.html",
      ".gymhub/web/datos.js", ".gymhub/web/version.js", ".gymhub/datos.json"]) {
      assert.ok(existsSync(join(carpeta, f)), `falta ${f}`);
    }
    const cfg = JSON.parse(readFileSync(join(t.dir, "config.json"), "utf8"));
    assert.equal(cfg.carpeta, carpeta);
    assert.match(readFileSync(join(carpeta, ".gymhub/web/datos.js"), "utf8"), /^window\.GYMHUB = \{"version":"[0-9a-f]{12}"/);
    assert.match(readFileSync(join(carpeta, ".gymhub/web/version.js"), "utf8"), /^window\.GYMHUB_VERSION = "[0-9a-f]{12}";/);
  } finally { t.limpiar(); }
});

test("configurar nunca sobrescribe lo que ya existe", () => {
  const t = temporal();
  try {
    const carpeta = join(t.dir, "G");
    cli(t.dir, ["configurar", carpeta]);
    writeFileSync(join(carpeta, "FICHA.md"), "# Mi ficha editada\n");
    const r = cli(t.dir, ["configurar", carpeta]);
    assert.equal(r.codigo, 0);
    assert.match(r.salida, /No hacía falta crear nada/);
    assert.equal(readFileSync(join(carpeta, "FICHA.md"), "utf8"), "# Mi ficha editada\n");
  } finally { t.limpiar(); }
});

test("carpeta: mostrar, cambiar y avisar si no tiene estructura", () => {
  const t = temporal();
  try {
    const a = join(t.dir, "A"), b = join(t.dir, "B");
    assert.match(cli(t.dir, ["carpeta"]).salida, /No hay carpeta configurada/);
    cli(t.dir, ["configurar", a]);
    assert.match(cli(t.dir, ["carpeta"]).salida, new RegExp(`${a} · con estructura`));
    const sin = cli(t.dir, ["carpeta", b]);
    assert.equal(sin.codigo, 3);
    assert.match(sin.salida, /^SIN_ESTRUCTURA/);
    cli(t.dir, ["configurar", b]);
    cli(t.dir, ["carpeta", a]);
    const cambio = cli(t.dir, ["carpeta", b]);
    assert.match(cambio.salida, /cambiada a .*B \(antes: .*A\)/);
  } finally { t.limpiar(); }
});

test("ficha edita objetivos, días, peso y lesiones", () => {
  const t = temporal();
  try {
    const c = join(t.dir, "G");
    cli(t.dir, ["configurar", c]);
    const r = cli(t.dir, ["ficha", "--dias", "5", "--objetivo", "banca=100", "--objetivo", "squat=140", "--peso", "80", "--lesion", "Rodilla: prehab antes de pierna"]);
    assert.equal(r.codigo, 0, r.error);
    const f = readFileSync(join(c, "FICHA.md"), "utf8");
    assert.match(f, /- dias_semana: 5/);
    assert.match(f, /- press-banca: 100 kg/);
    assert.match(f, /- sentadilla: 140 kg/);
    assert.match(f, /- peso_corporal: 80 kg/);
    assert.match(f, /- Rodilla: prehab antes de pierna/);
    assert.doesNotMatch(f, /\(ninguna\)/);
  } finally { t.limpiar(); }
});

test("leer y escribir no salen de la carpeta ni tocan sesiones/", () => {
  const t = temporal();
  try {
    const c = join(t.dir, "G");
    cli(t.dir, ["configurar", c]);
    assert.equal(cli(t.dir, ["leer", "../config.json"]).codigo, 1);
    assert.match(cli(t.dir, ["leer", "../config.json"]).error, /fuera de la carpeta/);
    assert.equal(cli(t.dir, ["escribir", "sesiones/2026/2026-01-01.md"], { entrada: "x" }).codigo, 2);
    const w = cli(t.dir, ["escribir", "convenciones.md"], { entrada: "# Mis convenciones\n## Fechas\n- orden: día/mes\n" });
    assert.equal(w.codigo, 0, w.error);
    assert.match(cli(t.dir, ["leer", "convenciones.md"]).salida, /orden: día\/mes/);
    assert.match(w.salida, /copia del anterior/);
  } finally { t.limpiar(); }
});

test("la carpeta de la sesión manda si es una carpeta de gymhub (instalación de proyecto en varias carpetas)", () => {
  const t = temporal();
  try {
    const a = join(t.dir, "A"), b = join(t.dir, "B");
    cli(t.dir, ["configurar", a]);
    cli(t.dir, ["configurar", b]); // la config apunta ahora a B
    cli(t.dir, ["ficha", "--dias", "5"], { cwd: a });
    assert.match(readFileSync(join(a, "FICHA.md"), "utf8"), /- dias_semana: 5/, "desde A, se edita A");
    assert.doesNotMatch(readFileSync(join(b, "FICHA.md"), "utf8"), /- dias_semana: 5/);
    assert.match(cli(t.dir, ["carpeta"], { cwd: a }).salida, new RegExp(`${a} · con estructura \\(la de esta sesión`));
    cli(t.dir, ["ficha", "--dias", "3"], { cwd: t.dir });
    assert.match(readFileSync(join(b, "FICHA.md"), "utf8"), /- dias_semana: 3/, "desde otro sitio, la configurada");
  } finally { t.limpiar(); }
});
