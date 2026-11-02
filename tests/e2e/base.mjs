// Fixture común: cada test lleva su carpeta inventada y falla si hay errores en la consola.
import { test as base, expect } from "@playwright/test";
import { carpetaWeb } from "./ayuda.mjs";
import { generarMini } from "../fixtures/mini.mjs";
import { TEXTO_CATALOGO } from "../fixtures/ayuda-metricas.mjs";

export const mini = (c) => generarMini(c, { catalogo: TEXTO_CATALOGO });

export const test = base.extend({
  /** Errores de la consola y de la página: al final de cada test tiene que estar vacío. */
  errores: [async ({ page }, usar) => {
    const errores = [];
    page.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });
    page.on("pageerror", (e) => errores.push(e.message));
    await usar(errores);
    expect(errores, "errores en la consola").toEqual([]);
  }, { auto: true }],
  /** La carpeta «mini» (11 sesiones, hoy 2026-11-05) publicada. */
  web: async ({}, usar) => { const w = carpetaWeb({ preparar: mini }); await usar(w); w.limpiar(); },
});
export { expect };

/** Abre la página en una vista y espera a que los datos estén pintados. */
export async function abrir(page, url, vista = "panel", { depurar = false } = {}) {
  await page.goto(`${url}${depurar ? "?depurar" : ""}#${vista}`);
  await page.waitForFunction((v) => document.querySelector(`#v-${v}`)?.textContent.trim().length > 20 && !/Cargando datos/.test(document.querySelector(`#v-${v}`).textContent), vista);
}
