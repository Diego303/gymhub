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
  await paso("Progreso: mapa con tooltips y calculadora de discos interactiva", async () => {
    await page.keyboard.press("2");
    await page.waitForSelector("#g-kg");
    assert.ok((await page.$$("#g-mapa rect[data-tt]")).length >= 20);
    await page.fill("#g-kg", "142.5");
    assert.equal(await page.textContent("#g-pl"), "por lado: 25 + 25 + 10 + 1,25");
    await page.fill("#g-kg", "121");
    assert.match(await page.textContent("#g-err"), /No sale exacto con tus discos: el más cercano es 120 kg/);
    await page.fill("#g-kg", "10");
    assert.match(await page.textContent("#g-err"), /Pon un peso entre 20 y 300 kg/);
    await page.keyboard.press("1");
    assert.equal(await vistaActiva(page), "progreso", "en el campo, «1» se escribe");
    await page.keyboard.press("Escape");
    await page.keyboard.press("1");
    assert.equal(await vistaActiva(page), "panel", "Esc quita el foco y las teclas vuelven a cambiar de vista");
  });
  await paso("Análisis: radar con conmutador fuerza/volumen en el #ancla", async () => {
    await page.keyboard.press("3");
    await page.waitForSelector("#a-radar svg polygon");
    await page.click("[data-modo=volumen]");
    assert.match(page.url(), /#analisis\?modo=volumen$/);
    assert.match(await page.textContent("#a-radar"), /Menos volumen/);
    assert.ok((await page.$$("#a-rat .bar")).length === 3);
    await page.keyboard.press("1");
  });
  await paso("Diario: chips, buscador, desplegar una sesión y filtro pedido por /gymhub:diario", async () => {
    await page.keyboard.press("4");
    await page.waitForSelector("#d-tl .ent");
    const total = (await page.$$("#d-tl .ent")).length;
    await page.click("[data-chip='Con PR']");
    const conPR = await page.$$eval("#d-tl .ent", (x) => x.map((e) => e.textContent));
    assert.ok(conPR.length > 0 && conPR.length <= total && conPR.every((t) => t.includes("PR")));
    await page.click("[data-chip=Todo]");
    await page.fill("#d-q", "hip thrust");
    await page.waitForFunction(() => [...document.querySelectorAll("#d-tl .ent")].every((e) => /hip thrust/i.test(e.textContent)));
    await page.click("#d-tl .ent");
    assert.ok(await page.isVisible("#d-tl .ent.open .det"));
    await page.keyboard.press("Escape");
    ponerNavegar(carpeta, "diario", { filtro: "rodilla" }); publicar(carpeta);
    await page.waitForFunction(() => document.querySelector("[data-chip].on")?.dataset.chip === "rodilla", null, { timeout: 2500 });
    await page.keyboard.press("1");
  });
  await paso("Ejercicios: elegir de la lista, rangos 6M/1A/Todo y enlace al Diario", async () => {
    await page.keyboard.press("5");
    await page.waitForSelector("#e-lista .it");
    await page.click("#e-lista .it[data-id=press-banca]");
    assert.match(page.url(), /#ejercicios\/press-banca$/);
    assert.match(await page.textContent("#e-cab"), /Press banca/);
    const n1A = (await page.$$("#e-graf circle[data-tt]")).length;
    await page.click("[data-r=Todo]");
    const nTodo = (await page.$$("#e-graf circle[data-tt]")).length;
    assert.ok(nTodo > n1A, `Todo (${nTodo}) muestra más sesiones que 1A (${n1A})`);
    await page.fill("#e-q", "sentad");
    assert.ok((await page.$$eval("#e-lista .it", (x) => x.map((e) => e.dataset.id))).every((id) => id.includes("sentadilla")));
    await page.keyboard.press("Escape");
    await page.click("#e-ult [data-diario]");
    assert.equal(await vistaActiva(page), "diario");
    await page.keyboard.press("Escape");
    await page.keyboard.press("1");
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
  await paso("una sesión con errores de formato se avisa en la cabecera", async () => {
    const { writeFileSync, rmSync } = await import("node:fs");
    const f = join(carpeta, "sesiones/2026/2026-10-30-9.md");
    writeFileSync(f, "---\nfecha: 2026-10-30\n---\n## Ejercicios\n### X\n<!-- id: no-existe -->\n| # | tipo | carga | reps |\n|---|---|---|---|\n| 1 | trabajo | 10 kg | 5 |\n");
    await derivarCarpeta(carpeta); publicar(carpeta);
    await page.waitForFunction(() => /1 sesión con errores de formato/.test(document.getElementById("aviso-datos").textContent), null, { timeout: 2500 });
    rmSync(f); await derivarCarpeta(carpeta); publicar(carpeta);
    await page.waitForFunction(() => document.getElementById("aviso-datos").textContent === "", null, { timeout: 2500 });
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
