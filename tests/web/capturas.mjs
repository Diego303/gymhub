// Capturas con Playwright (Chromium) de una vista en tema claro y oscuro, sin errores en consola.
//   node tests/web/capturas.mjs <carpeta> <#ancla> <salida-sin-extension> [ancho] [alto]
import { chromium } from "playwright-core";
import { readdirSync } from "node:fs";
import { join } from "node:path";
const [carpeta, ancla, salida, ancho = "1000", alto = "780"] = process.argv.slice(2);
const b = join(process.env.HOME, ".cache/ms-playwright"), ff = readdirSync(b).filter((x) => x.startsWith("firefox-")).sort().at(-1);
const nav = await chromium.launch({ env: { ...process.env, LD_LIBRARY_PATH: [process.env.LD_LIBRARY_PATH, ff && join(b, ff, "firefox")].filter(Boolean).join(":") } });
let errores = 0;
for (const [tema, sufijo] of [["light", ""], ["dark", "-oscuro"]]) {
  const p = await nav.newPage({ viewport: { width: Number(ancho), height: Number(alto) }, colorScheme: tema });
  p.on("console", (m) => { if (m.type() === "error") { errores++; console.log(`  error en consola (${tema}): ${m.text()}`); } });
  p.on("pageerror", (e) => { errores++; console.log(`  error de la página (${tema}): ${e.message}`); });
  await p.goto(`file://${join(carpeta, ".gymhub/web/dashboard.html")}${ancla}`);
  await p.waitForFunction(() => document.querySelector(".vista.on")?.dataset.armado || document.querySelector(".vista.on #p-k1 .k"), null, { timeout: 15000 });
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${salida}${sufijo}.png` });
  console.log(`  captura: ${salida}${sufijo}.png`);
  await p.close();
}
await nav.close();
console.log(errores ? `RESULTADO: ${errores} errores en consola` : "RESULTADO: OK, sin errores en consola");
process.exit(errores ? 1 : 0);
