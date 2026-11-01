// Abre un fichero local en el navegador: wslview o explorer.exe en WSL, open en macOS, xdg-open en Linux.
// Si no hay con qué abrirlo, no rompe la orden: devuelve la ruta para abrirla a mano.
import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { esWSL } from "./config.mjs";

const hay = (prog) => {
  try { execFileSync("sh", ["-c", `command -v "${prog}"`], { stdio: "ignore" }); return true; } catch { return false; }
};
const aMano = (motivo, ruta) => ({ abierta: false, texto: `no se pudo abrir el navegador (${motivo}). Ábrela a mano: ${ruta}` });

/** Devuelve { abierta, texto } con lo que hizo. Con GYMHUB_NO_ABRIR=1 no abre nada. */
export function abrirEnNavegador(ruta) {
  if (process.env.GYMHUB_NO_ABRIR === "1") return { abierta: false, texto: "sin abrir (GYMHUB_NO_ABRIR=1)" };
  let prog, args, cwd;
  if (esWSL()) {
    if (hay("wslview")) { prog = "wslview"; args = [ruta]; }
    else {
      if (!hay("explorer.exe")) return aMano("no hay wslview ni explorer.exe", ruta);
      let win;
      try { win = execFileSync("wslpath", ["-w", ruta], { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { return aMano("wslpath no ha podido traducir la ruta", ruta); }
      prog = "explorer.exe";
      args = [win];
      cwd = existsSync("/mnt/c") ? "/mnt/c" : undefined; // evita el aviso de rutas UNC si la sesión está dentro de WSL
    }
  } else if (process.platform === "darwin") { prog = "open"; args = [ruta]; }
  else if (process.platform === "win32") { prog = "cmd"; args = ["/c", "start", "", ruta]; }
  else { prog = "xdg-open"; args = [ruta]; }
  if (process.platform !== "win32" && !hay(prog)) return aMano(`no hay ${prog}`, ruta);
  try {
    // explorer.exe devuelve 1 aunque abra bien: no se espera ni se mira el código. Un fallo al lanzar
    // llega como evento «error»: se escucha para que no tumbe la orden.
    const p = spawn(prog, args, { detached: true, stdio: "ignore", cwd });
    p.on("error", () => {});
    p.unref();
    return { abierta: true, texto: `abierta con ${prog}` };
  } catch (e) {
    return aMano(e.message, ruta);
  }
}
