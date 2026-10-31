// Comprueba que las vistas no cambian: pinta la versión de dashboard.html de un commit y la actual
// sobre los mismos datos y compara el HTML de cada vista.
//   GYMHUB_CONFIG=… node tests/web/vistas-iguales.mjs <carpeta> [commit=HEAD] [vistas=panel,progreso,analisis,diario,ejercicios]
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import { writeFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const [carpeta, ref = "HEAD", lista = "panel,progreso,analisis,diario,ejercicios"] = process.argv.slice(2);
const web = join(carpeta, ".gymhub/web");
writeFileSync(join(web, "dashboard-antes.html"), execFileSync("git", ["show", `${ref}:web/dashboard.html`]));
const b = join(process.env.HOME, ".cache/ms-playwright"), ff = readdirSync(b).filter((x) => x.startsWith("firefox-")).sort().at(-1);
const nav = await chromium.launch({ env: { ...process.env, LD_LIBRARY_PATH: [process.env.LD_LIBRARY_PATH, ff && join(b, ff, "firefox")].filter(Boolean).join(":") } });
// Lo que cambia a propósito y no es de la vista: el pie del Panel con las teclas.
const normalizar = (h) => h.replace(/teclas 1–\d para cambiar de vista/, "teclas 1–N para cambiar de vista");
async function pintar(fichero, vista) {
  const p = await nav.newPage({ viewport: { width: 1100, height: 900 } });
  await p.goto(`file://${join(web, fichero)}#${vista}`);
  await p.waitForFunction((v) => document.querySelector(`#v-${v}`)?.dataset.armado || (v === "panel" && document.querySelector("#p-k1 .k")), vista, { timeout: 15000 });
  await p.waitForTimeout(300);
  const html = normalizar(await p.$eval(`#v-${vista}`, (e) => e.innerHTML));
  await p.close();
  return html;
}
let distintas = 0;
for (const v of lista.split(",")) {
  const [a, d] = [await pintar("dashboard-antes.html", v), await pintar("dashboard.html", v)];
  if (a === d) console.log(`  ✔ ${v}: idéntica (${a.length} caracteres de HTML)`);
  else { distintas++; let i = 0; while (a[i] === d[i]) i++; console.log(`  ✖ ${v}: distinta a partir de «…${d.slice(Math.max(0, i - 60), i + 60)}…»`); }
}
await nav.close();
rmSync(join(web, "dashboard-antes.html"));
console.log(distintas ? `RESULTADO: ${distintas} vistas distintas` : `RESULTADO: OK, las vistas son idénticas a ${ref}`);
process.exit(distintas ? 1 : 0);
