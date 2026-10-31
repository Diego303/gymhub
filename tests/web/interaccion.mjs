// Prueba la web de verdad en Chromium y Firefox (Playwright, navegadores en caché):
// pestañas por clic y teclas, #anclas, navegación pedida por un comando, datos en vivo sin
// recargar, tema oscuro, móvil y ninguna petición de red.   GYMHUB_CONFIG=… node tests/web/interaccion.mjs <carpeta>
import { chromium, firefox } from "playwright-core";
import { join } from "node:path";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";

const carpeta = process.argv[2];
process.env.GYMHUB_NO_ABRIR = "1";
const { ponerNavegar, publicar } = await import("../../lib/publicar.mjs");
const { guardar } = await import("../../lib/refresh.mjs");
const { derivarCarpeta } = await import("../../lib/derivar.mjs");
// playwright-core (dependencia de desarrollo) usa los navegadores de ~/.cache/ms-playwright.
// El Chromium de la caché necesita NSPR/NSS: si el sistema no los tiene, se usan los que trae Firefox.
const libsFirefox = () => { const b = join(process.env.HOME, ".cache/ms-playwright"); const d = readdirSync(b).filter((x) => x.startsWith("firefox-")).sort().at(-1); return d ? join(b, d, "firefox") : ""; };
const NAVEGADORES = [
  ["chromium", () => chromium.launch({ env: { ...process.env, LD_LIBRARY_PATH: [process.env.LD_LIBRARY_PATH, libsFirefox()].filter(Boolean).join(":") } })],
  ["firefox", () => firefox.launch()],
];
const url = "file://" + join(carpeta, ".gymhub/web/dashboard.html");
const vistaActiva = (p) => p.$eval("[aria-selected=true]", (b) => b.dataset.v);
let fallos = 0;
const paso = async (nombre, fn) => { try { await fn(); console.log(`  ✔ ${nombre}`); } catch (e) { fallos++; console.log(`  ✖ ${nombre}: ${e.message.split("\n")[0]}`); } };

for (const [nombre, lanzar] of NAVEGADORES) {
  console.log(`# ${nombre}`);
  const nav = await lanzar();
  const ctx = await nav.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await ctx.newPage();
  const peticiones = [];
  page.on("request", (r) => peticiones.push(r.url()));
  await page.goto(url + "#panel");
  await page.waitForFunction(() => document.querySelector("#p-k1 .k"), null, { timeout: 15000 });
  await paso("abre en el Panel con 5 pestañas", async () => {
    assert.equal(await page.$$eval("[role=tab]", (x) => x.length), 5);
    assert.equal(await vistaActiva(page), "panel");
    assert.match(await page.textContent("#p-k2"), /Sesiones semana/);
    assert.ok(await page.isVisible("#p-rex svg"));
  });
  await paso("teclas 1–5 y clic en las pestañas", async () => {
    await page.keyboard.press("2"); assert.equal(await vistaActiva(page), "progreso"); assert.match(page.url(), /#progreso$/);
    await page.keyboard.press("5"); assert.equal(await vistaActiva(page), "ejercicios");
    await page.click("[data-v=diario]"); assert.equal(await vistaActiva(page), "diario"); assert.ok(await page.isVisible("#v-diario"));
    await page.keyboard.press("1"); assert.equal(await vistaActiva(page), "panel");
  });
  await paso("#ancla al abrir", async () => {
    const p2 = await ctx.newPage(); await p2.goto(url + "#analisis?modo=volumen");
    assert.equal(await vistaActiva(p2), "analisis"); await p2.close();
  });
  await paso("un comando cambia la vista de la pestaña abierta (≤ 2 s)", async () => {
    const t0 = Date.now();
    ponerNavegar(carpeta, "progreso", {}); publicar(carpeta);
    await page.waitForFunction(() => document.querySelector("[aria-selected=true]")?.dataset.v === "progreso", null, { timeout: 2500 });
    console.log(`    (${Date.now() - t0} ms)`);
    await page.keyboard.press("1");
  });
  await paso("datos nuevos sin recargar, conservando el scroll (≤ 2 s)", async () => {
    const y = await page.evaluate(() => { window.scrollTo(0, Math.min(200, document.documentElement.scrollHeight - innerHeight)); return Math.round(scrollY); });
    const antes = await page.textContent("#p-k2 .k");
    const n = Number(antes.match(/\d+/)[0]);
    guardar(carpeta, "directo", `@@@ sesion\n---\nfecha: ${process.env.GYMHUB_HOY}\ntitulo: Prueba web\ntipo: empuje\nconfianza: alta\n---\n## Ejercicios\n### Press banca\n<!-- id: press-banca -->\n| # | tipo | carga | reps | rpe | rir | nota |\n|---|---|---|---|---|---|---|\n| 1 | trabajo | 60 kg | 5 | 7 | | |\n<details><summary>Original</summary>\n\nprueba ${nombre} ${Date.now()}\n\n</details>`);
    await derivarCarpeta(carpeta); const t0 = Date.now(); publicar(carpeta);
    await page.waitForFunction((n0) => Number(document.querySelector("#p-k2 .k").textContent.match(/\d+/)[0]) === n0 + 1, n, { timeout: 2500 });
    console.log(`    (${Date.now() - t0} ms)`);
    // No se vuelve arriba; si la página encoge (la rutina pasa a «hoy has hecho»), el navegador la recoloca.
    const [yDespues, maxY] = await page.evaluate(() => [Math.round(scrollY), Math.round(document.documentElement.scrollHeight - innerHeight)]);
    assert.equal(yDespues, Math.min(y, maxY));
    assert.ok(y === 0 || yDespues > 0, "no vuelve arriba");
  });
  await paso("ninguna petición fuera de file://", async () => {
    const fuera = peticiones.filter((u) => !u.startsWith("file://"));
    assert.deepEqual(fuera, []);
    // (Firefox no emite eventos de petición para los <script> de file://)
    if (nombre === "chromium") assert.ok(peticiones.some((u) => /version\.js\?t=/.test(u)) && peticiones.some((u) => /datos\.js\?t=/.test(u)));
  });
  await ctx.close();
  await paso("tema oscuro según el sistema", async () => {
    const c2 = await nav.newContext({ colorScheme: "dark" }); const p = await c2.newPage(); await p.goto(url + "#panel");
    const fondo = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
    assert.equal(fondo, "rgb(26, 26, 25)"); await c2.close();
  });
  await paso("móvil: una sola columna por debajo de 700 px", async () => {
    const c3 = await nav.newContext({ viewport: { width: 390, height: 800 } }); const p = await c3.newPage(); await p.goto(url + "#panel");
    await p.waitForFunction(() => document.querySelector("#p-k1 .k"));
    const cols = await p.$eval(".r-panel-1", (e) => getComputedStyle(e).gridTemplateColumns.split(" ").length);
    assert.equal(cols, 1);
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "sin scroll horizontal");
    await c3.close();
  });
  await nav.close();
}
console.log(fallos ? `RESULTADO: ${fallos} fallos` : "RESULTADO: OK");
process.exit(fallos ? 1 : 0);
