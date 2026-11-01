// pnpm qa:validar -- --datos <ruta> [--max N] (G7): valida una carpeta de gymhub en SOLO LECTURA.
//   1. Copia a un directorio temporal lo que hace falta (sesiones/, plantillas/, semanas/ y los .md de la
//      raíz). Todo lo demás trabaja sobre la copia; al final comprueba que el original no ha cambiado.
//   2. Valida cada sesión contra FORMATO.md (con el catálogo de la carpeta) y su ida y vuelta.
//   3. Lista: ejercicios fuera del catálogo, líneas no reconocidas, fechas raras, sesiones duplicadas,
//      saltos de peso de más del 30 % entre sesiones seguidas del mismo ejercicio y mezcla de unidades.
// El informe solo lleva recuentos y referencias fichero:línea: ni notas, ni títulos, ni pesos.
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { createHash } from "node:crypto";
import { normalizarRuta, tieneEstructura } from "../lib/config.mjs";
import { leerSesion, escribirSesion, validarSesion } from "../lib/canonico.mjs";
import { leerCatalogo } from "../lib/catalogo.mjs";
import { leerConvenciones } from "../lib/convenciones.mjs";
import { kgCarga } from "../lib/series.mjs";
import { hoyISO } from "../lib/util.mjs";
import { ordenSesiones } from "../lib/base.mjs";

const args = process.argv.slice(2);
const valor = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const ruta = normalizarRuta(valor("--datos"));
const MAX = Number(valor("--max") ?? 10);
if (!ruta) { console.log("Uso: pnpm qa:validar -- --datos <ruta de la carpeta de gymhub>"); process.exit(2); }
if (!existsSync(ruta) || !tieneEstructura(ruta)) { console.log(`${ruta} no es una carpeta de gymhub (falta FICHA.md o sesiones/).`); process.exit(2); }

/** Huella del original (ruta → tamaño, fecha y hash) para comprobar al final que no ha cambiado nada. */
function huella(dir) {
  const out = {};
  const rec = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); const st = statSync(p); if (st.isDirectory()) { if (n !== "CONTEXTO" && n !== ".gymhub") rec(p); } else out[relative(dir, p)] = `${st.size}|${st.mtimeMs}|${createHash("sha256").update(readFileSync(p)).digest("hex")}`; } };
  rec(dir);
  return out;
}
const antes = huella(ruta);

// 1. La copia de trabajo
const tmp = mkdtempSync(join(tmpdir(), "gymhub-qa-validar-"));
const copia = join(tmp, "copia");
try {
  for (const n of readdirSync(ruta)) {
    const p = join(ruta, n);
    if (["sesiones", "plantillas", "semanas"].includes(n) || (n.endsWith(".md") && statSync(p).isFile())) cpSync(p, join(copia, n), { recursive: true });
  }
  const leer = (f) => (existsSync(join(copia, f)) ? readFileSync(join(copia, f), "utf8") : "");
  const catalogo = leerCatalogo(leer("ejercicios.md"));
  const { equivalencias, avisos: avisosConv } = leerConvenciones(leer("convenciones.md"), catalogo);
  const hoy = hoyISO();
  const ficheros = [];
  const rec = (d) => { if (!existsSync(d)) return; for (const n of readdirSync(d).sort()) { const p = join(d, n); if (statSync(p).isDirectory()) rec(p); else if (n.endsWith(".md") && !n.startsWith(".")) ficheros.push(p); } };
  rec(join(copia, "sesiones"));

  const hallazgos = { errores: [], idaVuelta: [], fueraCatalogo: new Map(), noReconocidas: [], fechasRaras: [], duplicadas: [], saltos: [], unidades: new Map() };
  const sesiones = [];
  const modelo = (s) => JSON.stringify(s, (k, v) => (k === "linea" || k === "ruta" ? undefined : v));
  for (const f of ficheros) {
    const rel = relative(copia, f).split("\\").join("/");
    const texto = readFileSync(f, "utf8");
    const s = leerSesion(texto, rel);
    const errs = validarSesion(s, catalogo, { hoy });
    for (const e of errs) hallazgos.errores.push(`${rel}:${e.match(/\(línea (\d+)\)/)?.[1] ?? 1}`);
    // Ida y vuelta: lo que se lee, se escribe y se vuelve a leer es lo mismo
    if (!s.errores.length && modelo(leerSesion(escribirSesion(s), rel)) !== modelo(s)) hallazgos.idaVuelta.push(rel);
    for (const e of s.ejercicios) if (e.id && !catalogo.tiene(e.id)) { const l = hallazgos.fueraCatalogo.get(e.id) ?? []; l.push(`${rel}:${e.linea}`); hallazgos.fueraCatalogo.set(e.id, l); }
    const sueltas = Object.values(s.sueltas ?? {}).filter(Boolean).length + s.ejercicios.filter((e) => e.nota).length + Object.keys(s.otras).length + s.avisos.length;
    if (sueltas) hallazgos.noReconocidas.push(`${rel} (${sueltas})`);
    if (s.fecha && /^\d{4}-\d{2}-\d{2}$/.test(s.fecha) && (s.fecha < "1990-01-01" || s.fecha > hoy)) hallazgos.fechasRaras.push(`${rel}:${s._lineas?.fecha ?? 2}`);
    if (!errs.length) sesiones.push(s);
  }
  sesiones.sort(ordenSesiones);
  // Duplicadas: mismo día y mismos ejercicios con las mismas series
  const porHuella = new Map();
  for (const s of sesiones) {
    const k = `${s.fecha}|${JSON.stringify(s.ejercicios.map((e) => [e.id, e.series.map((x) => [x.tipo, x.carga.texto, x.reps.texto])]))}`;
    if (s.ejercicios.length) porHuella.set(k, [...(porHuella.get(k) ?? []), s.ruta]);
  }
  for (const rutas of porHuella.values()) if (rutas.length > 1) hallazgos.duplicadas.push(rutas.join(" = "));
  // Saltos de más del 30 % en la mayor carga de trabajo entre sesiones seguidas del mismo ejercicio, y unidades mezcladas
  const historial = new Map();
  for (const s of sesiones) {
    for (const e of s.ejercicios) {
      const id = catalogo.canonico(e.id);
      const trabajo = e.series.filter((x) => ["trabajo", "top", "backoff", "amrap", "dropset", "myo", "cluster"].includes(x.tipo));
      for (const x of trabajo) if (x.carga.tipo === "peso") { const u = hallazgos.unidades.get(id) ?? {}; u[x.carga.unidad] = (u[x.carga.unidad] ?? 0) + 1; hallazgos.unidades.set(id, u); }
      const kg = Math.max(0, ...trabajo.map((x) => kgCarga(x.carga, { pesoCorporal: s.peso_corporal_kg, equivalencia: equivalencias.get(id) }) ?? 0));
      if (!kg) continue;
      const previo = historial.get(id);
      if (previo && Math.abs(kg / previo.kg - 1) > 0.3) hallazgos.saltos.push(`${s.ruta}:${e.linea} (${id}, frente a ${previo.ruta})`);
      historial.set(id, { kg, ruta: s.ruta });
    }
  }
  const mezcla = [...hallazgos.unidades].filter(([, u]) => Object.keys(u).length > 1).map(([id, u]) => `${id} (${Object.entries(u).map(([k, n]) => `${n} en ${k}`).join(", ")})`);

  // Informe: recuentos y referencias, nada más
  const lista = (xs) => (xs.length ? `\n    ${xs.slice(0, MAX).join("\n    ")}${xs.length > MAX ? `\n    … y ${xs.length - MAX} más` : ""}` : "");
  const fuera = [...hallazgos.fueraCatalogo].map(([id, l]) => `${id}: ${l.length} vez/veces · ${l[0]}`);
  const despues = huella(ruta);
  const intacto = JSON.stringify(antes) === JSON.stringify(despues);
  console.log([
    `gymhub · validación de solo lectura (sobre una copia en ${tmp})`,
    `Sesiones: ${ficheros.length} ficheros · ${sesiones.length} válidas · ${ficheros.length - sesiones.length} con errores · catálogo: ${catalogo.ejercicios.size} ejercicios`,
    `- Errores de formato: ${hallazgos.errores.length}${lista(hallazgos.errores)}`,
    `- Ida y vuelta que no vuelve igual: ${hallazgos.idaVuelta.length}${lista(hallazgos.idaVuelta)}`,
    `- Ejercicios fuera del catálogo: ${fuera.length}${lista(fuera)}`,
    `- Sesiones con líneas no reconocidas (se conservan, pero no cuentan): ${hallazgos.noReconocidas.length}${lista(hallazgos.noReconocidas)}`,
    `- Fechas raras (antes de 1990 o futuras): ${hallazgos.fechasRaras.length}${lista(hallazgos.fechasRaras)}`,
    `- Sesiones duplicadas (mismo día y mismas series): ${hallazgos.duplicadas.length}${lista(hallazgos.duplicadas)}`,
    `- Saltos de carga de más del 30 % entre sesiones seguidas: ${hallazgos.saltos.length}${lista(hallazgos.saltos)}`,
    `- Ejercicios apuntados en kg y en lb: ${mezcla.length}${lista(mezcla)}`,
    `- Avisos de convenciones.md: ${avisosConv.length}`,
    `Original: ${intacto ? "intacto ✔ (no se ha escrito nada)" : "✖ HA CAMBIADO durante la validación"}`,
  ].join("\n"));
  process.exitCode = intacto ? 0 : 1;
} finally { rmSync(tmp, { recursive: true, force: true }); }
