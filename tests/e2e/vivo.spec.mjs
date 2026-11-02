// G5 · Recarga en vivo: un cambio se ve en ≤ 3 s sin recargar, no se repinta si la versión no cambia,
// un datos.js roto mantiene el último estado bueno con un aviso, sin datos.js hay instrucciones y una
// pestaña abierta mucho rato no acumula <script> ni memoria.
import { writeFileSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { test, expect, abrir } from "./base.mjs";

const banca = (fecha, kg) => `---\nfecha: ${fecha}\ntitulo: Torso\ntipo: torso\nconfianza: alta\n---\n## Ejercicios\n### Press banca\n<!-- id: press-banca -->\n| # | tipo | carga | reps | rpe | rir | nota |\n|---|---|---|---|---|---|---|\n| 1 | trabajo | ${kg} kg | 5 | 8 | | |\n| 2 | trabajo | ${kg} kg | 5 | 8 | | |\n| 3 | trabajo | ${kg} kg | 5 | 8 | | |\n`;
const web = (w, f) => join(w.carpeta, ".gymhub", "web", f);

test("un cambio en los datos se ve en 3 s o menos, sin recargar y sin perder la vista", async ({ page, web: w }) => {
  await abrir(page, w.url, "progreso");
  let recargas = 0;
  page.on("framenavigated", (f) => { if (f === page.mainFrame()) recargas++; });
  await expect(page.locator("#g-hist")).toContainText("11 sesiones");
  writeFileSync(join(w.carpeta, "sesiones", "2026", "2026-11-05.md"), banca("2026-11-05", 85));
  w.publicar();
  const t0 = Date.now();
  await expect(page.locator("#g-hist")).toContainText("12 sesiones", { timeout: 3000 });
  expect(Date.now() - t0).toBeLessThanOrEqual(3000);
  await expect(page.locator("[aria-selected=true]")).toHaveAttribute("data-v", "progreso");
  expect(recargas, "sin recargar la página").toBe(0);
  // Y el récord nuevo aparece: 85 × (1 + 5/30) = 99,2
  await expect(page.locator("#g-rec")).toContainText("99,2 kg");
});

test("si la versión no cambia, no se repinta nada (aunque se vuelva a publicar)", async ({ page, web: w }) => {
  const logs = [];
  page.on("console", (m) => { if (m.text().startsWith("GYMHUB-WEB")) logs.push(m.text()); });
  await abrir(page, w.url, "panel", { depurar: true });
  await page.waitForTimeout(1500);
  logs.length = 0;
  w.publicar();
  w.publicar();
  await page.waitForTimeout(3500);
  expect(logs.filter((l) => /pinta=|v=/.test(l)), logs.join("\n")).toEqual([]);
});

test("un datos.js a medio escribir o con un error de sintaxis: se queda el último estado bueno y sale un aviso discreto", async ({ page, web: w, errores }) => {
  await abrir(page, w.url, "panel");
  await expect(page.locator("#p-k1")).toContainText("11 días");
  const bueno = readFileSync(web(w, "datos.js"), "utf8");
  writeFileSync(web(w, "datos.js"), bueno.slice(0, Math.floor(bueno.length / 2))); // a medias
  writeFileSync(web(w, "version.js"), 'window.GYMHUB_VERSION = "otra-version";\n');
  await expect(page.locator("#aviso-datos")).toContainText("No se han podido leer los datos nuevos", { timeout: 8000 });
  await expect(page.locator("#p-k1")).toContainText("11 días");
  await expect(page.locator("#p-k2")).toContainText(/2\s*\/3/);
  // Cuando vuelve a publicarse bien, el aviso se va
  w.publicar();
  await expect(page.locator("#aviso-datos")).toHaveText("", { timeout: 5000 });
  // El error de sintaxis del datos.js a medias es esperado (lo da el navegador al cargarlo)
  errores.splice(0, errores.length, ...errores.filter((e) => !/SyntaxError|Unexpected end of input|Invalid or unexpected token/.test(e)));
});

test("sin datos.js (ni version.js): la página dice qué hacer en lugar de «Cargando…»", async ({ page, web: w, errores }) => {
  rmSync(web(w, "datos.js"));
  rmSync(web(w, "version.js"));
  await page.goto(w.url + "#semana");
  await expect(page.locator("#v-semana")).toContainText("Todavía no hay datos que enseñar: deja tus entrenos en CONTEXTO/ y usa /gymhub:refresh", { timeout: 6000 });
  await expect(page.locator("#aviso-datos")).toContainText("No se pueden leer los datos");
  await page.keyboard.press("2");
  await expect(page.locator("#v-progreso")).toContainText("Todavía no hay datos que enseñar");
  // Al publicar, aparece todo sin recargar
  w.publicar();
  await expect(page.locator("#g-hist")).toContainText("11 sesiones", { timeout: 5000 });
  errores.splice(0, errores.length, ...errores.filter((e) => !/ERR_FILE_NOT_FOUND|Failed to load resource/.test(e)));
});

test.describe("una pestaña abierta mucho rato", () => {
  const segundos = Number(process.env.GYMHUB_RATO_S ?? 45); // GYMHUB_RATO_S=1800 para la media hora entera
  test(`no acumula <script> en el DOM ni memoria (${segundos} s con un proceso activo: latido cada 0,5 s y datos que cambian)`, async ({ page, web: w }) => {
    test.setTimeout((segundos + 60) * 1000);
    mkdirSync(join(w.carpeta, ".gymhub"), { recursive: true });
    writeFileSync(join(w.carpeta, ".gymhub", "proceso.json"), JSON.stringify({ activo: true, fase: "normalizando", lote: 1, lotes_total: 9, pct: 10, mensaje: "Normalizando · lote 1 de 9", dudas: 0 }));
    w.publicar();
    await abrir(page, w.url, "panel");
    const medir = async () => { await page.evaluate(() => window.gc && window.gc()); return page.evaluate(() => ({ scripts: document.querySelectorAll("script").length, heap: performance.memory?.usedJSHeapSize ?? 0, nodos: document.getElementsByTagName("*").length })); };
    await page.waitForTimeout(5000);
    const antes = await medir();
    const fin = Date.now() + segundos * 1000;
    let k = 0, maxScripts = 0;
    while (Date.now() < fin) {
      if (k % 10 === 0) { writeFileSync(join(w.carpeta, "sesiones", "2026", "2026-11-05.md"), banca("2026-11-05", 80 + (k % 7))); w.publicar(); }
      maxScripts = Math.max(maxScripts, (await medir()).scripts);
      await page.waitForTimeout(1000);
      k++;
    }
    const despues = await medir();
    expect(maxScripts, "como mucho el de la página y uno cargando").toBeLessThanOrEqual(antes.scripts + 1);
    expect(despues.scripts).toBe(antes.scripts);
    expect(Math.abs(despues.nodos - antes.nodos), "el DOM no crece").toBeLessThan(200);
    expect(despues.heap - antes.heap, `memoria: de ${antes.heap} a ${despues.heap} bytes`).toBeLessThan(3 * 1024 * 1024);
  });
});
