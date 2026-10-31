// Subcomandos de bin/gymhub.mjs. Cada uno escribe en la salida estándar un texto corto en
// español, pensado para que Claude lo lea y se lo resuma a la persona.
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { leerConfig, guardarConfig, rutaConfig, normalizarRuta, carpetaActiva, carpetaPorDefecto, rutas, tieneEstructura, esWSL } from "./config.mjs";
import { crearEstructura, estaDentro, fueraDeWindows, RAIZ_PLUGIN } from "./estructura.mjs";
import { leerTexto, escribirAtomico, hoyISO } from "./util.mjs";
import { ponerClave, anadirLesion } from "./ficha.mjs";
import { leerCatalogo } from "./catalogo.mjs";
import { instalarWeb, publicar, ponerNavegar } from "./publicar.mjs";
import { abrirEnNavegador } from "./abrir.mjs";
import { registrar, SUBCOMANDOS, lista, carpetaObligatoria, rutaSegura, recalcular } from "./registro.mjs";
export { ejecutar } from "./registro.mjs";


registrar("ayuda", "lista los subcomandos", () => {
  console.log("gymhub · subcomandos de bin/gymhub.mjs:\n");
  for (const [n, s] of Object.entries(SUBCOMANDOS)) console.log(`  ${n.padEnd(16)} ${s.ayuda}`);
  return 0;
});

registrar("formato", "imprime FORMATO.md (las reglas de normalización)", () => {
  const p = join(RAIZ_PLUGIN, "docs", "FORMATO.md");
  if (!existsSync(p)) { console.log("AVISO: falta docs/FORMATO.md en el plugin; normaliza con las reglas de la skill."); return 1; }
  process.stdout.write(readFileSync(p, "utf8"));
  return 0;
});

registrar("estado", "diagnóstico: Node, config, carpeta de datos y directorio de la sesión", ({ op }) => {
  const cfg = leerConfig();
  const cwd = process.cwd();
  const carpeta = carpetaActiva({ carpeta: op.carpeta });
  const lineas = [
    `node: ${process.version} (${Number(process.versions.node.split(".")[0]) >= 20 ? "vale" : "necesita 20 o superior"})`,
    `config: ${rutaConfig()}${existsSync(rutaConfig()) ? "" : " (todavía no existe)"}`,
    `carpeta configurada: ${cfg.carpeta ?? "ninguna"}`,
    carpeta ? `estructura en la carpeta: ${tieneEstructura(carpeta) ? "sí" : "no"}` : null,
    `directorio de la sesión: ${cwd}${tieneEstructura(cwd) ? " (ya es una carpeta de gymhub)" : ""}`,
    `carpeta por defecto: ${carpetaPorDefecto()}`,
    `entorno: ${esWSL() ? "WSL" : process.platform}`,
    `hoy: ${hoyISO()}`,
  ].filter(Boolean);
  console.log(lineas.join("\n"));
  return 0;
});

registrar("configurar", "<ruta>: crea la carpeta de datos con las plantillas (no sobrescribe nada) y la guarda en la config", async ({ pos, op }) => {
  const ruta = normalizarRuta(pos.join(" ") || op.ruta);
  if (!ruta) { console.log("Falta la ruta de la carpeta. Ejemplo: configurar /mnt/d/GIMNASIO"); return 2; }
  if (estaDentro(ruta, RAIZ_PLUGIN)) { console.log(`No uses la carpeta del plugin (${RAIZ_PLUGIN}) como carpeta de datos.`); return 2; }
  const { creados, existentes } = crearEstructura(ruta);
  guardarConfig({ carpeta: ruta });
  instalarWeb(ruta);
  await recalcular(ruta);
  publicar(ruta);
  console.log(`Carpeta de datos: ${ruta}`);
  console.log(creados.length ? `Creado: ${creados.join(", ")}` : "No hacía falta crear nada.");
  if (existentes.length) console.log(`Ya existía (sin tocar): ${existentes.join(", ")}`);
  console.log(`Config guardada en ${rutaConfig()}`);
  if (esWSL() && fueraDeWindows(ruta)) console.log("AVISO: la carpeta está dentro de WSL. El navegador de Windows la abrirá por \\\\wsl.localhost; mejor una carpeta en /mnt/c o /mnt/d.");
  return 0;
});

registrar("carpeta", "[ruta]: sin ruta, muestra la carpeta; con ruta, la cambia (si tiene estructura)", async ({ pos }) => {
  const cfg = leerConfig();
  if (!pos.length) {
    if (!cfg.carpeta) { console.log("No hay carpeta configurada. Usa /gymhub:configurar."); return 0; }
    console.log(`Carpeta de datos: ${cfg.carpeta} · ${tieneEstructura(cfg.carpeta) ? "con estructura" : existsSync(cfg.carpeta) ? "SIN estructura de gymhub" : "NO EXISTE"}`);
    return 0;
  }
  const ruta = normalizarRuta(pos.join(" "));
  if (!tieneEstructura(ruta)) {
    console.log(`SIN_ESTRUCTURA: ${ruta} ${existsSync(ruta) ? "existe pero no tiene la estructura de gymhub" : "no existe"}. Para crearla: configurar "${ruta}"`);
    return 3;
  }
  guardarConfig({ carpeta: ruta });
  instalarWeb(ruta);
  console.log(`Carpeta de datos cambiada a ${ruta}${cfg.carpeta && cfg.carpeta !== ruta ? ` (antes: ${cfg.carpeta})` : ""}`);
  return 0;
});

registrar("ficha", "[--dias N] [--objetivo ejercicio=kg]… [--lesion texto]… [--peso kg]: edita FICHA.md", async ({ op }) => {
  const carpeta = carpetaObligatoria(op);
  const r = rutas(carpeta);
  let t = leerTexto(r.ficha, "# Ficha\n");
  const cambios = [];
  const cat = leerCatalogo(leerTexto(r.ejercicios, ""));
  if (op.dias !== undefined && op.dias !== true) { t = ponerClave(t, "Objetivos", "dias_semana", String(op.dias)); cambios.push(`días por semana: ${op.dias}`); }
  for (const o of lista(op.objetivo)) {
    const m = String(o).match(/^(.+?)\s*[=:]\s*([\d.,]+)\s*(kg|lb)?$/i);
    if (!m) { console.log(`Objetivo no entendido: «${o}» (usa ejercicio=kg)`); continue; }
    const id = cat.buscar(m[1]) ?? m[1].trim();
    t = ponerClave(t, "Objetivos", id, `${m[2].replace(",", ".")} ${m[3] || "kg"}`);
    cambios.push(`objetivo ${id}: ${m[2]} ${m[3] || "kg"}${cat.buscar(m[1]) ? "" : " (ejercicio no reconocido en el catálogo)"}`);
  }
  if (op.peso !== undefined && op.peso !== true) { t = ponerClave(t, "Datos", "peso_corporal", `${op.peso} kg`); cambios.push(`peso corporal: ${op.peso} kg`); }
  for (const l of lista(op.lesion)) { t = anadirLesion(t, l); cambios.push(`lesión: ${l}`); }
  if (!cambios.length) { console.log("Nada que cambiar."); return 0; }
  escribirAtomico(r.ficha, t);
  console.log(`FICHA.md actualizada: ${cambios.join(" · ")}`);
  return 0;
});

registrar("leer", "<ruta relativa>: imprime un fichero de la carpeta de datos (FICHA.md, convenciones.md, revision.md, una sesión…)", ({ pos, op }) => {
  const carpeta = carpetaObligatoria(op);
  const p = rutaSegura(carpeta, pos.join(" "));
  if (!existsSync(p)) { console.log(`No existe: ${relative(carpeta, p)}`); return 1; }
  if (statSync(p).isDirectory()) { console.log(readdirSync(p).sort().join("\n")); return 0; }
  process.stdout.write(readFileSync(p, "utf8"));
  return 0;
});

const ESCRIBIBLES = [/^FICHA\.md$/, /^convenciones\.md$/, /^revision\.md$/, /^plantillas\/[^/]+\.md$/, /^semanas\/\d{4}-W\d{2}\.md$/];
registrar("escribir", "<ruta relativa> < texto: reemplaza FICHA.md, convenciones.md, revision.md, plantillas/*.md o semanas/*.md (guarda copia)", async ({ pos, op }) => {
  const carpeta = carpetaObligatoria(op);
  const rel = relative(carpeta, rutaSegura(carpeta, pos.join(" ")));
  if (!ESCRIBIBLES.some((re) => re.test(rel))) { console.log(`No se puede escribir ${rel} con este subcomando. Las sesiones van por «refresh guardar».`); return 2; }
  const texto = readFileSync(0, "utf8");
  if (!texto.trim()) { console.log("Texto vacío: no se escribe nada."); return 2; }
  const destino = join(carpeta, rel);
  const anterior = leerTexto(destino);
  if (anterior !== null && anterior !== texto) {
    escribirAtomico(join(rutas(carpeta).copias, `${rel.replace(/\//g, "__")}.${Date.now()}`), anterior);
  }
  escribirAtomico(destino, texto.endsWith("\n") ? texto : texto + "\n");
  console.log(`${rel} ${anterior === null ? "creado" : "actualizado"}${anterior !== null ? " (copia del anterior en .gymhub/copias/)" : ""}.`);
  await recalcular(carpeta);
  publicar(carpeta);
  return 0;
});

export const VISTAS = ["panel", "progreso", "analisis", "diario", "ejercicios"];
registrar("web", "[vista] [filtro…] [--no-abrir]: recalcula, publica y abre la web (en esa vista)", async ({ pos, op }) => {
  const carpeta = carpetaObligatoria(op);
  instalarWeb(carpeta);
  const [vista = null, ...resto] = pos;
  if (vista && !VISTAS.includes(vista)) { console.log(`Vista desconocida: ${vista}. Son: ${VISTAS.join(", ")}`); return 2; }
  await recalcular(carpeta);
  if (vista) ponerNavegar(carpeta, vista, { filtro: resto.join(" ") || null, modo: op.modo ?? null });
  const { ruta, version } = publicar(carpeta);
  const abrir = op["no-abrir"] ? { texto: "sin abrir (--no-abrir)" } : abrirEnNavegador(ruta);
  console.log(`Web: ${ruta}${vista ? ` · vista ${vista}${resto.length ? ` (${resto.join(" ")})` : ""}` : ""} · versión ${version} · ${abrir.texto}`);
  return 0;
});

registrar("publicar", "recalcula y publica datos.js sin abrir el navegador", async ({ op }) => {
  const carpeta = carpetaObligatoria(op);
  await recalcular(carpeta);
  const { version, bytes } = publicar(carpeta);
  console.log(`Publicado datos.js · versión ${version} · ${Math.round(bytes / 1024)} KB`);
  return 0;
});

