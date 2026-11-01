// G4 · Abrir la web desde WSL: wslview, explorer.exe + wslpath -w, y el fallo de los dos (mensaje con
// la ruta, sin romper la orden). Se prueba con programas falsos en un PATH controlado.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, chmodSync, readFileSync, existsSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { temporal, RAIZ } from "./ayuda.mjs";

/** Un PATH con solo `sh` y los programas falsos pedidos (cada uno apunta sus argumentos en log-<nombre>). */
function entorno(dir, programas) {
  const bin = join(dir, "bin");
  mkdirSync(bin, { recursive: true });
  for (const p of ["sh", "sleep"]) symlinkSync(execFileSync("sh", ["-c", `command -v ${p}`]).toString().trim(), join(bin, p));
  for (const [nombre, cuerpo] of Object.entries(programas)) {
    writeFileSync(join(bin, nombre), `#!/bin/sh\nprintf '%s\\n' "$*" >> "${join(dir, `log-${nombre}`)}"\n${cuerpo}\n`);
    chmodSync(join(bin, nombre), 0o755);
  }
  return { PATH: bin, WSL_DISTRO_NAME: "Prueba", HOME: dir };
}
const abrir = (env, ruta = "/tmp/G/.gymhub/web/dashboard.html") => {
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", `const { abrirEnNavegador } = await import(${JSON.stringify(join(RAIZ, "lib/abrir.mjs"))}); console.log(JSON.stringify(abrirEnNavegador(${JSON.stringify(ruta)}))); await new Promise((r) => setTimeout(r, 400));`], { encoding: "utf8", env });
  return { codigo: r.status, ...JSON.parse(r.stdout.trim().split("\n")[0] || "{}"), error: r.stderr };
};
const log = (dir, p) => (existsSync(join(dir, `log-${p}`)) ? readFileSync(join(dir, `log-${p}`), "utf8").trim() : null);

test("WSL con wslview: lo usa con la ruta tal cual", () => {
  const t = temporal();
  try {
    const r = abrir(entorno(t.dir, { wslview: "", "explorer.exe": "", wslpath: "echo C:\\\\x" }));
    assert.deepEqual([r.codigo, r.abierta, r.texto], [0, true, "abierta con wslview"]);
    for (let i = 0; i < 20 && !log(t.dir, "wslview"); i++) spawnSync("sleep", ["0.05"]);
    assert.equal(log(t.dir, "wslview"), "/tmp/G/.gymhub/web/dashboard.html");
    assert.equal(log(t.dir, "explorer.exe"), null);
  } finally { t.limpiar(); }
});

test("WSL sin wslview: explorer.exe con la ruta de Windows que da wslpath -w", () => {
  const t = temporal();
  try {
    const r = abrir(entorno(t.dir, { "explorer.exe": "exit 1", wslpath: "printf '%s\\n' '\\\\wsl.localhost\\Prueba\\tmp\\G\\dashboard.html'" }));
    assert.deepEqual([r.codigo, r.abierta, r.texto], [0, true, "abierta con explorer.exe"], r.error);
    for (let i = 0; i < 20 && !log(t.dir, "explorer.exe"); i++) spawnSync("sleep", ["0.05"]);
    assert.equal(log(t.dir, "wslpath"), "-w /tmp/G/.gymhub/web/dashboard.html");
    assert.equal(log(t.dir, "explorer.exe"), "\\\\wsl.localhost\\Prueba\\tmp\\G\\dashboard.html");
  } finally { t.limpiar(); }
});

test("WSL sin wslview ni explorer.exe (o sin wslpath): no rompe la orden y da la ruta para abrirla a mano", () => {
  for (const programas of [{}, { wslpath: "echo C:\\\\x" }, { "explorer.exe": "" }]) {
    const t = temporal();
    try {
      const r = abrir(entorno(t.dir, programas));
      assert.equal(r.codigo, 0, `${JSON.stringify(programas)}: ${r.error}`);
      assert.equal(r.abierta, false, JSON.stringify(programas));
      assert.match(r.texto, /^no se pudo abrir el navegador .*Ábrela a mano: \/tmp\/G\/\.gymhub\/web\/dashboard\.html$/);
    } finally { t.limpiar(); }
  }
});
