// Captura una página local con Edge o Chrome sin ventana (WSL → Windows) o con el Chromium de
// Playwright en Linux.  node scripts/captura.mjs <fichero.html[#ancla]> <salida.png> [ancho] [alto] [--oscuro] [--navegador edge|chrome|linux]
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, mkdtempSync, rmSync, copyFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
const args = process.argv.slice(2);
const [pagina, salida, ancho = "1200", alto = "1400"] = args.filter((a) => !a.startsWith("--") && !["edge", "chrome", "linux"].includes(a));
const nav = args.includes("--navegador") ? args[args.indexOf("--navegador") + 1] : "edge";
const [fichero, ancla = ""] = pagina.split("#");
const abs = resolve(fichero);
const esWin = nav !== "linux";
const winpath = (p) => execFileSync("wslpath", ["-w", p]).toString().trim();
let exe;
if (nav === "edge") exe = "/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
else if (nav === "chrome") exe = "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe";
else { const b = join(process.env.HOME, ".cache/ms-playwright"); const d = readdirSync(b).filter((x) => x.startsWith("chromium_headless_shell-")).sort().at(-1); exe = join(b, d, "chrome-headless-shell-linux64/chrome-headless-shell"); }
const url = esWin ? (() => { const w = winpath(abs); return (w.startsWith("\\\\") ? "file:" : "file:///") + w.replaceAll("\\", "/"); })() : "file://" + abs;
// La captura se escribe primero en una carpeta temporal de Windows (el .exe no ve /tmp de WSL)
const tmp = esWin ? mkdtempSync("/mnt/c/Users/" + execFileSync("cmd.exe", ["/d", "/c", "echo %USERNAME%"], { cwd: "/mnt/c" }).toString().trim() + "/AppData/Local/Temp/gymhub-captura-") : mkdtempSync(join(tmpdir(), "gymhub-captura-"));
const png = join(tmp, "c.png");
const perfil = join(tmp, "perfil");
const r = spawnSync(exe, ["--headless=new", "--disable-gpu", "--no-first-run", "--hide-scrollbars", `--user-data-dir=${esWin ? winpath(perfil) : perfil}`, `--window-size=${ancho},${alto}`,
  "--virtual-time-budget=6000", ...(args.includes("--oscuro") ? ["--force-dark-mode", "--blink-settings=preferredColorScheme=0"] : ["--blink-settings=preferredColorScheme=1"]),
  `--screenshot=${esWin ? winpath(png) : png}`, url + (ancla ? "#" + ancla : "")], { encoding: "utf8", timeout: 60000 });
if (!existsSync(png)) { console.error("No se generó la captura", r.stderr?.slice(-500)); process.exit(1); }
copyFileSync(png, salida);
rmSync(tmp, { recursive: true, force: true });
console.log(`captura: ${salida}`);
