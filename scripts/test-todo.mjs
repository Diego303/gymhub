// pnpm test:todo: todo lo automático, en orden, y se para en el primer fallo.
//   1-3. pnpm test con TZ=UTC (con cobertura), Europe/Madrid y America/Los_Angeles
//   4. lint (la web no hace peticiones de red y claude plugin validate, si está la CLI)
//   5. pnpm test:web (la prueba de siempre en Chromium y Firefox)
//   6. pnpm test:e2e (Playwright)   7. pnpm test:visual (capturas de referencia)
import { spawnSync, execFileSync } from "node:child_process";
const hayClaude = (() => { try { execFileSync("claude", ["--version"], { stdio: "ignore" }); return true; } catch { return false; } })();
const pasos = [
  ["unitarias · TZ=UTC (con cobertura)", process.execPath, ["scripts/test.mjs", "--cobertura"], { TZ: "UTC" }],
  ["unitarias · TZ=Europe/Madrid", process.execPath, ["scripts/test.mjs"], { TZ: "Europe/Madrid" }],
  ["unitarias · TZ=America/Los_Angeles", process.execPath, ["scripts/test.mjs"], { TZ: "America/Los_Angeles" }],
  ["lint: la web sin peticiones de red", process.execPath, ["scripts/comprobar-web.mjs"], {}],
  ...(hayClaude ? [["lint: claude plugin validate", "claude", ["plugin", "validate", "."], {}]] : []),
  ["test:web (Chromium y Firefox)", process.execPath, ["scripts/test-web.mjs"], {}],
  ["test:e2e", "pnpm", ["exec", "playwright", "test", "--project=e2e"], {}],
  ["test:visual", "pnpm", ["exec", "playwright", "test", "--project=visual"], {}],
];
const t0 = Date.now(), hechos = [];
for (const [nombre, prog, args, env] of pasos) {
  console.log(`\n━━ ${nombre}`);
  const t = Date.now();
  const r = spawnSync(prog, args, { stdio: "inherit", env: { ...process.env, ...env } });
  hechos.push(`${r.status === 0 ? "✔" : "✖"} ${nombre} (${Math.round((Date.now() - t) / 1000)} s)`);
  if (r.status !== 0) { console.log(`\n${hechos.join("\n")}\n\nFALLA: ${nombre}`); process.exit(r.status ?? 1); }
}
console.log(`\n${hechos.join("\n")}\n\nTODO EN VERDE en ${Math.round((Date.now() - t0) / 1000)} s`);
