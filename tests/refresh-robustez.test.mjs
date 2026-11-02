// G3 · Robustez de /refresh y de la escritura: ficheros ilegibles, enlaces rotos, binarios y
// enormes en CONTEXTO/, carpetas que no existen, cerrojos huérfanos y procesos matados a mitad.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, readFileSync, symlinkSync, chmodSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { temporal, cli } from "./ayuda.mjs";
import { preparar } from "../lib/refresh.mjs";
import { leerProceso } from "../lib/publicar.mjs";

let t, carpeta;
beforeEach(() => {
  t = temporal();
  carpeta = join(t.dir, "G");
  cli(t.dir, ["configurar", carpeta]);
  process.env.GYMHUB_CONFIG = join(t.dir, "config.json");
  process.env.GYMHUB_HOY = "2026-03-20";
});
afterEach(() => { try { chmodSync(join(carpeta, "CONTEXTO", "sin-permiso.txt"), 0o644); } catch { /* no estaba */ } t.limpiar(); delete process.env.GYMHUB_HOY; delete process.env.GYMHUB_CONFIG; });

const puedeQuitarPermisos = process.getuid?.() !== 0;

test("un fichero sin permiso o un enlace roto en CONTEXTO/ no tumban el /refresh: se avisa y se sigue", { skip: !puedeQuitarPermisos && "como root se puede leer todo" }, () => {
  writeFileSync(join(carpeta, "CONTEXTO", "bueno.txt"), "12/03/2026\nbanca 5x80\n");
  writeFileSync(join(carpeta, "CONTEXTO", "sin-permiso.txt"), "14/03/2026\nsentadilla 5x100\n");
  chmodSync(join(carpeta, "CONTEXTO", "sin-permiso.txt"), 0o000);
  symlinkSync(join(t.dir, "no-existe.txt"), join(carpeta, "CONTEXTO", "enlace-roto.txt"));
  const r = cli(t.dir, ["refresh", "preparar", "--carpeta", carpeta]);
  assert.equal(r.codigo, 0, r.salida + r.error);
  assert.match(r.salida, /1 elementos nuevos en 1 lotes/);
  assert.match(r.salida, /No se ha podido leer \(se queda en CONTEXTO\/\): CONTEXTO\/enlace-roto\.txt \(enlace roto\), CONTEXTO\/sin-permiso\.txt \(sin permiso de lectura\)/);
  // El banner de la web no se queda en «Separando…»
  assert.equal(leerProceso(carpeta).fase, "normalizando");
});

test("un CONTEXTO que no es una carpeta se avisa y la web no se queda en «Separando…»", async () => {
  const { rmSync } = await import("node:fs");
  const ctx = join(carpeta, "CONTEXTO");
  rmSync(ctx, { recursive: true, force: true });
  writeFileSync(ctx, "no soy una carpeta");
  const { imp } = preparar(carpeta);
  assert.deepEqual(imp.ilegibles, [{ rel: "CONTEXTO/", motivo: "no es una carpeta" }]);
  const p = leerProceso(carpeta);
  assert.equal(p.activo, false);
  assert.equal(p.fase, "listo");
});

test("un binario con extensión de texto (o sin extensión) no se le pasa a Claude como texto", async () => {
  const { separarContexto } = await import("../lib/separar.mjs");
  const ctx = join(carpeta, "CONTEXTO");
  writeFileSync(join(ctx, "volcado.txt"), Buffer.from([0x00, 0x01, 0x02, 0xff, 0x00, 0x41, 0x42, 0x00]));
  writeFileSync(join(ctx, "foto-libreta"), Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)])); // JPEG sin extensión
  writeFileSync(join(ctx, "notas.txt"), "12/03/2026 banca 5x80\n");
  const { elementos } = separarContexto(ctx);
  const por = Object.fromEntries(elementos.map((e) => [e.fichero, e]));
  assert.equal(por["CONTEXTO/volcado.txt"].tipo, "multimedia");
  assert.match(por["CONTEXTO/volcado.txt"].motivo, /binario/);
  assert.equal(por["CONTEXTO/foto-libreta"].tipo, "imagen");
  assert.equal(por["CONTEXTO/notas.txt"].tipo, "texto");
});

test("un fichero enorme (más de 20 MB) no se lee entero: va a Claude como «otro» con su ruta", async () => {
  const { separarContexto } = await import("../lib/separar.mjs");
  const { truncateSync } = await import("node:fs");
  const f = join(carpeta, "CONTEXTO", "export-gigante.txt");
  writeFileSync(f, "");
  truncateSync(f, 21 * 1024 * 1024);
  const [e] = separarContexto(join(carpeta, "CONTEXTO")).elementos.filter((x) => x.fichero.endsWith("gigante.txt"));
  assert.equal(e.tipo, "otro");
  assert.equal(e.ruta, f);
  assert.ok(e.texto.length < 200);
});

test("un cerrojo que dejó un proceso muerto no bloquea la siguiente orden", async () => {
  const { conCerrojo } = await import("../lib/cerrojo.mjs");
  const { spawnSync } = await import("node:child_process");
  const muerto = spawnSync(process.execPath, ["-e", "process.stdout.write(String(process.pid))"], { encoding: "utf8" }).stdout;
  const dir = join(carpeta, ".gymhub");
  mkdirSync(join(dir, "cerrojo"), { recursive: true });
  writeFileSync(join(dir, "cerrojo", "pid"), muerto);
  const t0 = Date.now();
  assert.equal(conCerrojo(dir, () => "hecho", { esperaMs: 3000 }), "hecho");
  assert.ok(Date.now() - t0 < 1000, `tardó ${Date.now() - t0} ms`);
  assert.equal(existsSync(join(dir, "cerrojo")), false);
  // Uno vivo sí espera (y avisa al cabo del tiempo)
  mkdirSync(join(dir, "cerrojo"));
  writeFileSync(join(dir, "cerrojo", "pid"), String(process.pid));
  assert.throws(() => conCerrojo(dir, () => "no", { esperaMs: 300 }), /otra orden de gymhub está escribiendo/);
});

test("al archivar un chat terminado, no se llevan las fotos de otro chat que sigue a medias", async () => {
  const { guardar, cerrar } = await import("../lib/refresh.mjs");
  const ctx = join(carpeta, "CONTEXTO");
  const wa = (fecha, texto) => `${fecha}, 18:00 - Ana: ${texto}`;
  writeFileSync(join(ctx, "chat.txt"), [wa("12/03/2026", "banca 5x80"), wa("12/03/2026", "bien"), wa("12/03/2026", "fin")].join("\n") + "\n");
  mkdirSync(join(ctx, "otro"));
  writeFileSync(join(ctx, "otro", "IMG-1.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]));
  writeFileSync(join(ctx, "otro", "chat.txt"), [wa("01/02/2026", "IMG-1.jpg (archivo adjunto)"), wa("01/02/2026", "pierna"), wa("01/02/2026", "ok")].join("\n") + "\n");
  const { imp } = preparar(carpeta);
  // Se guarda solo el lote de marzo (el chat de la raíz); el de febrero queda pendiente
  const marzo = imp.lotes.find((l) => l.etiqueta === "2026-03");
  const r = guardar(carpeta, marzo.n, `@@@ sesion elementos=${marzo.ids.join(",")}\n---\nfecha: 2026-03-12\nconfianza: alta\n---\n## Ejercicios\n### Press banca\n<!-- id: press-banca -->\n| # | tipo | carga | reps | rpe | rir | nota |\n|---|---|---|---|---|---|---|\n| 1 | trabajo | 80 kg | 5 | | | |\n`);
  assert.deepEqual(r.errores, []);
  const c = await cerrar(carpeta, { forzar: true });
  assert.deepEqual(c.movidos, ["CONTEXTO/chat.txt"]);
  assert.ok(existsSync(join(ctx, "otro", "IMG-1.jpg")), "la foto del chat a medias sigue en su sitio");
  assert.ok(existsSync(join(ctx, "otro", "chat.txt")));
});

test("un procesados.json o generadas.json dañado se avisa (con copia) en lugar de tratarse como vacío en silencio", () => {
  writeFileSync(join(carpeta, ".gymhub", "procesados.json"), "{ esto no es JSON");
  writeFileSync(join(carpeta, ".gymhub", "generadas.json"), "[[[");
  writeFileSync(join(carpeta, "CONTEXTO", "notas.txt"), "12/03/2026\nbanca 5x80\n");
  const r = cli(t.dir, ["refresh", "preparar", "--carpeta", carpeta]);
  assert.equal(r.codigo, 0, r.error);
  assert.match(r.salida, /AVISO: \.gymhub\/procesados\.json estaba dañado/);
  assert.match(r.salida, /AVISO: \.gymhub\/generadas\.json estaba dañado/);
  const copias = readdirSync(join(carpeta, ".gymhub", "copias"));
  assert.ok(copias.some((n) => n.startsWith("procesados.json.dañado.")), copias.join(", "));
  assert.equal(readFileSync(join(carpeta, ".gymhub", "copias", copias.find((n) => n.startsWith("procesados.json"))), "utf8"), "{ esto no es JSON");
});

test("varias sesiones de Claude a la vez (guardar y publicar en paralelo) no pierden ni corrompen nada", async () => {
  const { spawn } = await import("node:child_process");
  const { BIN } = await import("./ayuda.mjs");
  const ses = (f) => `@@@ sesion\n---\nfecha: ${f}\ntitulo: Torso\nconfianza: alta\n---\n## Ejercicios\n### Press banca\n<!-- id: press-banca -->\n| # | tipo | carga | reps | rpe | rir | nota |\n|---|---|---|---|---|---|---|\n| 1 | trabajo | 70 kg | 5 | | | |\n\n<details><summary>Original</summary>\n\nbanca 5x70 el ${f}\n\n</details>\n`;
  const correr = (args, entrada = null) => new Promise((resolve) => {
    const p = spawn(process.execPath, [BIN, ...args, "--carpeta", carpeta], { env: { ...process.env, GYMHUB_NO_ABRIR: "1" } });
    let salida = "";
    p.stdout.on("data", (d) => (salida += d));
    if (entrada !== null) p.stdin.end(entrada); else p.stdin.end();
    p.on("exit", (codigo) => resolve({ codigo, salida }));
  });
  const fechas = ["2026-03-02", "2026-03-04", "2026-03-06", "2026-03-09", "2026-03-11"];
  const r = await Promise.all([...fechas.map((f) => correr(["refresh", "guardar", "directo"], ses(f))), correr(["publicar"]), correr(["publicar"]), correr(["web", "--no-abrir"])]);
  for (const x of r) assert.equal(x.codigo, 0, x.salida);
  const generadas = JSON.parse(readFileSync(join(carpeta, ".gymhub", "generadas.json"), "utf8"));
  assert.deepEqual(Object.keys(generadas).sort(), fechas.map((f) => `sesiones/2026/${f}.md`));
  assert.equal(cli(t.dir, ["publicar", "--carpeta", carpeta]).codigo, 0);
  assert.equal(JSON.parse(readFileSync(join(carpeta, ".gymhub", "datos.json"), "utf8")).resumen.sesiones_total, 5);
});
