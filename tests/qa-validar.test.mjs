// G7 · pnpm qa:validar con una carpeta inventada: encuentra cada tipo de problema, no escribe en el
// original y el informe no lleva notas, títulos ni pesos (solo recuentos y fichero:línea).
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { temporal, cli, RAIZ } from "./ayuda.mjs";

const CAB = "| # | tipo | carga | reps | rpe | rir | nota |\n|---|---|---|---|---|---|---|";
const ses = (fecha, filas, { id = "press-banca", notas = "", extra = "" } = {}) => `---\nfecha: ${fecha}\ntitulo: Título secreto\nconfianza: alta\n${extra}---\n## Ejercicios\n### X\n<!-- id: ${id} -->\n${CAB}\n${filas.map((f, i) => `| ${i + 1} | trabajo | ${f} | 5 | | | |`).join("\n")}\n\n## Notas\n${notas}\n`;
const huella = (dir) => { const o = {}; const r = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) r(p); else o[relative(dir, p)] = createHash("sha256").update(readFileSync(p)).digest("hex"); } }; r(dir); return o; };

test("qa:validar encuentra cada tipo de problema, no toca el original y no imprime datos personales", () => {
  const t = temporal();
  try {
    const g = join(t.dir, "Mis datos");
    cli(t.dir, ["configurar", g]);
    const w = (a, f, texto) => { mkdirSync(join(g, "sesiones", a), { recursive: true }); writeFileSync(join(g, "sesiones", a, f), texto); };
    w("2026", "2026-01-05.md", ses("2026-01-05", ["100 kg"], { notas: "Nota muy privada de la persona" }));
    w("2026", "2026-01-07.md", ses("2026-01-07", ["140 kg"]));                                 // salto del 40 %
    w("2026", "2026-01-09.md", ses("2026-01-09", ["300 lb"]));                                 // kg y lb mezclados (300 lb = 136 kg)
    w("2026", "2026-01-12.md", ses("2026-01-12", ["100 kg"], { id: "press-inventado" }));    // fuera del catálogo
    w("2026", "2026-01-14.md", ses("2026-01-14", ["ochenta"]));                                // error de formato (línea 11)
    w("2026", "2026-01-16.md", ses("2026-01-16", ["140 kg"]));
    w("2026", "2026-01-16-2.md", ses("2026-01-16", ["140 kg"]));                               // duplicada
    w("2026", "2026-01-19.md", ses("2026-01-19", ["140 kg"]).replace("## Notas", "Texto suelto bajo la tabla\n\n## Notas")); // línea no reconocida
    w("1985", "1985-05-05.md", ses("1985-05-05", ["60 kg"], { id: "sentadilla" }));           // fecha rara
    const antes = huella(g);
    const r = spawnSync(process.execPath, [join(RAIZ, "scripts/qa-validar.mjs"), "--datos", g], { encoding: "utf8", env: { ...process.env, GYMHUB_HOY: "2026-02-01" } });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const o = r.stdout;
    for (const re of [/Sesiones: 9 ficheros · 7 válidas · 2 con errores/, /Errores de formato: 2\n\s+sesiones\/2026\/2026-01-12\.md:7\n\s+sesiones\/2026\/2026-01-14\.md:11/,
      /Ejercicios fuera del catálogo: 1\n\s+press-inventado: 1 vez\/veces · sesiones\/2026\/2026-01-12\.md:7/, /líneas no reconocidas[^:]*: 1\n\s+sesiones\/2026\/2026-01-19\.md \(1\)/,
      /Fechas raras \(antes de 1990 o futuras\): 1\n\s+sesiones\/1985\/1985-05-05\.md:2/, /duplicadas[^:]*: 1\n\s+sesiones\/2026\/2026-01-16\.md = sesiones\/2026\/2026-01-16-2\.md/,
      /Saltos de carga de más del 30 %[^:]*: 1\n\s+sesiones\/2026\/2026-01-07\.md:7 \(press-banca, frente a sesiones\/2026\/2026-01-05\.md\)/,
      /kg y en lb: 1\n\s+press-banca \(5 en kg, 1 en lb\)/, /Original: intacto ✔/]) assert.match(o, re);
    assert.doesNotMatch(o, /Nota muy privada|Título secreto|140|300 lb|100 kg/, "sin notas, títulos ni pesos");
    assert.deepEqual(huella(g), antes, "el original no cambia");
    // Una ruta que no es de gymhub
    assert.equal(spawnSync(process.execPath, [join(RAIZ, "scripts/qa-validar.mjs"), "--datos", t.dir], { encoding: "utf8" }).status, 2);
  } finally { t.limpiar(); }
});
