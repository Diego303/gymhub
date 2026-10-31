// Cerrojo simple con mkdir (atómico) para que dos procesos no escriban a la vez en .gymhub/.
import { mkdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

const dormir = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

export function conCerrojo(dirGymhub, fn, { esperaMs = 60000, caducaMs = 10 * 60000 } = {}) {
  mkdirSync(dirGymhub, { recursive: true });
  const ruta = join(dirGymhub, "cerrojo");
  const t0 = Date.now();
  for (;;) {
    try { mkdirSync(ruta); break; } catch (e) {
      if (e.code !== "EEXIST") throw e;
      try { if (Date.now() - statSync(ruta).mtimeMs > caducaMs) { rmSync(ruta, { recursive: true, force: true }); continue; } } catch { continue; }
      if (Date.now() - t0 > esperaMs) throw new Error("otra orden de gymhub está escribiendo; inténtalo en un momento");
      dormir(150);
    }
  }
  try { return fn(); } finally { rmSync(ruta, { recursive: true, force: true }); }
}
