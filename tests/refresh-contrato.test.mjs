// G3 · Contrato de la normalización (sin IA): fixtures de «salida del modelo» buenas, mal formadas,
// truncadas, con ejercicios inventados y con fechas cambiadas. Lo inválido se rechaza con un informe
// claro y no se escribe nada (ni a medias); la carpeta queda byte a byte igual.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { createHash } from "node:crypto";
import { temporal, cli } from "./ayuda.mjs";
import { preparar, guardar, cerrar } from "../lib/refresh.mjs";
import { leerSesion } from "../lib/canonico.mjs";

let t, carpeta;
beforeEach(() => {
  t = temporal();
  carpeta = join(t.dir, "G");
  cli(t.dir, ["configurar", carpeta]);
  process.env.GYMHUB_CONFIG = join(t.dir, "config.json");
  process.env.GYMHUB_HOY = "2026-03-20";
});
afterEach(() => { t.limpiar(); delete process.env.GYMHUB_HOY; delete process.env.GYMHUB_CONFIG; });

/** Huella de toda la carpeta: ruta → hash del contenido. */
export function huella(dir) {
  const out = {};
  const rec = (d) => { for (const n of readdirSync(d).sort()) { const p = join(d, n); if (statSync(p).isDirectory()) rec(p); else out[relative(dir, p)] = createHash("sha256").update(readFileSync(p)).digest("hex").slice(0, 16); } };
  rec(dir);
  return out;
}
const sesion = (fecha, { id = "press-banca", carga = "80 kg", titulo = "Torso" } = {}) => `---\nfecha: ${fecha}\ntitulo: ${titulo}\ntipo: torso\nconfianza: alta\n---\n# ${fecha} · ${titulo}\n\n## Ejercicios\n\n### Press banca\n<!-- id: ${id} -->\n| # | tipo | carga | reps | rpe | rir | nota |\n|---|---|---|---|---|---|---|\n| 1 | trabajo | ${carga} | 5 | 8 | | |\n\n## Notas\nbien\n`;
function prepararDos() {
  writeFileSync(join(carpeta, "CONTEXTO", "notas.txt"), "12/03/2026\nbanca 5x80\n\n14/03/2026\nbanca 5x82\n");
  const { imp } = preparar(carpeta);
  const [a, b] = imp.lotes[0].ids;
  return { imp, a, b };
}

test("una salida buena se guarda entera y la segunda vez no cambia nada", () => {
  const { a, b } = prepararDos();
  const bueno = `@@@ sesion elementos=${a}\n${sesion("2026-03-12")}@@@ sesion elementos=${b}\n${sesion("2026-03-14", { carga: "82 kg" })}`;
  const r = guardar(carpeta, 1, bueno);
  assert.deepEqual(r.errores, []);
  assert.deepEqual(r.resultado.escritas, ["sesiones/2026/2026-03-12.md", "sesiones/2026/2026-03-14.md"]);
  assert.equal(leerSesion(readFileSync(join(carpeta, "sesiones/2026/2026-03-14.md"), "utf8")).ejercicios[0].series[0].carga.valor, 82);
  assert.match(guardar(carpeta, 1, bueno).errores[0], /el lote 1 ya está guardado/);
});

test("lo mal formado, truncado, inventado o a medias se rechaza con un informe claro y la carpeta no cambia", () => {
  const { a, b } = prepararDos();
  const casos = {
    "bloque desconocido": [`@@@ sesión-rara elementos=${a},${b}\n${sesion("2026-03-12")}`, /bloque desconocido «@@@ sesión» \(son: sesion, ignorar/],
    "sin elementos=": [`@@@ sesion\n${sesion("2026-03-12")}@@@ sesion elementos=${b}\n${sesion("2026-03-14")}`, /sesión 1 \(2026-03-12\): falta «elementos=…»/],
    "falta un elemento": [`@@@ sesion elementos=${a}\n${sesion("2026-03-12")}`, new RegExp(`faltan elementos del lote: ${b}`)],
    "elemento de otro lote": [`@@@ sesion elementos=${a},${b},zzzz999999\n${sesion("2026-03-12")}`, /el elemento zzzz999999 no es del lote 1/],
    "truncado en la tabla": [`@@@ sesion elementos=${a},${b}\n${sesion("2026-03-12").split("| 1 | trabajo")[0]}| 1 | trab`, /serie 1 \(línea 15\): tipo de serie desconocido «trab»/],
    "truncado en el frontmatter": [`@@@ sesion elementos=${a},${b}\n---\nfecha: 2026-03-12\ntitulo: Tor`, /falta el frontmatter/],
    "texto suelto antes del primer bloque": [`Aquí tienes el lote:\n@@@ sesion elementos=${a},${b}\n${sesion("2026-03-12")}`, /bloque desconocido «@@@ suelto»/],
    "ejercicio inventado": [`@@@ sesion elementos=${a},${b}\n${sesion("2026-03-12", { id: "press-banca-inventado" })}`, /el id «press-banca-inventado» no está en el catálogo/],
    "ejercicio nuevo mal descrito": [`@@@ ejercicios\n| press-raro | Press raro | | pechote | | barra | empuje-horizontal | no |\n@@@ sesion elementos=${a},${b}\n${sesion("2026-03-12", { id: "press-raro" })}`, /ejercicio nuevo: press-raro: grupo desconocido «pechote»/],
    "fecha imposible": [`@@@ sesion elementos=${a},${b}\n${sesion("2026-02-30")}`, /fecha imposible «2026-02-30»/],
    "fecha en el futuro": [`@@@ sesion elementos=${a},${b}\n${sesion("2027-03-12")}`, /fecha en el futuro «2027-03-12»/],
    "una buena y una mala (no se escribe la buena)": [`@@@ sesion elementos=${a}\n${sesion("2026-03-12")}@@@ sesion elementos=${b}\n${sesion("2026-03-14", { carga: "ochenta" })}`, /sesión 2 \(2026-03-14\): Press banca, serie 1 \(línea 15\): carga no válida «ochenta»/],
    "ignorar sin motivo": [`@@@ sesion elementos=${a}\n${sesion("2026-03-12")}@@@ ignorar elementos=${b}`, /falta «· motivo: …»/],
    "evento mal escrito": [`@@@ sesion elementos=${a},${b}\n${sesion("2026-03-12")}@@@ evento elementos=${a}\n- 2026-03-01 · vacaciones de verano`, /tipo de evento desconocido|línea de eventos no entendida/],
    "alias mal escrito": [`@@@ sesion elementos=${a},${b}\n${sesion("2026-03-12")}@@@ alias press banca: bench`, /alias mal escrito/],
    "vacío": ["", /faltan elementos del lote/],
  };
  const antes = huella(carpeta);
  for (const [nombre, [entrada, re]] of Object.entries(casos)) {
    const r = guardar(carpeta, 1, entrada);
    assert.ok(r.errores.length, `${nombre}: tenía que fallar`);
    assert.match(r.errores.join("\n"), re, nombre);
    assert.deepEqual(huella(carpeta), antes, `${nombre}: no se escribe nada`);
  }
  // Y por la línea de órdenes: «NO SE HA GUARDADO NADA» y código 2
  const r = cli(t.dir, ["refresh", "guardar", "1", "--carpeta", carpeta], { entrada: casos["ejercicio inventado"][0] });
  assert.equal(r.codigo, 2);
  assert.match(r.salida, /^NO SE HA GUARDADO NADA\. Corrige y vuelve a enviar el lote 1 completo:/);
  assert.deepEqual(huella(carpeta), antes);
});

test("fechas cambiadas: una sesión a más de 2 meses de la fecha de su elemento se guarda, pero queda en revision.md (FORMATO §3.2)", () => {
  const { a, b } = prepararDos();
  const r = guardar(carpeta, 1, `@@@ sesion elementos=${a}\n${sesion("2025-11-12")}@@@ sesion elementos=${b}\n${sesion("2026-03-14")}`);
  assert.deepEqual(r.errores, []);
  const rev = readFileSync(join(carpeta, "revision.md"), "utf8");
  assert.match(rev, /- \[ \] 2025-11-12 · la fecha de la sesión está a más de 2 meses de la de su origen \(2026-03-12\)/);
  assert.doesNotMatch(rev, /2026-03-14 · la fecha/);
});

test("refresh dos veces seguidas: la segunda no cambia nada salvo la hora del último refresh", async () => {
  const { a, b } = prepararDos();
  guardar(carpeta, 1, `@@@ sesion elementos=${a}\n${sesion("2026-03-12")}@@@ sesion elementos=${b}\n${sesion("2026-03-14")}`);
  await cerrar(carpeta);
  // Lo único que cambia a propósito es la hora del último refresh (que la web enseña) y el estado del proceso
  const sinTiempo = (h) => Object.fromEntries(Object.entries(h).filter(([k]) => !/\.gymhub\/(proceso|importacion|cache-sesiones|datos)\.json|datos\.js$|version\.js$/.test(k)));
  const datos = () => JSON.parse(readFileSync(join(carpeta, ".gymhub/datos.json"), "utf8"), (k, v) => (k === "ultimo_refresh" ? undefined : v));
  const antes = huella(carpeta), datosAntes = datos();
  const { imp } = preparar(carpeta);
  assert.equal(imp.lotes.length, 0);
  assert.deepEqual(sinTiempo(huella(carpeta)), sinTiempo(antes));
  assert.deepEqual(datos(), datosAntes);
});

test("idempotencia por hash: un fichero igual no se reprocesa, uno cambiado sí, y borrar lo procesado no cambia nada", async () => {
  const { a, b } = prepararDos();
  guardar(carpeta, 1, `@@@ sesion elementos=${a}\n${sesion("2026-03-12")}@@@ sesion elementos=${b}\n${sesion("2026-03-14", { carga: "82 kg" })}`);
  await cerrar(carpeta);
  const procesado = join(carpeta, "CONTEXTO", "procesado", "2026-03-20", "notas.txt");
  // El mismo fichero copiado otra vez: nada nuevo, y se archiva
  writeFileSync(join(carpeta, "CONTEXTO", "otra-copia.txt"), readFileSync(procesado, "utf8").replace(/\n/g, "  \n"));
  assert.equal(preparar(carpeta).imp.lotes.length, 0);
  assert.equal(existsSync(join(carpeta, "CONTEXTO", "otra-copia.txt")), false);
  // Cambiado (el 14 pasa a 85 kg): solo ese bloque es nuevo
  writeFileSync(join(carpeta, "CONTEXTO", "notas.txt"), "12/03/2026\nbanca 5x80\n\n14/03/2026\nbanca 5x85\n");
  const { imp } = preparar(carpeta);
  assert.equal(imp.lotes.length, 1);
  assert.deepEqual(Object.values(imp.elementos).map((e) => e.fecha_pista), ["2026-03-14"]);
  // Borrar CONTEXTO/procesado no toca el historial ni las cifras
  const { rmSync } = await import("node:fs");
  const antes = Object.fromEntries(Object.entries(huella(carpeta)).filter(([k]) => k.startsWith("sesiones/")));
  rmSync(join(carpeta, "CONTEXTO", "procesado"), { recursive: true, force: true });
  assert.equal(cli(t.dir, ["publicar", "--carpeta", carpeta]).codigo, 0);
  assert.deepEqual(Object.fromEntries(Object.entries(huella(carpeta)).filter(([k]) => k.startsWith("sesiones/"))), antes);
  assert.equal(JSON.parse(readFileSync(join(carpeta, ".gymhub/datos.json"), "utf8")).resumen.sesiones_total, 2);
});

test("lo editado a mano nunca se pisa: ni al reimportar lo mismo ni si cambia en CONTEXTO/ (va a -2 con su duda)", async () => {
  const { a, b } = prepararDos();
  guardar(carpeta, 1, `@@@ sesion elementos=${a}\n${sesion("2026-03-12")}@@@ sesion elementos=${b}\n${sesion("2026-03-14")}`);
  await cerrar(carpeta);
  const f = join(carpeta, "sesiones/2026/2026-03-14.md");
  const editada = readFileSync(f, "utf8").replace("bien", "bien (lo he corregido yo: eran 6 reps)").replace("| 5 | 8 |", "| 6 | 8 |");
  writeFileSync(f, editada);
  // 1) El mismo elemento vuelve a importarse (por ejemplo, si se pierde procesados.json)
  const { rmSync } = await import("node:fs");
  rmSync(join(carpeta, ".gymhub/procesados.json"));
  writeFileSync(join(carpeta, "CONTEXTO", "notas.txt"), "12/03/2026\nbanca 5x80\n\n14/03/2026\nbanca 5x82\n");
  let { imp } = preparar(carpeta);
  let ids = imp.lotes[0].ids;
  let r = guardar(carpeta, 1, `@@@ sesion elementos=${ids[0]}\n${sesion("2026-03-12")}@@@ sesion elementos=${ids[1]}\n${sesion("2026-03-14")}`);
  assert.deepEqual(r.errores, []);
  assert.equal(readFileSync(f, "utf8"), editada, "la editada no se toca");
  assert.deepEqual(r.resultado.omitidas, ["sesiones/2026/2026-03-12.md"], "la que no se editó y es igual se omite");
  assert.deepEqual(r.resultado.duplicadas, ["sesiones/2026/2026-03-14-2.md"]);
  await cerrar(carpeta);
  // 2) Editada a mano y cambiada en CONTEXTO/: tampoco se pisa
  writeFileSync(join(carpeta, "CONTEXTO", "notas-2.txt"), "14/03/2026\nbanca 5x90 (me equivoqué al apuntar)\n");
  ({ imp } = preparar(carpeta));
  ids = imp.lotes[0].ids;
  r = guardar(carpeta, 1, `@@@ sesion elementos=${ids[0]}\n${sesion("2026-03-14", { carga: "90 kg" })}`);
  assert.deepEqual(r.errores, []);
  assert.equal(readFileSync(f, "utf8"), editada);
  assert.deepEqual(r.resultado.duplicadas, ["sesiones/2026/2026-03-14-3.md"]);
  const rev = readFileSync(join(carpeta, "revision.md"), "utf8");
  assert.match(rev, /- \[ \] 2026-03-14 · ya había otra sesión ese día con contenido distinto → guardada como sesiones\/2026\/2026-03-14-2\.md\. ¿Son la misma\?/);
  assert.match(rev, /guardada como sesiones\/2026\/2026-03-14-3\.md/);
});
