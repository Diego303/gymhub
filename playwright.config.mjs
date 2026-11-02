// Playwright (@playwright/test) para la web: Chromium con file://, datos inventados por test.
//   pnpm test:e2e      la web de verdad (recarga en vivo, vistas, XSS, diseño, teclado)
//   pnpm test:visual   capturas de referencia por vista en test/visual/ (claro y oscuro)
import { defineConfig } from "@playwright/test";
import { libsNavegador } from "./tests/e2e/ayuda.mjs";

export default defineConfig({
  testDir: "tests/e2e",
  snapshotPathTemplate: "test/visual/{arg}{ext}",
  timeout: 90_000,
  fullyParallel: true,
  workers: 3,
  retries: 0,
  reporter: [["list"]],
  outputDir: "tests/.tmp/playwright",
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.002, animations: "disabled", caret: "hide" } },
  use: {
    browserName: "chromium",
    viewport: { width: 1280, height: 900 },
    locale: "es-ES",
    timezoneId: "Europe/Madrid",
    // El Chromium de la caché necesita NSPR/NSS; si el sistema no los tiene, valen los del Firefox de la caché.
    // --expose-gc: para medir la memoria de una pestaña abierta mucho rato sin la basura pendiente.
    launchOptions: { args: ["--js-flags=--expose-gc"], env: { ...process.env, LD_LIBRARY_PATH: [process.env.LD_LIBRARY_PATH, libsNavegador()].filter(Boolean).join(":") } },
  },
  projects: [
    { name: "e2e", testIgnore: /visual\.spec\.mjs/ },
    { name: "visual", testMatch: /visual\.spec\.mjs/ },
  ],
});
