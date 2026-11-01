// Cerrojo simple con mkdir (atómico) para que dos procesos no escriban a la vez en .gymhub/.
// Dentro va el pid de quien lo tiene: si ese proceso ya no existe (lo mataron a mitad), el cerrojo
// se quita en el acto en lugar de bloquear las órdenes siguientes.
import { mkdirSync, rmSync, statSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dormir = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/** ¿Sigue vivo el proceso? (EPERM: existe, pero es de otro usuario) */
const vivo = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === "EPERM"; } };

/** El cerrojo es de un proceso que ya no existe. Sin pid (recién creado o de una versión anterior): solo si es viejo. */
function huerfano(ruta, caducaMs) {
  let pid = null;
  try { pid = Number(readFileSync(join(ruta, "pid"), "utf8")); } catch { /* todavía sin pid */ }
  if (pid > 0) return !vivo(pid);
  try { return Date.now() - statSync(ruta).mtimeMs > Math.min(caducaMs, 30000); } catch { return false; }
}

export function conCerrojo(dirGymhub, fn, { esperaMs = 60000, caducaMs = 10 * 60000 } = {}) {
  mkdirSync(dirGymhub, { recursive: true });
  const ruta = join(dirGymhub, "cerrojo");
  const t0 = Date.now();
  for (;;) {
    try { mkdirSync(ruta); writeFileSync(join(ruta, "pid"), String(process.pid)); break; } catch (e) {
      if (e.code !== "EEXIST") throw e;
      try {
        if (huerfano(ruta, caducaMs) || Date.now() - statSync(ruta).mtimeMs > caducaMs) { rmSync(ruta, { recursive: true, force: true }); continue; }
      } catch { continue; }
      if (Date.now() - t0 > esperaMs) throw new Error("otra orden de gymhub está escribiendo; inténtalo en un momento");
      dormir(150);
    }
  }
  try { return fn(); } finally { rmSync(ruta, { recursive: true, force: true }); }
}
