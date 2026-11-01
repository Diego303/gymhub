// G5 · Capturas de referencia por vista (test/visual/), en claro y en oscuro, con el fixture «mini»
// (datos inventados, «hoy» fijo y sin hora de refresh). pnpm test:visual compara; para regenerarlas
// a propósito: pnpm test:visual --update-snapshots
import { test, expect, abrir } from "./base.mjs";

const VISTAS = ["panel", "progreso", "analisis", "diario", "ejercicios", "semana"];
for (const tema of ["claro", "oscuro"]) {
  for (const v of VISTAS) {
    test(`${v} · ${tema}`, async ({ page, web }) => {
      await page.emulateMedia({ colorScheme: tema === "claro" ? "light" : "dark", reducedMotion: "reduce" });
      await abrir(page, web.url, v);
      await page.mouse.move(0, 0);
      await page.waitForTimeout(300);
      await expect(page).toHaveScreenshot(`${v}-${tema}.png`, { fullPage: true });
    });
  }
}
