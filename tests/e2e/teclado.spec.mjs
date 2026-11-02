// G5 · Teclado y accesibilidad básica: foco visible (claro y oscuro), pestañas con su rol y estado,
// navegación con Tab, Enter y las teclas 1–6, campos que no roban las teclas, y nombres accesibles en
// gráficos, botones y campos de las 6 vistas.
import { test, expect, abrir } from "./base.mjs";

const VISTAS = ["panel", "progreso", "analisis", "diario", "ejercicios", "semana"];

for (const tema of ["light", "dark"]) {
  test(`foco visible y pestañas con teclado · tema ${tema === "light" ? "claro" : "oscuro"}`, async ({ page, web }) => {
    await page.emulateMedia({ colorScheme: tema });
    await abrir(page, web.url, "panel");
    await expect(page.locator("#pestanas")).toHaveAttribute("role", "tablist");
    expect(await page.locator("[role=tab]").count()).toBe(6);
    await page.keyboard.press("Tab");
    const foco = await page.evaluate(() => { const e = document.activeElement, cs = getComputedStyle(e); return { rol: e.getAttribute("role"), outline: cs.outlineStyle, ancho: parseFloat(cs.outlineWidth), sombra: cs.boxShadow }; });
    expect(foco.rol).toBe("tab");
    expect(foco.outline !== "none" && foco.ancho > 0 || foco.sombra !== "none", JSON.stringify(foco)).toBe(true);
    // Tab hasta «Diario» y Enter
    for (let i = 0; i < 3; i++) await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toHaveAttribute("data-v", "diario");
    await page.keyboard.press("Enter");
    await expect(page.locator("[aria-selected=true]")).toHaveAttribute("data-v", "diario");
    // Las teclas 1–6 cambian de vista, salvo dentro de un campo; Escape sale del campo
    await page.keyboard.press("6");
    await expect(page.locator("[aria-selected=true]")).toHaveAttribute("data-v", "semana");
    await page.keyboard.press("4");
    await page.click("#d-q");
    await page.keyboard.type("2");
    await expect(page.locator("#d-q")).toHaveValue("2");
    await expect(page.locator("[aria-selected=true]")).toHaveAttribute("data-v", "diario");
    await page.keyboard.press("Escape");
    await page.keyboard.press("1");
    await expect(page.locator("[aria-selected=true]")).toHaveAttribute("data-v", "panel");
  });
}

test("gráficos, botones y campos de las 6 vistas tienen nombre accesible", async ({ page, web }) => {
  for (const v of VISTAS) {
    await abrir(page, web.url, v);
    const r = await page.evaluate((vista) => {
      const raiz = document.querySelector(`#v-${vista}`);
      const nombre = (e) => (e.getAttribute("aria-label") || e.getAttribute("title") || e.querySelector(":scope > title")?.textContent || e.textContent || "").trim();
      return {
        graficos: [...raiz.querySelectorAll("svg")].filter((s) => !s.parentElement.closest("svg") && s.getAttribute("aria-hidden") !== "true" && !(s.getAttribute("aria-label") || s.querySelector(":scope > title"))).length,
        botones: [...raiz.querySelectorAll("button")].filter((b) => !nombre(b) || /^[←→]$/.test(nombre(b))).length,
        campos: [...raiz.querySelectorAll("input")].filter((i) => !i.getAttribute("aria-label") && !i.labels?.length).length,
        svgConRol: [...raiz.querySelectorAll("svg[role=img]")].length,
      };
    }, v);
    expect({ ...r, svgConRol: undefined }, v).toEqual({ graficos: 0, botones: 0, campos: 0, svgConRol: undefined });
  }
});
