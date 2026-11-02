// G2 · Las cifras son idénticas en UTC, Madrid y Los Ángeles, también los días de cambio de hora.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { RAIZ } from "./ayuda.mjs";

const ZONAS = ["UTC", "Europe/Madrid", "America/Los_Angeles", "Asia/Tokyo"];
const calcular = (tz, caso, hoy) => {
  const r = spawnSync(process.execPath, [join(RAIZ, "tests/fixtures/calcular-tz.mjs"), caso, hoy], { encoding: "utf8", env: { ...process.env, TZ: tz, GYMHUB_HOY: "" } });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
};

for (const [caso, hoy] of [["mini", "2026-11-05"], ["horario", "2026-03-29"], ["horario", "2026-03-08"], ["horario", "2026-10-25"], ["horario", "2026-11-01"], ["horario", "2026-11-03"], ["aleatorio", "2026-07-01"]]) {
  test(`mismas cifras en ${ZONAS.join(", ")}: ${caso}, hoy ${hoy}`, () => {
    const [ref, ...resto] = ZONAS.map((tz) => calcular(tz, caso, hoy));
    assert.ok(ref.length > 1000);
    resto.forEach((x, i) => assert.equal(x, ref, `${ZONAS[i + 1]} distinto de ${ZONAS[0]}`));
  });
}
