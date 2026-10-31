// Ejecuta node --test con la lista explícita de tests (vale en Node 20, que no admite globs).
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const buscar = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  if (statSync(p).isDirectory()) return n === "fixtures" || n === "sonda" || n.startsWith(".") ? [] : buscar(p);
  return n.endsWith(".test.mjs") ? [p] : [];
});
const filtro = process.argv.slice(2);
const ficheros = buscar("tests").filter((f) => !filtro.length || filtro.some((x) => f.includes(x))).sort();
const r = spawnSync(process.execPath, ["--test", "--test-reporter=spec", ...ficheros], { stdio: "inherit" });
process.exit(r.status ?? 1);
