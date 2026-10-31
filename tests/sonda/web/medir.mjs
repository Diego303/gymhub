// Mide cuánto tarda una página abierta con file:// en ver un datos.js nuevo, sin recargar.
// Uso: node medir.mjs <edge|chrome|firefox> <carpeta en WSL> [rondas]
// El navegador se abre sin ventana, con un perfil temporal propio, y se lee su consola.
// Todas las horas son del reloj de WSL: no se compara con el de Windows.
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { publicar, preparar } from "./generar.mjs";

const [navegador, dir, rondasTxt = "6"] = process.argv.slice(2);
const rondas = Number(rondasTxt);
// Rutas por defecto (WSL + instalación estándar de Windows); se cambian con GYMHUB_EDGE,
// GYMHUB_CHROME y GYMHUB_FIREFOX. Firefox: el de Windows si existe; si no, el de Playwright.
const primero = (...rutas) => rutas.find((r) => r && existsSync(r)) ?? rutas.at(-1);
const playwrightFirefox = () => {
  const base = join(process.env.HOME ?? "", ".cache/ms-playwright");
  const dirs = existsSync(base) ? readdirSync(base).filter((d) => d.startsWith("firefox-")).sort() : [];
  return dirs.length ? join(base, dirs.at(-1), "firefox/firefox") : undefined;
};
const EXE = {
  edge: primero(process.env.GYMHUB_EDGE, "/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/mnt/c/Program Files/Microsoft/Edge/Application/msedge.exe"),
  chrome: primero(process.env.GYMHUB_CHROME, "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe"),
  firefox: primero(process.env.GYMHUB_FIREFOX, "/mnt/c/Program Files/Mozilla Firefox/firefox.exe", playwrightFirefox()),
};
const esWindows = (exe) => exe.startsWith("/mnt/") && exe.endsWith(".exe");
const winpath = (p) => execFileSync("wslpath", ["-w", p]).toString().trim();
const marca = `gymhub-f0-perfil-${navegador}-${process.pid}`;

mkdirSync(dir, { recursive: true });
const html = preparar(dir);
publicar(dir, "1");

let url, args;
const perfil = join(dir, marca);
mkdirSync(perfil, { recursive: true });
const enWindows = esWindows(EXE[navegador]);
// Ruta del fichero tal como la ve el navegador: la de Windows (C:\…, o \\wsl.localhost\… si
// la carpeta está dentro de WSL) para un .exe, y la de Linux para un navegador de Linux.
const aUrl = (p) => {
  if (!enWindows) return "file://" + p;
  const w = winpath(p);
  return w.startsWith("\\\\") ? "file:" + w.replaceAll("\\", "/") : "file:///" + w.replaceAll("\\", "/");
};
url = aUrl(html);
if (navegador === "firefox") {
  // console.log de la página a la salida estándar.
  writeFileSync(join(perfil, "user.js"), [
    'user_pref("devtools.console.stdout.content", true);',
    'user_pref("browser.shell.checkDefaultBrowser", false);',
    'user_pref("datareporting.policy.dataSubmissionEnabled", false);',
    'user_pref("toolkit.telemetry.reportingpolicy.firstRun", false);',
  ].join("\n"));
  args = ["-headless", "-no-remote", "-profile", enWindows ? winpath(perfil) : perfil, url];
} else {
  // Chromium escribe la consola de la página en stderr con --enable-logging=stderr.
  args = ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    "--disable-extensions", `--user-data-dir=${winpath(perfil)}`, "--enable-logging=stderr", "--v=0", url];
}
console.log(`# ${navegador} · ${url}`);

const hijo = spawn(EXE[navegador], args, { stdio: ["ignore", "pipe", "pipe"] });
const esperas = new Map(); // versión → { t0, resolver }
const vistas = [];
const errores = [];
const leer = (flujo) => createInterface({ input: flujo }).on("line", (l) => {
  const m = l.match(/GYMHUB-F0 ([^"\s]+)/);
  if (!m) return;
  const ahora = performance.now();
  if (m[1].startsWith("v=")) {
    const v = m[1].slice(2);
    vistas.push(v);
    const e = esperas.get(v);
    if (e) { e.resolver(ahora - e.t0); esperas.delete(v); }
  } else errores.push(m[1]);
});
leer(hijo.stdout); leer(hijo.stderr);

const esperarVersion = (v, limite = 8000) => new Promise((resolver) => {
  const t0 = performance.now();
  esperas.set(v, { t0, resolver });
  setTimeout(() => { if (esperas.has(v)) { esperas.delete(v); resolver(null); } }, limite);
});
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function principal() {
  // La primera carga incluye el arranque del navegador.
  const t = await esperarVersion("1", 30000);
  if (t === null) throw new Error("la página no llegó a leer datos.js (¿no hay consola?)");
  const resultados = { normal: [], activo: [] };
  let v = 1;
  for (const modo of ["normal", "activo"]) {
    for (let i = 0; i < rondas; i++) {
      await dormir(300 + Math.random() * 1700);
      v++;
      const promesa = esperarVersion(String(v));
      publicar(dir, v, modo === "activo");
      resultados[modo].push(await promesa);
    }
  }
  // Fichero a medio escribir (sin rename): la página debe conservar la última versión buena.
  await dormir(500);
  writeFileSync(join(dir, "datos.js"), 'window.GYMHUB = {"version":"roto",');
  writeFileSync(join(dir, "version.js"), 'window.GYMHUB_VERSION = "roto";');
  await dormir(2600);
  const vioRoto = vistas.includes("roto");
  v++;
  const promesa = esperarVersion(String(v));
  publicar(dir, v);
  const recupera = await promesa;
  // Fichero que desaparece un momento (carpeta movida): aviso y recuperación.
  rmSync(join(dir, "datos.js")); rmSync(join(dir, "version.js"));
  await dormir(2600);
  v++;
  const p2 = esperarVersion(String(v));
  publicar(dir, v);
  const recupera2 = await p2;
  return { resultados, vioRoto, recupera, recupera2 };
}

function matar() {
  if (!esWindows(EXE[navegador])) { try { hijo.kill("SIGKILL"); } catch {} return; }
  const imagen = { edge: "msedge.exe", chrome: "chrome.exe", firefox: "firefox.exe" }[navegador];
  const ps = `Get-CimInstance Win32_Process -Filter "Name='${imagen}'" | Where-Object { $_.CommandLine -like '*${marca}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
  try { execFileSync("powershell.exe", ["-NoProfile", "-Command", ps], { stdio: "ignore" }); } catch {}
  try { hijo.kill(); } catch {}
}

const fmt = (xs) => xs.map((x) => (x === null ? "NO LLEGÓ" : (x / 1000).toFixed(2) + " s")).join(", ");
try {
  const r = await principal();
  const todos = [...r.resultados.normal, ...r.resultados.activo];
  const max = (xs) => Math.max(...xs.map((x) => (x === null ? Infinity : x)));
  console.log(`normal (latido 1 s): ${fmt(r.resultados.normal)} · máx ${(max(r.resultados.normal) / 1000).toFixed(2)} s`);
  console.log(`activo (latido 0,5 s): ${fmt(r.resultados.activo)} · máx ${(max(r.resultados.activo) / 1000).toFixed(2)} s`);
  console.log(`fichero roto: ${r.vioRoto ? "LO PINTÓ (mal)" : "ignorado, conserva la última"} · avisos: ${[...new Set(errores)].join(", ") || "ninguno"} · recupera en ${fmt([r.recupera])}`);
  console.log(`fichero ausente: recupera en ${fmt([r.recupera2])}`);
  console.log(todos.every((x) => x !== null && x <= 2100) ? "RESULTADO: OK (≤ 2 s)" : "RESULTADO: FALLA");
} catch (e) {
  console.log("ERROR:", e.message);
} finally {
  matar();
  await dormir(1500);
  try { rmSync(perfil, { recursive: true, force: true }); } catch {}
  process.exit(0);
}
