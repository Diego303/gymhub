// G5 · Diseño adaptable: de 1024 a 1920 px con zoom del 80 al 200 % (el zoom del navegador equivale a
// un viewport de ancho/zoom px CSS), en claro y en oscuro: sin scroll horizontal, sin cajas que se
// desbordan ni se solapan y sin texto cortado. Con un historial de 2 años (el caso más denso).
import { test, expect } from "./base.mjs";
import { carpetaWeb } from "./ayuda.mjs";
import { generarDosAnios } from "../fixtures/dosanios.mjs";

const ANCHOS = [1024, 1280, 1440, 1920];
const ZOOMS = [0.8, 1, 1.25, 1.5, 2];
const VISTAS = ["panel", "progreso", "analisis", "diario", "ejercicios", "semana"];

async function problemas(page, vista) {
  return page.evaluate((v) => {
    const raiz = document.querySelector(`#v-${v}`);
    const boxes = [...raiz.querySelectorAll(".box")];
    const desborda = boxes.filter((b) => b.scrollWidth > b.clientWidth + 2).map((b) => b.id || b.className);
    const solapes = [];
    const porPadre = new Map();
    for (const b of boxes) { if (!porPadre.has(b.parentElement)) porPadre.set(b.parentElement, []); porPadre.get(b.parentElement).push(b); }
    for (const hs of porPadre.values()) for (let i = 0; i < hs.length; i++) for (let j = i + 1; j < hs.length; j++) {
      const a = hs[i].getBoundingClientRect(), c = hs[j].getBoundingClientRect();
      if (Math.min(a.right, c.right) - Math.max(a.left, c.left) > 2 && Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top) > 2) solapes.push(`${hs[i].id}/${hs[j].id}`);
    }
    const cortes = [...raiz.querySelectorAll("*")].filter((e) => !e.children.length && e.textContent.trim() && getComputedStyle(e).overflow !== "visible" && e.scrollWidth > e.clientWidth + 2).map((e) => e.textContent.trim().slice(0, 30));
    return { scroll: Math.max(0, document.documentElement.scrollWidth - innerWidth), desborda, solapes, cortes };
  }, vista);
}

for (const tema of ["light", "dark"]) {
  test(`sin cortes ni solapes de 1024 a 1920 px y zoom del 80 al 200 % · tema ${tema === "light" ? "claro" : "oscuro"}`, async ({ page }) => {
    test.setTimeout(240_000);
    const w = carpetaWeb({ preparar: (c) => generarDosAnios(c), hoy: "2026-10-31" });
    try {
      await page.emulateMedia({ colorScheme: tema });
      const fallos = [];
      for (const ancho of ANCHOS) for (const zoom of ZOOMS) {
        await page.setViewportSize({ width: Math.round(ancho / zoom), height: Math.round(900 / zoom) });
        for (const v of VISTAS) {
          await page.goto(`${w.url}#${v}`);
          await page.waitForFunction((x) => document.querySelector(`#v-${x} .box`) && !/Cargando/.test(document.querySelector(`#v-${x}`).textContent), v);
          const p = await problemas(page, v);
          if (p.scroll || p.desborda.length || p.solapes.length || p.cortes.length) fallos.push(`${ancho} px al ${zoom * 100} % · ${v}: ${JSON.stringify(p)}`);
        }
      }
      expect(fallos).toEqual([]);
      // El tema oscuro se aplica de verdad
      const fondo = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      if (tema === "dark") expect(fondo).not.toBe("rgb(255, 255, 255)");
    } finally { await page.goto("about:blank"); w.limpiar(); }
  });
}
