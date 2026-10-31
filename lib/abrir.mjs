// Abre un fichero local en el navegador: wslview o explorer.exe en WSL, open en macOS, xdg-open en Linux.
import { execFileSync, spawn } from "node:child_process";
import { esWSL } from "./config.mjs";

const hay = (prog) => {
  try { execFileSync("sh", ["-c", `command -v "${prog}"`], { stdio: "ignore" }); return true; } catch { return false; }
};

/** Devuelve un texto con lo que hizo. Con GYMHUB_NO_ABRIR=1 no abre nada. */
export function abrirEnNavegador(ruta) {
  if (process.env.GYMHUB_NO_ABRIR === "1") return { abierta: false, texto: "sin abrir (GYMHUB_NO_ABRIR=1)" };
  let prog, args, cwd;
  if (esWSL()) {
    if (hay("wslview")) { prog = "wslview"; args = [ruta]; }
    else {
      prog = "explorer.exe";
      args = [execFileSync("wslpath", ["-w", ruta]).toString().trim()];
      cwd = "/mnt/c"; // evita el aviso de rutas UNC si la sesión está dentro de WSL
    }
  } else if (process.platform === "darwin") { prog = "open"; args = [ruta]; }
  else if (process.platform === "win32") { prog = "cmd"; args = ["/c", "start", "", ruta]; }
  else { prog = "xdg-open"; args = [ruta]; }
  try {
    // explorer.exe devuelve 1 aunque abra bien: no se espera ni se mira el código.
    spawn(prog, args, { detached: true, stdio: "ignore", cwd }).unref();
    return { abierta: true, texto: `abierta con ${prog}` };
  } catch (e) {
    return { abierta: false, texto: `no se pudo abrir (${e.message}). Ábrela a mano: ${ruta}` };
  }
}
