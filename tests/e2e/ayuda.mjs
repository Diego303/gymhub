// Ayudas de los e2e de la web: una carpeta de gymhub temporal con datos inventados, publicada con el
// script de verdad, y la URL file:// de su dashboard.html.
import { mkdtempSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BIN = join(RAIZ, "bin", "gymhub.mjs");

/** Las librerías NSPR/NSS que trae el Firefox de la caché de Playwright (el Chromium de la caché las necesita). */
export function libsNavegador() {
  const b = join(process.env.HOME ?? "", ".cache/ms-playwright");
  try { const d = readdirSync(b).filter((x) => x.startsWith("firefox-")).sort().at(-1); return d ? join(b, d, "firefox") : ""; } catch { return ""; }
}

/**
 * Crea una carpeta de gymhub en os.tmpdir() (con su propia config), deja que `preparar(carpeta)`
 * escriba los datos y la publica. `hoy` fija la fecha de los cálculos (GYMHUB_HOY).
 */
export function carpetaWeb({ preparar = () => {}, hoy = "2026-11-05" } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "gymhub-e2e-"));
  const carpeta = join(dir, "GIMNASIO");
  const env = { ...process.env, GYMHUB_CONFIG: join(dir, "config.json"), GYMHUB_HOY: hoy, GYMHUB_NO_ABRIR: "1", GYMHUB_CARPETA: "" };
  const cli = (...args) => {
    const r = spawnSync(process.execPath, [BIN, ...args, "--carpeta", carpeta], { env, encoding: "utf8", input: "" });
    if (r.status !== 0) throw new Error(`gymhub ${args.join(" ")}: ${r.stdout}${r.stderr}`);
    return r.stdout;
  };
  const c = spawnSync(process.execPath, [BIN, "configurar", carpeta], { env, encoding: "utf8" });
  if (c.status !== 0) throw new Error(c.stdout + c.stderr);
  preparar(carpeta);
  cli("publicar");
  return {
    dir, carpeta, env, cli,
    url: `file://${join(carpeta, ".gymhub", "web", "dashboard.html")}`,
    publicar: () => cli("publicar"),
    limpiar: () => rmSync(dir, { recursive: true, force: true }),
  };
}
