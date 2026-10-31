#!/usr/bin/env node
// Sonda F0: publica una versión nueva de datos.js junto a prueba.html y, la primera vez
// (o con el argumento "abrir"), abre la página en el navegador.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { publicar, preparar } from "../../web/generar.mjs";

const esWSL = () => !!process.env.WSL_DISTRO_NAME || (existsSync("/proc/version") && /microsoft/i.test(readFileSync("/proc/version", "utf8")));
const hay = (prog) => { try { execFileSync("sh", ["-c", `command -v ${prog}`], { stdio: "ignore" }); return true; } catch { return false; } };
function carpetaPorDefecto() {
  if (process.env.GYMHUB_SONDA_DIR) return process.env.GYMHUB_SONDA_DIR;
  if (esWSL()) {
    const w = execFileSync("cmd.exe", ["/d", "/c", "echo %LOCALAPPDATA%"], { cwd: "/mnt/c", stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    return join(execFileSync("wslpath", ["-u", w]).toString().trim(), "Temp", "gymhub-sonda");
  }
  return join(tmpdir(), "gymhub-sonda");
}
function abrir(ruta) {
  if (process.env.GYMHUB_NO_ABRIR === "1") return "sin abrir (GYMHUB_NO_ABRIR=1)";
  let prog, args;
  if (esWSL()) {
    if (hay("wslview")) { prog = "wslview"; args = [ruta]; }
    else { prog = "explorer.exe"; args = [execFileSync("wslpath", ["-w", ruta]).toString().trim()]; }
  } else if (process.platform === "darwin") { prog = "open"; args = [ruta]; }
  else { prog = "xdg-open"; args = [ruta]; }
  // explorer.exe devuelve 1 aunque abra bien: no se mira el código de salida.
  spawn(prog, args, { detached: true, stdio: "ignore", cwd: esWSL() ? "/mnt/c" : undefined }).unref();
  return `abierta con ${prog}`;
}
const dir = carpetaPorDefecto();
mkdirSync(dir, { recursive: true });
const primera = !existsSync(join(dir, "prueba.html"));
const html = preparar(dir);
let v = 1;
try { v = Number(readFileSync(join(dir, "version.js"), "utf8").match(/"(\d+)"/)[1]) + 1; } catch {}
publicar(dir, v);
const abierta = primera || process.argv.includes("abrir") ? abrir(html) : "no se abre de nuevo (pasa «abrir» para otra pestaña)";
console.log(`versión ${v} publicada en ${html} · ${abierta}`);
