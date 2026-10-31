// Ayudas para los tests: carpetas temporales y ejecutar el CLI con una config aislada.
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
export const BIN = join(RAIZ, "bin", "gymhub.mjs");

export function temporal(prefijo = "gymhub-test-") {
  const dir = mkdtempSync(join(tmpdir(), prefijo));
  return { dir, limpiar: () => rmSync(dir, { recursive: true, force: true }) };
}

/** Ejecuta bin/gymhub.mjs con GYMHUB_CONFIG en `dir` y sin abrir el navegador. */
export function cli(dir, args, { entrada, env = {}, cwd } = {}) {
  mkdirSync(dir, { recursive: true });
  const r = spawnSync(process.execPath, [BIN, ...args], {
    input: entrada, encoding: "utf8", cwd,
    env: { ...process.env, GYMHUB_CONFIG: join(dir, "config.json"), GYMHUB_NO_ABRIR: "1", GYMHUB_CARPETA: "", ...env },
  });
  return { codigo: r.status, salida: r.stdout, error: r.stderr };
}
