// Regla 12: con la web abierta (navegador sin ventana), un cambio en los datos se ve en ≤ 2 s sin
// recargar, y un /refresh sintético se ve avanzar lote a lote.
//   GYMHUB_CONFIG=… node tests/web/medir-web.mjs <carpeta de demo> [edge|chrome|linux]
import { spawn, execFileSync } from "node:child_process";
import { readdirSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";

const [carpeta, navegador = "edge"] = process.argv.slice(2);
process.env.GYMHUB_NO_ABRIR = "1";
const { guardar, preparar, cerrar } = await import("../../lib/refresh.mjs");
const { derivarCarpeta } = await import("../../lib/derivar.mjs");
const { publicar, ponerProceso } = await import("../../lib/publicar.mjs");
const { leerJSON } = await import("../../lib/util.mjs");

const enWindows = navegador !== "linux";
const winpath = (p) => execFileSync("wslpath", ["-w", p]).toString().trim();
const html = join(carpeta, ".gymhub/web/dashboard.html");
const marca = `gymhub-web-perfil-${process.pid}`;
const perfil = join(carpeta, "..", marca);
mkdirSync(perfil, { recursive: true });
let exe, url;
if (navegador === "edge") exe = "/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
else if (navegador === "chrome") exe = "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe";
else { const b = join(process.env.HOME, ".cache/ms-playwright"); exe = join(b, readdirSync(b).filter((x) => x.startsWith("chromium_headless_shell-")).sort().at(-1), "chrome-headless-shell-linux64/chrome-headless-shell"); }
if (enWindows) { const w = winpath(html); url = (w.startsWith("\\\\") ? "file:" : "file:///") + w.replaceAll("\\", "/"); } else url = "file://" + html;
const hijo = spawn(exe, ["--headless=new", "--disable-gpu", "--no-first-run", `--user-data-dir=${enWindows ? winpath(perfil) : perfil}`, "--enable-logging=stderr", "--v=0", url + "?depurar#panel"], { stdio: ["ignore", "pipe", "pipe"] });

const versiones = new Map(); const banners = []; const esperas = [];
const leer = (f) => createInterface({ input: f }).on("line", (l) => {
  const m = l.match(/GYMHUB-WEB (v=|banner=)(.*?)", source/);
  if (!m) return;
  const t = performance.now();
  if (m[1] === "v=") { versiones.set(m[2], t); for (const e of esperas.filter((x) => x.v === m[2])) e.ok(t); }
  else banners.push(m[2]);
});
leer(hijo.stdout); leer(hijo.stderr);
const versionActual = () => leerJSON(join(carpeta, ".gymhub/web/datos.js".replace("datos.js", "datos.json")), {}) && readVersion();
const readVersion = () => String(execFileSync("cat", [join(carpeta, ".gymhub/web/version.js")])).match(/"(.+)"/)[1];
const verse = (v, limite = 8000) => new Promise((ok) => {
  const t0 = performance.now();
  if (versiones.has(v)) return ok(0);
  const e = { v, ok: (t) => ok(t - t0) };
  esperas.push(e);
  setTimeout(() => ok(null), limite);
});
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (x) => (x === null ? "NO LLEGÓ" : (x / 1000).toFixed(2) + " s");
const resultados = [];
const sesion = (f, kg) => `---\nfecha: ${f}\ntitulo: Prueba\ntipo: empuje\nconfianza: alta\n---\n# ${f}\n\n## Ejercicios\n\n### Press banca\n<!-- id: press-banca -->\n| # | tipo | carga | reps | rpe | rir | nota |\n|---|---|---|---|---|---|---|\n| 1 | trabajo | ${kg} kg | 5 | 8 | | |\n`;
try {
  if (await verse(readVersion(), 30000) === null) throw new Error("la página no llegó a cargar los datos");
  // 1) Cambios sueltos: una sesión nueva cada vez
  for (let i = 0; i < 4; i++) {
    await dormir(400 + Math.random() * 1200);
    guardar(carpeta, "directo", `@@@ sesion\n${sesion(`2026-10-${String(20 + i).padStart(2, "0")}`, 60 + i)}\n<details><summary>Original</summary>\n\nprueba ${i}\n\n</details>`);
    await derivarCarpeta(carpeta);
    publicar(carpeta);
    resultados.push(["sesión nueva", await verse(readVersion())]);
  }
  // 2) Un /refresh sintético de 3 lotes
  mkdirSync(join(carpeta, "CONTEXTO"), { recursive: true });
  writeFileSync(join(carpeta, "CONTEXTO", "prueba-web.txt"), ["05/07/2026 banca 5x70", "06/08/2026 banca 5x72", "07/09/2026 banca 5x74"].join("\n\n") + "\n");
  const { imp } = preparar(carpeta);
  resultados.push(["refresh: preparar", await verse(readVersion())]);
  for (const lote of imp.lotes) {
    ponerProceso(carpeta, { activo: true, fase: "normalizando", lote: lote.n, lotes_total: imp.lotes.length, pct: Math.round(((lote.n - 1) / imp.lotes.length) * 100), mensaje: `Normalizando · lote ${lote.n} de ${imp.lotes.length} (${lote.etiqueta})` });
    publicar(carpeta);
    resultados.push([`refresh: lote ${lote.n} empieza`, await verse(readVersion())]);
    await dormir(700);
    const e = imp.elementos[lote.ids[0]];
    const [d, m, a] = e.texto.slice(0, 10).split("/");
    guardar(carpeta, lote.n, `@@@ sesion elementos=${e.id}\n${sesion(`${a}-${m}-${d}`, 70 + lote.n)}`);
    await derivarCarpeta(carpeta);
    ponerProceso(carpeta, { pct: Math.round((lote.n / imp.lotes.length) * 100), mensaje: `Normalizando · lote ${lote.n} de ${imp.lotes.length} guardado` });
    publicar(carpeta);
    resultados.push([`refresh: lote ${lote.n} guardado`, await verse(readVersion())]);
  }
  await cerrar(carpeta);
  resultados.push(["refresh: cerrar", await verse(readVersion())]);
  await dormir(1500);
} catch (e) { console.log("ERROR:", e.message); }
finally {
  if (enWindows) {
    const ps = `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${marca}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
    try { execFileSync("powershell.exe", ["-NoProfile", "-Command", ps], { stdio: "ignore" }); } catch {}
  } else try { hijo.kill("SIGKILL"); } catch {}
  await dormir(1000);
  rmSync(perfil, { recursive: true, force: true });
}
for (const [q, t] of resultados) console.log(`${q.padEnd(28)} ${fmt(t)}`);
console.log("Banner visto en la página:\n  " + [...new Set(banners)].join("\n  "));
const max = Math.max(...resultados.map(([, t]) => (t === null ? Infinity : t)));
console.log(max <= 2000 ? `RESULTADO: OK (máximo ${fmt(max)})` : `RESULTADO: FALLA (máximo ${fmt(max)})`);
process.exit(0);
