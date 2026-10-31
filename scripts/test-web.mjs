// pnpm test:web: crea una demo sintética temporal y prueba la web en Chromium y Firefox (Playwright).
// Con --edge, además mide en Edge de Windows (WSL) la recarga en vivo y un /refresh lote a lote.
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync, execFileSync } from "node:child_process";
const edge = process.argv.includes("--edge");
let base;
if (edge) {
  const usuario = execFileSync("cmd.exe", ["/d", "/c", "echo %USERNAME%"], { cwd: "/mnt/c" }).toString().trim();
  base = mkdtempSync(`/mnt/c/Users/${usuario}/AppData/Local/Temp/gymhub-test-web-`);
} else base = mkdtempSync(join(tmpdir(), "gymhub-test-web-"));
const env = { ...process.env, GYMHUB_CONFIG: join(base, "config.json"), GYMHUB_HOY: "2026-10-31", GYMHUB_NO_ABRIR: "1" };
const correr = (args) => spawnSync(process.execPath, args, { stdio: "inherit", env }).status;
let estado = correr(["scripts/demo.mjs", join(base, "GIMNASIO")]);
if (!estado) estado = correr(["tests/web/interaccion.mjs", join(base, "GIMNASIO")]);
if (!estado && edge) estado = correr(["tests/web/medir-web.mjs", join(base, "GIMNASIO"), "edge"]);
rmSync(base, { recursive: true, force: true });
process.exit(estado);
