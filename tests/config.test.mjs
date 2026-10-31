import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { homedir } from "node:os";
import { normalizarRuta, rutaConfig, leerConfig, guardarConfig, POR_DEFECTO } from "../lib/config.mjs";
import { temporal } from "./ayuda.mjs";

test("normalizarRuta: Windows, ~, relativas y comillas", () => {
  assert.equal(normalizarRuta("D:\\GIMNASIO"), "/mnt/d/GIMNASIO");
  assert.equal(normalizarRuta("d:/Mis entrenos/"), "/mnt/d/Mis entrenos");
  assert.equal(normalizarRuta("~/GIMNASIO"), join(homedir(), "GIMNASIO"));
  assert.equal(normalizarRuta("datos", "/tmp/x"), "/tmp/x/datos");
  assert.equal(normalizarRuta('"/tmp/con espacios"'), "/tmp/con espacios");
  assert.equal(normalizarRuta(""), null);
});

test("config: GYMHUB_CONFIG, valores por defecto y guardado", () => {
  const t = temporal();
  const antes = process.env.GYMHUB_CONFIG;
  process.env.GYMHUB_CONFIG = join(t.dir, "c.json");
  try {
    assert.equal(rutaConfig(), join(t.dir, "c.json"));
    assert.deepEqual(leerConfig(), { ...POR_DEFECTO });
    guardarConfig({ carpeta: "/tmp/g", barra_kg: 15 });
    const c = leerConfig();
    assert.equal(c.carpeta, "/tmp/g");
    assert.equal(c.barra_kg, 15);
    assert.deepEqual(c.discos_kg, POR_DEFECTO.discos_kg);
  } finally {
    if (antes === undefined) delete process.env.GYMHUB_CONFIG; else process.env.GYMHUB_CONFIG = antes;
    t.limpiar();
  }
});
