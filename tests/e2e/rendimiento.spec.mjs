// G6 · Rendimiento de la web con 5 años inventados (~1.000 sesiones, ~20.000 series): primera pintura
// de cada vista < 200 ms, cambiar de pestaña < 100 ms y un latido que no hace trabajo pesado si la
// versión no cambia (ni carga datos.js ni tareas largas).
import { test, expect } from "./base.mjs";
import { carpetaWeb } from "./ayuda.mjs";
import { generarCincoAnios } from "../fixtures/cinco-anios.mjs";

const VISTAS = ["panel", "progreso", "analisis", "diario", "ejercicios", "semana"];
/** Cambia de vista con su tecla y mide hasta el siguiente fotograma pintado (ms). */
const cambiar = (page, n) => page.evaluate((tecla) => new Promise((ok) => {
  const t0 = performance.now();
  document.dispatchEvent(new KeyboardEvent("keydown", { key: tecla, bubbles: true }));
  requestAnimationFrame(() => setTimeout(() => ok(performance.now() - t0), 0));
}), String(n));

test("5 años: primera pintura de cada vista < 200 ms, cambio de pestaña < 100 ms y latido ligero", async ({ page }) => {
  test.setTimeout(180_000);
  let info;
  const w = carpetaWeb({ preparar: (c) => { info = generarCincoAnios(c); }, hoy: "2026-10-31" });
  try {
    expect(info.sesiones).toBeGreaterThan(1000);
    expect(info.series).toBeGreaterThan(20000);
    const t0 = Date.now();
    await page.goto(`${w.url}#panel`);
    await page.waitForFunction(() => /días/.test(document.querySelector("#p-k1")?.textContent ?? ""));
    const carga = Date.now() - t0;
    // Primera vez que se pinta cada vista (en frío) y cambios después (en caliente)
    const frio = {}, caliente = {};
    for (const [i, v] of VISTAS.entries()) if (i) frio[v] = await cambiar(page, i + 1);
    for (const [i, v] of VISTAS.entries()) caliente[v] = await cambiar(page, i + 1);
    for (const [v, ms] of Object.entries(frio)) expect(ms, `primera pintura de ${v}`).toBeLessThan(200);
    for (const [v, ms] of Object.entries(caliente)) expect(ms, `cambiar a ${v}`).toBeLessThan(100);
    // Latido sin cambios: 6 s sin cargar datos.js y sin tareas largas (> 50 ms)
    const datosjs = [];
    page.on("request", (r) => { if (/datos\.js/.test(r.url())) datosjs.push(r.url()); });
    const largas = await page.evaluate(() => new Promise((ok) => {
      const l = [];
      new PerformanceObserver((lista) => l.push(...lista.getEntries().map((e) => Math.round(e.duration)))).observe({ type: "longtask" });
      setTimeout(() => ok(l), 6000);
    }));
    expect(datosjs, "sin cambios de versión no se vuelve a leer datos.js").toEqual([]);
    expect(largas, "tareas largas durante el latido").toEqual([]);
    console.log(`5 años (${info.sesiones} sesiones, ${info.series} series): carga inicial ${carga} ms · primera pintura ${JSON.stringify(Object.fromEntries(Object.entries(frio).map(([k, v]) => [k, Math.round(v)])))} · cambio ${JSON.stringify(Object.fromEntries(Object.entries(caliente).map(([k, v]) => [k, Math.round(v)])))}`);
  } finally { await page.goto("about:blank"); w.limpiar(); }
});
