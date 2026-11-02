// G5 · Las 6 vistas en Chromium (file://): los números visibles son los calculados a mano en G2
// (fixture «mini», tests/metricas.test.mjs), los estados vacío / una sesión / historial largo no rompen
// nada, y filtros, búsqueda, despliegues, rangos y navegación funcionan.
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { test, expect, abrir, mini } from "./base.mjs";
import { carpetaWeb } from "./ayuda.mjs";
import { generarDosAnios } from "../fixtures/dosanios.mjs";

const banca = (fecha, kg = 60, extra = "") => `---\nfecha: ${fecha}\ntitulo: Torso\ntipo: torso\nconfianza: alta\n${extra}---\n## Ejercicios\n### Press banca\n<!-- id: press-banca -->\n| # | tipo | carga | reps | rpe | rir | nota |\n|---|---|---|---|---|---|---|\n| 1 | trabajo | ${kg} kg | 5 | 8 | | |\n`;
const escribir = (c, fecha, texto, sufijo = "") => { mkdirSync(join(c, "sesiones", fecha.slice(0, 4)), { recursive: true }); writeFileSync(join(c, "sesiones", fecha.slice(0, 4), `${fecha}${sufijo}.md`), texto); };

/** El texto que se ve (innerText, con los espacios entre bloques) contiene la cadena o casa con la expresión. */
const txt = (page, sel) => page.$eval(sel, (e) => e.innerText.replace(/\s+/g, " ").trim());
async function contiene(page, sel, patron) {
  const p = expect.poll(() => txt(page, sel), { message: sel, timeout: 5000 });
  await (typeof patron === "string" ? p.toContain(patron) : p.toMatch(patron));
}

/** Nada de NaN, Infinity, undefined ni anchos negativos en lo que se ve. */
async function sinBasura(page, vista) {
  const r = await page.evaluate((v) => {
    const el = document.querySelector(`#v-${v}`);
    const texto = el.innerText;
    const negativos = [...el.querySelectorAll("[style]")].filter((e) => /(width|height):\s*-/.test(e.getAttribute("style"))).length;
    const svgMal = [...el.querySelectorAll("svg *")].filter((e) => [...e.attributes].some((a) => /NaN|Infinity|undefined/.test(a.value))).length;
    return { basura: (texto.match(/\b(NaN|Infinity|undefined|null|\[object Object\])\b/g) || []), negativos, svgMal };
  }, vista);
  expect(r, `vista ${vista}`).toEqual({ basura: [], negativos: 0, svgMal: 0 });
}

test("Panel: tarjetas, barras y bloques con las cifras de G2", async ({ page, web }) => {
  await abrir(page, web.url, "panel");
  await contiene(page, "#p-k1", /Racha\s*11 días\s*mejor: 11/);
  await contiene(page, "#p-k2", /2\s*\/3/);
  await contiene(page, "#p-k3", /5\s*t\s*\+25% vs anterior/);
  await contiene(page, "#p-k4", /2\s*último: sentadilla/);
  await contiene(page, "#p-prog", "sentadilla +14,6 kg en 3 sem objetivo 130");
  await contiene(page, "#p-obj", "Press banca 93,3 / 100 kg · 93%");
  await contiene(page, "#p-obj", "Sentadilla 116,7 / 130 kg · 90%");
  await contiene(page, "#p-grp", "Pecho ▲ 3/10");
  await contiene(page, "#p-grp", "Pecho va corto: faltan 7 series");
  await contiene(page, "#p-sem", /RPE medio 7,7.*Sueño medio 6h 45m/s);
  await contiene(page, "#p-rex", "¡PR en sentadilla!");
  // Las barras de objetivos miden lo que dicen
  expect(await page.$$eval("#p-obj [style*='width']", (b) => b.map((x) => x.style.width).filter((w) => w.endsWith("%")))).toEqual(expect.arrayContaining(["93%", "90%"]));
  // Calendario: 12 semanas × 7 días, hoy marcado y el futuro sin nivel
  expect(await page.locator("#p-cal .cal i").count()).toBe(84);
  await expect(page.locator("#p-cal .cal i.hoy")).toHaveCount(1);
  await sinBasura(page, "panel");
});

test("Progreso: mapa, récords con NUEVO, bloque, discos interactivos e historial", async ({ page, web }) => {
  await abrir(page, web.url, "progreso");
  await contiene(page, "#g-mapa", "más trabajado: espalda alta 4");
  await contiene(page, "#g-mapa", "olvidados: femoral 0 · aductor 0 · gemelo 0");
  await contiene(page, "#g-rec", /Press banca\s*nuevo\s*93,3 kg e1RM · 2 nov/);
  await contiene(page, "#g-rec", /Remo con barra\s*76 kg e1RM · 26 oct/);
  await contiene(page, "#g-rec", "2 PRs este mes · 7 este año");
  await contiene(page, "#g-blq", "86% S42");
  await contiene(page, "#g-hist", "11 sesiones · 18 t · desde oct 2026");
  await page.fill("#g-kg", "142.5");
  await expect(page.locator("#g-pl")).toHaveText("por lado: 25 + 25 + 10 + 1,25");
  await sinBasura(page, "progreso");
});

test("Análisis: radar con su conmutador, ratios, carga, disposición y n/d sin NaN", async ({ page, web }) => {
  await abrir(page, web.url, "analisis");
  await contiene(page, "#a-radar", "▲ Más flojo: rodilla · 73");
  await contiene(page, "#a-rat", /Empuje : tirón \(series\)\s*1,91\s*empujas más que tiras/);
  await contiene(page, "#a-rat", /Cuádriceps : femoral\s*n\/d/);
  await contiene(page, "#a-rat", /Banca : remo \(fuerza\)\s*1,23\s*en rango/);
  await contiene(page, "#a-carga", "Disposición hoy 71/100");
  await contiene(page, "#a-carga", "hacen falta 4 semanas de datos");
  await contiene(page, "#a-pred", "pocos datos (4 de 6 semanas)");
  // Los valores del radar están en sus tooltips: fuerza…
  const tts = () => page.$$eval("#a-radar [data-tt]", (x) => x.map((e) => e.getAttribute("data-tt")));
  expect((await tts()).join(" | ")).toMatch(/Rodilla: 73/);
  // …y volumen, con el conmutador
  await page.getByRole("button", { name: "volumen" }).click();
  await expect(page).toHaveURL(/#analisis\?modo=volumen/);
  expect((await tts()).join(" | ")).toMatch(/Empuje horiz\.: 100/);
  await sinBasura(page, "analisis");
});

test("Diario: orden, despliegue de una sesión, filtros por zona y PR, buscador y sesiones del mismo día", async ({ page }) => {
  const w = carpetaWeb({ preparar: (c) => { mini(c); escribir(c, "2026-11-04", banca("2026-11-04", 50, "sensacion_post: 9\n"), "-2"); } });
  try {
    await abrir(page, w.url, "diario");
    // De la más reciente a la más antigua: el mismo día, la segunda sesión (-2) antes que la primera
    const rutas = await page.$$eval("#d-tl .ent", (x) => x.map((e) => e.dataset.k));
    expect(rutas.slice(0, 3)).toEqual(["sesiones/2026/2026-11-04-2.md", "sesiones/2026/2026-11-04.md", "sesiones/2026/2026-11-02.md"]);
    expect(rutas).toEqual([...rutas].sort((a, b) => (a.slice(14, 24) < b.slice(14, 24) ? 1 : a.slice(14, 24) > b.slice(14, 24) ? -1 : 0)));
    const pierna = page.locator("#d-tl .ent[data-k='sesiones/2026/2026-11-04.md']");
    await expect(pierna).toContainText("Pierna");
    await pierna.click();
    await expect(pierna.locator(".det")).toBeVisible();
    await expect(pierna.locator(".det")).toContainText("Ficha · sesiones/2026/2026-11-04.md");
    await page.click("[data-chip='hombro izq.']");
    await expect(page.locator("#d-tl .ent")).toHaveCount(1);
    await page.click("[data-chip='Con PR']");
    await expect(page.locator("#d-tl .ent")).toHaveCount(7);
    await page.click("[data-chip='Todo']");
    await page.fill("#d-q", "sólida");
    await expect(page.locator("#d-tl .ent")).toHaveCount(1);
    await page.fill("#d-q", "SOLIDA");
    await expect(page.locator("#d-tl .ent")).toHaveCount(1);
    await sinBasura(page, "diario");
  } finally { w.limpiar(); }
});

test("Ejercicios: lista, búsqueda sin tildes ni mayúsculas y por alias, ficha y rangos", async ({ page, web }) => {
  await abrir(page, web.url, "ejercicios");
  const nombres = () => page.$$eval("#e-lista .it", (x) => x.map((e) => e.querySelector(":scope > div > div:first-child").textContent));
  expect(await nombres()).toEqual(["Press banca", "Sentadilla", "Remo con barra"]);
  for (const [q, esperado] of [["BANCA", ["Press banca"]], ["bench", ["Press banca"]], ["squat", ["Sentadilla"]], ["cuadriceps", ["Sentadilla"]], ["CUÁDRICEPS", ["Sentadilla"]], ["espalda", ["Remo con barra"]], ["press-banca", ["Press banca"]], ["zzz", []]]) {
    await page.fill("#e-q", q);
    expect(await nombres(), q).toEqual(esperado);
  }
  await page.fill("#e-q", "");
  await page.click("#e-lista .it[data-id='sentadilla']");
  await expect(page).toHaveURL(/#ejercicios\/sentadilla/);
  await contiene(page, "#e-cab", "e1RM actual 116,7 kg");
  for (const r of ["6M", "1A", "Todo"]) { await page.getByRole("button", { name: r, exact: true }).click(); await expect(page.locator("#e-graf circle[data-tt]")).toHaveCount(4); }
  await page.click("#e-lista .it[data-id='press-banca']");
  await contiene(page, "#e-rep", "5 80 kg 2 nov");
  await contiene(page, "#e-ult", "2 nov 3 80 kg × 5 @8 93,3 ★");
  await sinBasura(page, "ejercicios");
});

test("Semana: KPIs, flechas y teclado, «esta semana», #ancla, tira de 26 semanas y resumen del mes", async ({ page, web }) => {
  await abrir(page, web.url, "semana");
  await contiene(page, "#s-cab", "Semana 45 2 nov – 8 nov 2026");
  await contiene(page, "#s-kpis", /Volumen\s*5 t\s*▲ 1% vs anterior\s*▲ 16% vs media 4/);
  await contiene(page, "#s-grp", "Pecho ▲ 3 / 6");
  await contiene(page, "#s-mes", "Resumen de noviembre (en curso)");
  await page.keyboard.press("ArrowLeft");
  await expect(page).toHaveURL(/#semana\/2026-W44$/);
  await contiene(page, "#s-cab", "Semana 44");
  await contiene(page, "#s-mes", "Resumen de octubre");
  await page.locator("#s-cab button").first().click();
  await contiene(page, "#s-cab", "Semana 43");
  await page.getByRole("button", { name: /esta semana/ }).click();
  await contiene(page, "#s-cab", "Semana 45");
  await page.goto(web.url + "#semana/2026-W42");
  await contiene(page, "#s-cab", "Semana 42 12 oct – 18 oct 2026");
  await sinBasura(page, "semana");
});

test("Semana: el cambio de año con la semana 53, una semana vacía y la semana en curso", async ({ page }) => {
  const w = carpetaWeb({ hoy: "2027-01-12", preparar: (c) => { for (const f of ["2026-12-21", "2026-12-28", "2026-12-31", "2027-01-02", "2027-01-11"]) escribir(c, f, banca(f)); } });
  try {
    await abrir(page, w.url, "semana");
    await contiene(page, "#s-cab", "Semana 2"); // la actual (en curso, con una sesión)
    await contiene(page, "#s-kpis", /Sesiones\s*1\/4/);
    await page.keyboard.press("ArrowLeft");
    await contiene(page, "#s-cab", "Semana 1 4 ene – 10 ene 2027"); // vacía
    await contiene(page, "#s-kpis", /Sesiones\s*0\/4/);
    await page.keyboard.press("ArrowLeft");
    await contiene(page, "#s-cab", "Semana 53 28 dic – 3 ene 2027");
    await contiene(page, "#s-kpis", /Sesiones\s*3\/4/);
    await contiene(page, "#s-mes", "Resumen de diciembre");
    await sinBasura(page, "semana");
  } finally { w.limpiar(); }
});

test("estados: vacío, una sola sesión e historial largo (2 años) en las 6 vistas, sin errores ni basura", async ({ page }) => {
  const casos = {
    vacio: () => {},
    una: (c) => escribir(c, "2026-11-05", banca("2026-11-05")),
    largo: (c) => generarDosAnios(c),
  };
  for (const [nombre, preparar] of Object.entries(casos)) {
    const w = carpetaWeb({ preparar, hoy: nombre === "largo" ? "2026-10-31" : "2026-11-05" });
    try {
      for (const v of ["panel", "progreso", "analisis", "diario", "ejercicios", "semana"]) {
        await abrir(page, w.url, v);
        await sinBasura(page, v);
        if (nombre === "vacio") await contiene(page, `#v-${v}`, /CONTEXTO\/|\/gymhub:refresh|Aún no|Aquí verás|Aquí aparece|todavía/i);
        await expect(page.locator(`#v-${v}`)).not.toContainText("Error al calcular esta vista");
      }
    } finally { await page.goto("about:blank"); w.limpiar(); } // que la página no siga leyendo una carpeta borrada
  }
});
