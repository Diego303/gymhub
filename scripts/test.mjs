// Ejecuta node --test con la lista explícita de tests (vale en Node 20, que no admite globs).
//   node scripts/test.mjs [filtro…] [--cobertura]   (--cobertura: cobertura de lib/ con la del propio Node)
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const buscar = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  if (statSync(p).isDirectory()) return n === "fixtures" || n === "sonda" || n === "e2e" || n.startsWith(".") ? [] : buscar(p);
  return n.endsWith(".test.mjs") ? [p] : [];
});
const args = process.argv.slice(2);
const cobertura = args.includes("--cobertura");
const filtro = args.filter((a) => !a.startsWith("--"));
const ficheros = buscar("tests").filter((f) => !filtro.length || filtro.some((x) => f.includes(x))).sort();
const opciones = cobertura ? ["--experimental-test-coverage", "--test-coverage-include=lib/**"] : [];
const r = spawnSync(process.execPath, ["--test", "--test-reporter=spec", ...opciones, ...ficheros], { stdio: "inherit" });
process.exit(r.status ?? 1);
