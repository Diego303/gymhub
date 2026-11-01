// /gymhub:refresh: separar → (Claude normaliza por lotes) → validar y derivar → cerrar.
//   refresh preparar         separa CONTEXTO/ en elementos nuevos y los agrupa en lotes mensuales
//   refresh muestra [n]      ~30 elementos repartidos en el tiempo (pasada de muestreo)
//   refresh lote <n>         imprime los elementos de un lote para normalizarlos
//   refresh guardar <n>      recibe por stdin lo que propone Claude, lo valida y lo escribe
//   refresh cerrar           mueve lo importado a CONTEXTO/procesado/, rehace records.md y avisa a la web
//   refresh estado           cómo va la importación
import { readFileSync, existsSync, renameSync, mkdirSync, readdirSync, statSync, rmdirSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { rutas } from "./config.mjs";
import { registrar, carpetaObligatoria, rutaSegura } from "./registro.mjs";
import { separarContexto } from "./separar.mjs";
import { leerSesion, validarSesion, escribirSesion } from "./canonico.mjs";
import { leerCatalogo, leerFilas, anadirFilas, anadirAlias, filaCatalogo } from "./catalogo.mjs";
import { leerOrdenFechas, convencionesVacias, leerConvenciones } from "./convenciones.mjs";
import { leerEventos, lineaEvento } from "./eventos.mjs";
import { conCerrojo } from "./cerrojo.mjs";
import { derivarCarpeta, contexto } from "./derivar.mjs";
import { sugerenciaRepaso } from "./semanas.mjs";
import { publicar, ponerProceso } from "./publicar.mjs";
import { leerJSON, escribirJSON, leerTexto, escribirAtomico, sha256, hoyISO, claveTexto, diasEntre } from "./util.mjs";

const MAX_LOTE = 25;
const PLANTILLA_EVENTOS = "# Eventos\n\nPausas declaradas e hitos que no son sesiones. La racha no se rompe durante una pausa declarada.\n\n";

const leerProcesados = (r) => leerJSON(r.procesados, null) ?? { version: 1, elementos: {} };
const leerImportacion = (r) => leerJSON(r.importacion, null);

// ── preparar ─────────────────────────────────────────────────────────────────────────────
export function preparar(carpeta, { hoy = hoyISO() } = {}) {
  const r = rutas(carpeta);
  const actual = leerImportacion(r);
  if (actual?.estado === "en_curso") {
    const pendientes = actual.lotes.filter((l) => l.estado !== "hecho");
    if (pendientes.length) return { reanudada: true, imp: actual };
  }
  const orden = leerOrdenFechas(leerTexto(r.convenciones, ""));
  ponerProceso(carpeta, { activo: true, fase: "separando", lote: null, lotes_total: null, pct: 0, mensaje: "Separando CONTEXTO/…", dudas: contarDudas(r) });
  publicar(carpeta);
  let separado;
  try { separado = separarContexto(r.contexto, { orden }); } catch (e) {
    // Que la web no se quede en «Separando…»
    ponerProceso(carpeta, { activo: false, fase: "listo", pct: null, mensaje: `No se ha podido separar CONTEXTO/: ${e.message}` });
    publicar(carpeta);
    throw e;
  }
  const { elementos, ficheros, ilegibles } = separado;
  const procesados = leerProcesados(r);
  const vistos = new Set();
  const nuevos = [];
  for (const e of elementos) {
    if (procesados.elementos[e.hash] || vistos.has(e.hash)) continue;
    vistos.add(e.hash);
    nuevos.push(e);
  }
  const auto = nuevos.filter((e) => e.tipo === "multimedia");
  const paraClaude = nuevos.filter((e) => e.tipo !== "multimedia");
  paraClaude.sort((a, b) => (a.fecha_pista ?? "9999") < (b.fecha_pista ?? "9999") ? -1 : (a.fecha_pista ?? "9999") > (b.fecha_pista ?? "9999") ? 1
    : a.fichero < b.fichero ? -1 : a.fichero > b.fichero ? 1 : a.n - b.n);
  const porMes = new Map();
  for (const e of paraClaude) {
    const k = e.fecha_pista ? e.fecha_pista.slice(0, 7) : "sin fecha";
    if (!porMes.has(k)) porMes.set(k, []);
    porMes.get(k).push(e.id);
  }
  const lotes = [];
  for (const [mes, ids] of porMes) {
    const partes = Math.ceil(ids.length / MAX_LOTE);
    for (let p = 0; p < partes; p++) {
      lotes.push({ n: lotes.length + 1, etiqueta: partes > 1 ? `${mes} (${p + 1}/${partes})` : mes, ids: ids.slice(p * MAX_LOTE, (p + 1) * MAX_LOTE), estado: "pendiente" });
    }
  }
  const c = contexto(carpeta, { hoy });
  const imp = {
    version: 1, id: new Date().toISOString(), estado: lotes.length || auto.length ? "en_curso" : "cerrada",
    ultimo_refresh: actual?.ultimo_refresh ?? null, lotes,
    elementos: Object.fromEntries(nuevos.map((e) => [e.id, e])),
    ficheros: ficheros.map((f) => ({ ...f, elementos: f.elementos })), automaticos: auto.map((e) => e.id),
    prs_antes: c.base.prs.map((p) => `${p.fecha}|${p.id}`), sesiones_nuevas: [], ilegibles,
    muestreo: { necesario: paraClaude.length > 20 && convencionesVacias(leerTexto(r.convenciones, "")), hecho: false },
  };
  if (!lotes.length && !auto.length) {
    // Nada nuevo: los ficheros que ya estaban importados enteros (p. ej. la misma nota copiada otra vez) se archivan.
    const { movidos } = moverProcesados(carpeta, imp, procesados, hoy);
    imp.movidos_sin_nuevo = movidos;
    imp.ultimo_refresh = new Date().toISOString();
  }
  escribirJSON(r.importacion, imp);
  // Sin nada nuevo también se recalcula: tras actualizar gymhub, las cifras nuevas (p. ej. la pestaña Semana) aparecen ya.
  // (derivarCarpeta no espera a nada: termina antes de seguir)
  if (!lotes.length && !auto.length) derivarCarpeta(carpeta, { md: true, hoy });
  escribirJSON(r.importacion, imp);
  ponerProceso(carpeta, {
    activo: lotes.length > 0, fase: lotes.length ? "normalizando" : "listo", lote: 0, lotes_total: lotes.length, pct: lotes.length ? 0 : 100,
    mensaje: lotes.length ? `Normalizando · ${paraClaude.length} elementos en ${lotes.length} lote${lotes.length === 1 ? "" : "s"}` : "Nada nuevo en CONTEXTO/",
  });
  publicar(carpeta);
  return { reanudada: false, imp };
}

function textoPreparar(carpeta, { reanudada, imp }) {
  const r = rutas(carpeta);
  const lineas = [];
  const pendientes = imp.lotes.filter((l) => l.estado !== "hecho");
  if (reanudada) {
    lineas.push(`Importación a medias (empezada ${imp.id.slice(0, 16).replace("T", " ")}): faltan ${pendientes.length} de ${imp.lotes.length} lotes. Se continúa donde se quedó.`);
  } else if (!imp.lotes.length) {
    lineas.push(imp.automaticos.length ? `Solo hay multimedia sin texto (${imp.automaticos.length}); se ignora.` : `Nada nuevo en CONTEXTO/.${imp.movidos_sin_nuevo?.length ? ` Ya estaba todo importado en: ${imp.movidos_sin_nuevo.join(", ")} (movido a CONTEXTO/procesado/).` : ""}`);
  } else {
    const total = imp.lotes.reduce((s, l) => s + l.ids.length, 0);
    lineas.push(`${total} elementos nuevos en ${imp.lotes.length} lotes (por meses).`);
    const porFichero = new Map();
    for (const e of Object.values(imp.elementos)) porFichero.set(e.fichero, (porFichero.get(e.fichero) || 0) + 1);
    for (const [f, n] of porFichero) lineas.push(`  - ${f}: ${n}`);
    if (imp.automaticos.length) lineas.push(`Multimedia sin texto que se ignora: ${imp.automaticos.length}.`);
  }
  if (pendientes.length) {
    lineas.push("", "Lotes:");
    for (const l of imp.lotes) lineas.push(`  ${l.estado === "hecho" ? "✓" : "·"} lote ${l.n} · ${l.etiqueta} · ${l.ids.length} elementos`);
    if (imp.muestreo.necesario && !imp.muestreo.hecho) lineas.push("", "MUESTREO: más de 20 elementos y convenciones.md vacío. Antes de los lotes, haz la pasada de muestreo: «refresh muestra».");
    lineas.push("", `SIGUIENTE: refresh lote ${pendientes[0].n}`);
  } else if (imp.lotes.length || imp.automaticos.length) lineas.push("", "SIGUIENTE: refresh cerrar");
  if (imp.ilegibles?.length) lineas.push(`No se ha podido leer (se queda en CONTEXTO/): ${imp.ilegibles.map((x) => `${x.rel} (${x.motivo})`).join(", ")}. Díselo a la persona.`);
  lineas.push(`Dudas pendientes en revision.md: ${contarDudas(r)}`);
  if (!pendientes.length) { const sug = sugerenciaRepaso(contexto(carpeta)); if (sug) lineas.push(`SUGERENCIA (termina tu respuesta con esta línea): ${sug}`); }
  return lineas.join("\n");
}

// ── Mostrar elementos ────────────────────────────────────────────────────────────────────
function textoElemento(e, { recorte = null } = {}) {
  const cab = [`### elemento ${e.id}`, e.fichero + (e.n ? ` #${e.n}` : ""), e.fecha_pista ? `pista de fecha ${e.fecha_pista}${e.fecha_ambigua ? " (AMBIGUA: día/mes o mes/día)" : ""}` : "sin fecha", e.hora ? `hora ${e.hora}` : null, e.contenedor ? `contenedor ${e.contenedor}` : null].filter(Boolean).join(" · ");
  const recortar = (t) => (recorte && t.length > recorte ? t.slice(0, recorte) + `\n[… recortado: ${t.length} caracteres]` : t);
  if (e.tipo === "imagen") return `${cab}\nIMAGEN: léela con la herramienta Read → ${e.imagen}${e.texto_imagen ? `\nTexto del mensaje: ${e.texto_imagen}` : ""}`;
  if (e.tipo === "otro") return `${cab}\nFICHERO de formato desconocido: ${e.ruta}. Decide tú cómo leerlo (Read) y cuéntalo en el resumen.\n\`\`\`\n${recortar(e.texto).slice(0, 4000)}\n\`\`\``;
  if (e.tipo === "csv") return `${cab}\nBORRADOR determinista (cargas y repeticiones ya mapeadas; tú pones los ids, el tipo y lo que falte):\n\`\`\`\n${e.borrador}\n\`\`\``;
  return `${cab}\n\`\`\`\n${recortar(e.texto)}\n\`\`\``;
}

function textoLote(carpeta, imp, lote) {
  const r = rutas(carpeta);
  const els = lote.ids.map((id) => imp.elementos[id]);
  const fechas = [...new Set(els.map((e) => e.fecha_pista).filter(Boolean))];
  const existentes = [];
  for (const f of fechas) {
    const dir = join(r.sesiones, f.slice(0, 4));
    if (!existsSync(dir)) continue;
    for (const n of readdirSync(dir)) if (n.startsWith(f)) existentes.push(`sesiones/${f.slice(0, 4)}/${n}`);
  }
  return [
    `LOTE ${lote.n} de ${imp.lotes.length} · ${lote.etiqueta} · ${els.length} elementos${lote.estado === "hecho" ? " · YA GUARDADO" : ""}`,
    existentes.length ? `Sesiones que ya existen en estas fechas (no las dupliques): ${existentes.join(", ")}` : null,
    "",
    ...els.map((e) => textoElemento(e)),
    "",
    `Cuando lo tengas: refresh guardar ${lote.n} <<'GYMHUB_FIN' … GYMHUB_FIN (todos los elementos del lote tienen que quedar en un bloque).`,
  ].filter((x) => x !== null).join("\n\n");
}

// ── guardar: lo que propone Claude ───────────────────────────────────────────────────────
/** Divide la entrada en bloques «@@@ tipo argumentos» + cuerpo. */
export function leerBloques(texto) {
  const bloques = [];
  for (const linea of String(texto ?? "").replace(/\r\n?/g, "\n").split("\n")) {
    const m = linea.match(/^@@@\s*([a-záéíóú_]+)\s*(.*)$/i);
    if (m) { bloques.push({ tipo: m[1].toLowerCase(), args: m[2].trim(), cuerpo: [] }); continue; }
    if (bloques.length) bloques.at(-1).cuerpo.push(linea);
    else if (linea.trim()) bloques.push({ tipo: "suelto", args: "", cuerpo: [linea] });
  }
  for (const b of bloques) {
    b.cuerpo = b.cuerpo.join("\n").replace(/^\n+|\n+$/g, "");
    const el = b.args.match(/elementos\s*=\s*([\w,\s]+?)(?:\s*·|\s*$)/i);
    b.elementos = el ? el[1].split(/[,\s]+/).filter(Boolean) : [];
    const mot = b.args.match(/motivo\s*:\s*(.+)$/i);
    b.motivo = mot ? mot[1].trim() : null;
    b.nombre = b.args.replace(/elementos\s*=\s*[\w,\s]+/i, "").replace(/·?\s*motivo\s*:.*$/i, "").replace(/·/g, "").trim();
  }
  return bloques;
}

const TIPOS_BLOQUE = ["sesion", "ignorar", "revision", "ejercicios", "alias", "convenciones", "plantilla", "marcas", "evento", "eventos"];
const slug = (s) => claveTexto(s).replace(/ /g, "-").slice(0, 60) || "plantilla";

/** Comprueba y aplica un lote. Si hay errores, no escribe nada. */
export function guardar(carpeta, nLote, entrada, { hoy = hoyISO() } = {}) {
  const r = rutas(carpeta);
  return conCerrojo(r.gymhub, () => {
    const directo = nLote === "directo";
    const imp = directo ? null : leerImportacion(r);
    const lote = directo ? null : imp?.lotes.find((l) => String(l.n) === String(nLote));
    if (!directo && (!imp || imp.estado !== "en_curso")) return { errores: ["no hay ninguna importación en curso: empieza con «refresh preparar»"] };
    if (!directo && !lote) return { errores: [`no existe el lote ${nLote}`] };
    if (lote?.estado === "hecho") return { errores: [`el lote ${nLote} ya está guardado`] };
    const bloques = leerBloques(entrada);
    const errores = [];
    for (const b of bloques) if (!TIPOS_BLOQUE.includes(b.tipo)) errores.push(`bloque desconocido «@@@ ${b.tipo}» (son: ${TIPOS_BLOQUE.join(", ")})`);

    // Catálogo con los ejercicios nuevos de este lote
    const textoCat = leerTexto(r.ejercicios, "");
    const catActual = leerCatalogo(textoCat);
    const filasNuevas = [];
    for (const b of bloques.filter((x) => x.tipo === "ejercicios")) {
      const lineas = b.cuerpo.split("\n").filter((l) => l.trim().startsWith("|") && !/^\|\s*id\s*\|/i.test(l) && !/^\|\s*-/.test(l));
      const c = leerFilas(lineas);
      errores.push(...c.errores.map((e) => `ejercicio nuevo: ${e}`));
      for (const ej of c.ejercicios.values()) {
        if (catActual.tiene(ej.id)) continue; // ya existe: no se duplica
        filasNuevas.push(ej);
      }
    }
    const textoCatNuevo = anadirFilas(textoCat, filasNuevas.map(filaCatalogo));
    let textoCatFinal = textoCatNuevo;
    for (const b of bloques.filter((x) => x.tipo === "alias")) {
      const m = b.args.match(/^([a-z0-9-]+)\s*:\s*(.+)$/);
      if (!m) { errores.push(`alias mal escrito: «@@@ alias ${b.args}» (usa: @@@ alias <id>: mote1, mote2)`); continue; }
      textoCatFinal = anadirAlias(textoCatFinal, m[1], m[2].split(",").map((x) => x.trim()).filter(Boolean));
    }
    const catalogo = leerCatalogo(textoCatFinal);

    // Cuentas de elementos: todos los del lote, una sola vez
    const idsLote = new Set(lote?.ids ?? []);
    const usados = new Map();
    for (const b of bloques) for (const id of b.elementos) {
      if (!directo && !idsLote.has(id)) errores.push(`el elemento ${id} no es del lote ${nLote}`);
      if (b.tipo === "sesion" && usados.get(id) === "sesion") continue; // un elemento puede repartirse entre sesiones del mismo día
      usados.set(id, b.tipo);
    }
    if (!directo) {
      const faltan = [...idsLote].filter((id) => !usados.has(id));
      if (faltan.length) errores.push(`faltan elementos del lote: ${faltan.join(", ")}. Cada uno va en una @@@ sesion, una @@@ ignorar (con motivo) o un bloque que no es sesión (plantilla, marcas, evento) con elementos=…`);
    }

    // Sesiones
    const sesiones = [];
    bloques.filter((b) => b.tipo === "sesion").forEach((b, k) => {
      const s = leerSesion(b.cuerpo, null);
      const donde = `sesión ${k + 1}${s.fecha ? ` (${s.fecha})` : ""}`;
      if (!directo && !b.elementos.length) errores.push(`${donde}: falta «elementos=…» en la línea @@@ sesion`);
      const els = b.elementos.map((id) => imp?.elementos[id]).filter(Boolean);
      if (els.length) {
        s.original = els.map((e) => (e.tipo === "imagen" ? `[imagen: ${e.fichero}]${e.texto_imagen ? `\n${e.texto_imagen}` : ""}` : e.texto)).join("\n\n");
        if (!s.fuente) s.fuente = [...new Set(els.map((e) => e.fichero))].map((f) => `${f} · ${els.filter((e) => e.fichero === f).map((e) => (e.tipo === "mensaje" ? "mensaje " : e.tipo === "csv" ? "día " : "bloque ") + e.n).join(", ")}`).join(" + ");
        if (els.some((e) => e.tipo === "imagen") && s.confianza === "alta") s.confianza = "media";
      } else if (directo && !s.original) errores.push(`${donde}: falta el texto original (<details><summary>Original</summary>…)`);
      if (!s.confianza) s.confianza = "alta";
      const errs = validarSesion(s, catalogo, { hoy });
      errores.push(...errs.map((e) => `${donde}: ${e}`));
      sesiones.push({ s, b, els });
    });
    const revisiones = [];
    for (const b of bloques.filter((x) => x.tipo === "revision")) {
      for (const l of b.cuerpo.split("\n").map((x) => x.trim()).filter(Boolean)) revisiones.push(/^- \[[ x]\]/.test(l) ? l : `- [ ] ${l.replace(/^[-*]\s*/, "")}`);
    }
    for (const b of bloques.filter((x) => x.tipo === "ignorar")) if (!b.motivo) errores.push(`@@@ ignorar ${b.elementos.join(",")}: falta «· motivo: …»`);
    const eventosNuevos = [];
    for (const b of bloques.filter((x) => x.tipo === "evento" || x.tipo === "eventos")) {
      const { eventos, errores: ee } = leerEventos(b.cuerpo.split("\n").map((l) => (l.trim().startsWith("-") ? l : `- ${l}`)).join("\n"));
      errores.push(...ee);
      eventosNuevos.push(...eventos);
    }
    if (errores.length) return { errores };

    // ── Escribir ──────────────────────────────────────────────────────────────────────
    const generadas = leerJSON(r.generadas, {}) ?? {};
    const resultado = { escritas: [], omitidas: [], duplicadas: [], ignorados: 0, otros: [] };
    for (const { s, b, els } of sesiones) {
      const hashesEls = els.map((e) => e.hash);
      const texto = escribirSesion(s);
      const anio = s.fecha.slice(0, 4);
      const dir = join(r.sesiones, anio);
      mkdirSync(dir, { recursive: true });
      let destino = null, sufijo = 1, igual = null;
      for (;;) {
        const nombre = `${s.fecha}${sufijo > 1 ? `-${sufijo}` : ""}.md`;
        const p = join(dir, nombre);
        const rel = `sesiones/${anio}/${nombre}`;
        if (!existsSync(p)) { destino = rel; break; }
        const actual = readFileSync(p, "utf8");
        if (mismoContenido(actual, texto)) { igual = rel; break; }
        const g = generadas[rel];
        const intacta = g && g.hash === sha256(actual);
        if (intacta && hashesEls.length && g.elementos?.length && g.elementos.every((h) => hashesEls.includes(h))) { destino = rel; break; } // reimportación de lo mismo, sin editar a mano
        sufijo++;
      }
      if (igual) { resultado.omitidas.push(igual); b.rutas = [igual]; continue; }
      escribirAtomico(join(carpeta, destino), texto);
      generadas[destino] = { hash: sha256(texto), elementos: hashesEls, escrita: new Date().toISOString() };
      b.rutas = [...(b.rutas || []), destino];
      if (/\d{4}-\d{2}-\d{2}-\d+\.md$/.test(destino)) {
        resultado.duplicadas.push(destino);
        revisiones.push(`- [ ] ${s.fecha} · ya había otra sesión ese día con contenido distinto → guardada como ${destino}. ¿Son la misma?`);
      }
      if (s.confianza === "baja" && !revisiones.some((x) => x.includes(s.fecha))) revisiones.push(`- [ ] ${s.fecha} · confianza baja → revisa ${destino}`);
      // FORMATO §3.2: una fecha a más de 2 meses de la del mensaje o el fichero de origen se revisa.
      const pistas = els.map((e) => e.fecha_pista).filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f ?? ""));
      if (pistas.length && pistas.every((f) => Math.abs(diasEntre(f, s.fecha)) > 62) && !revisiones.some((x) => x.includes(`${s.fecha} · `))) {
        revisiones.push(`- [ ] ${s.fecha} · la fecha de la sesión está a más de 2 meses de la de su origen (${pistas[0]}) → revisa ${destino}`);
      }
      resultado.escritas.push(destino);
    }
    escribirJSON(r.generadas, generadas);
    if (filasNuevas.length || textoCatFinal !== textoCat) { escribirAtomico(r.ejercicios, textoCatFinal); resultado.otros.push(`catálogo: ${filasNuevas.length} ejercicios nuevos (${filasNuevas.map((e) => e.id).join(", ") || "solo alias"})`); }
    for (const b of bloques.filter((x) => x.tipo === "convenciones")) {
      const antes = leerTexto(r.convenciones);
      if (antes !== null && antes !== b.cuerpo) escribirAtomico(join(r.copias, `convenciones.md.${Date.now()}`), antes);
      escribirAtomico(r.convenciones, b.cuerpo + "\n");
      resultado.otros.push("convenciones.md actualizado");
    }
    for (const b of bloques.filter((x) => x.tipo === "plantilla")) {
      let nombre = slug(b.nombre || "rutina"), p = join(r.plantillas, `${nombre}.md`), k = 2;
      while (existsSync(p) && readFileSync(p, "utf8").trim() !== b.cuerpo.trim()) { p = join(r.plantillas, `${nombre}-${k++}.md`); }
      escribirAtomico(p, b.cuerpo + "\n");
      b.rutas = [relative(carpeta, p)];
      resultado.otros.push(`plantilla ${relative(carpeta, p)}`);
    }
    for (const b of bloques.filter((x) => x.tipo === "marcas")) {
      const antes = leerTexto(r.records, "# Récords\n\n## PRs calculados\n\n## Marcas declaradas\n");
      const lineas = b.cuerpo.split("\n").filter((l) => l.trim()).map((l) => (l.trim().startsWith("-") ? l.trim() : `- ${l.trim()}`)).filter((l) => !antes.includes(l));
      if (lineas.length) {
        const t = /## Marcas declaradas/.test(antes) ? antes.replace(/\n*$/, "\n") + lineas.join("\n") + "\n" : antes.replace(/\n*$/, "\n\n## Marcas declaradas\n") + lineas.join("\n") + "\n";
        escribirAtomico(r.records, t);
        resultado.otros.push(`${lineas.length} marcas declaradas`);
      }
    }
    if (eventosNuevos.length) {
      const p = join(carpeta, "eventos.md");
      const antes = leerTexto(p, PLANTILLA_EVENTOS);
      const lineas = eventosNuevos.map(lineaEvento).filter((l) => !antes.includes(l));
      if (lineas.length) escribirAtomico(p, antes.replace(/\n*$/, "\n") + lineas.join("\n") + "\n");
      resultado.otros.push(`${lineas.length} eventos`);
    }
    if (revisiones.length) {
      const antes = leerTexto(r.revision, "# Dudas pendientes\n\n");
      const nuevas = revisiones.filter((l) => !antes.includes(l.replace(/^- \[[ x]\]\s*/, "")));
      if (nuevas.length) escribirAtomico(r.revision, antes.replace(/\n*$/, "\n") + nuevas.join("\n") + "\n");
      resultado.dudas = nuevas.length;
    }

    // Marcar los elementos y el lote
    const proc = leerProcesados(r);
    const ahora = new Date().toISOString();
    for (const b of bloques) for (const id of b.elementos) {
      const e = imp?.elementos[id];
      if (!e) continue;
      const prev = proc.elementos[e.hash];
      const estado = b.tipo === "sesion" ? "importado" : b.tipo === "ignorar" ? "ignorado" : "no_sesion";
      proc.elementos[e.hash] = { id, fichero: e.fichero, estado, fecha: ahora, sesiones: [...new Set([...(prev?.sesiones || []), ...(b.rutas || [])])], motivo: b.motivo ?? (estado === "no_sesion" ? b.tipo : null) };
      if (b.tipo === "ignorar") resultado.ignorados++;
    }
    escribirJSON(r.procesados, proc);
    if (lote) {
      lote.estado = "hecho";
      lote.resultado = { escritas: resultado.escritas.length, omitidas: resultado.omitidas.length, duplicadas: resultado.duplicadas.length, ignorados: resultado.ignorados };
      imp.sesiones_nuevas = [...new Set([...(imp.sesiones_nuevas || []), ...resultado.escritas])];
      escribirJSON(r.importacion, imp);
    }
    return { errores: [], resultado, lote, imp };
  });
}

/** Igual salvo espacios en blanco al final de las líneas. */
const mismoContenido = (a, b) => a.replace(/[ \t]+$/gm, "").trim() === b.replace(/[ \t]+$/gm, "").trim();

function contarDudas(r) {
  return (leerTexto(r.revision, "").match(/^\s*- \[ \]/gm) || []).length;
}


/**
 * Mueve, intactos, a CONTEXTO/procesado/AAAA-MM-DD/ los ficheros con todos sus elementos ya
 * procesados (y los adjuntos de esos chats), y quita las subcarpetas que se quedan vacías.
 */
function moverProcesados(carpeta, imp, proc, hoy) {
  const r = rutas(carpeta);

  const destinoBase = join(r.procesado, hoy);
  const movidos = [], quedan = [];
  const hashDe = (id) => imp.elementos[id]?.hash;
  const completos = new Set();
  for (const f of imp.ficheros || []) {
    if (f.tipo === "adjunto") continue;
    const todos = f.elementos.length > 0 && f.elementos.every((id) => { const h = hashDe(id); return !h || proc.elementos[h]; });
    if (todos) completos.add(f.abs);
  }
  for (const f of imp.ficheros || []) {
    if (!existsSync(f.abs)) continue;
    const mover = f.tipo === "adjunto" ? [...completos].some((c) => dirname(f.abs).startsWith(dirname(c))) : completos.has(f.abs);
    if (!mover) { if (f.tipo !== "adjunto") quedan.push(f.rel); continue; }
    let destino = join(destinoBase, relative(r.contexto, f.abs));
    let k = 2;
    while (existsSync(destino)) destino = destino.replace(/(\.[^./]+)?$/, (x) => `-${k++}${x}`);
    mkdirSync(dirname(destino), { recursive: true });
    renameSync(f.abs, destino);
    movidos.push(f.rel);
  }
  // Las subcarpetas de CONTEXTO/ que se han quedado vacías se quitan (procesado/ no).
  const limpiar = (dir) => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (p === r.procesado) continue;
      try { if (statSync(p).isDirectory()) { limpiar(p); if (!readdirSync(p).length) rmdirSync(p); } } catch { /* sin permisos: se deja */ }
    }
  };
  if (movidos.length) limpiar(r.contexto);
  return { movidos, quedan };
}

// ── cerrar ───────────────────────────────────────────────────────────────────────────────
export async function cerrar(carpeta, { hoy = hoyISO(), forzar = false } = {}) {
  const r = rutas(carpeta);
  const imp = leerImportacion(r);
  if (!imp) return { errores: ["no hay importación que cerrar"] };
  const pendientes = imp.lotes.filter((l) => l.estado !== "hecho");
  if (pendientes.length && !forzar) return { errores: [`faltan lotes por guardar: ${pendientes.map((l) => l.n).join(", ")}`] };
  return conCerrojo(r.gymhub, async () => {
    const proc = leerProcesados(r);
    const ahora = new Date().toISOString();
    for (const id of imp.automaticos || []) {
      const e = imp.elementos[id];
      if (e && !proc.elementos[e.hash]) proc.elementos[e.hash] = { id, fichero: e.fichero, estado: "ignorado", fecha: ahora, sesiones: [], motivo: e.motivo };
    }
    escribirJSON(r.procesados, proc);
    const { movidos, quedan } = moverProcesados(carpeta, imp, proc, hoy);
    const datos = await derivarCarpeta(carpeta, { md: true, hoy });
    const c = contexto(carpeta, { hoy });
    const antes = new Set(imp.prs_antes || []);
    const nuevas = new Set((imp.sesiones_nuevas || []));
    const rutasNuevas = c.base.sesiones.filter((s) => nuevas.has(s.ruta));
    const prsNuevos = c.base.prs.filter((p) => !antes.has(`${p.fecha}|${p.id}`) && rutasNuevas.some((s) => s.fecha === p.fecha));
    const fechas = rutasNuevas.map((s) => s.fecha).sort();
    const dudas = contarDudas(r);
    imp.estado = "cerrada";
    imp.ultimo_refresh = ahora;
    imp.cierre = { movidos, quedan, sesiones: rutasNuevas.length, prs: prsNuevos.length, dudas };
    escribirJSON(r.importacion, imp);
    const mensaje = `Listo · ${rutasNuevas.length} sesi${rutasNuevas.length === 1 ? "ón nueva" : "ones nuevas"} · ${prsNuevos.length} PR${prsNuevos.length === 1 ? "" : "s"} · ${dudas} duda${dudas === 1 ? "" : "s"}`;
    ponerProceso(carpeta, {
      activo: false, fase: "listo", lote: imp.lotes.length, lotes_total: imp.lotes.length, pct: 100, mensaje, dudas,
      terminado: ahora, prs_nuevos: prsNuevos.map((p) => ({ fecha: p.fecha, id: p.id, nombre: p.nombre, texto: p.texto })),
    });
    await derivarCarpeta(carpeta, { hoy });
    publicar(carpeta);
    return { errores: [], mensaje, movidos, quedan, sesiones: rutasNuevas.length, rango: fechas.length ? [fechas[0], fechas.at(-1)] : null, prs: prsNuevos, dudas, errores_sesiones: datos.errores, sugerencia: sugerenciaRepaso(c) };
  });
}

// ── Subcomandos ──────────────────────────────────────────────────────────────────────────
registrar("refresh", "preparar | muestra [n] | lote <n> | guardar <n|directo> (stdin) | cerrar [--forzar] | estado", async ({ pos, op }) => {
  const carpeta = carpetaObligatoria(op);
  const r = rutas(carpeta);
  const [accion = "estado", arg] = pos;
  if (accion === "preparar") { console.log(textoPreparar(carpeta, preparar(carpeta))); return 0; }
  if (accion === "estado") {
    const imp = leerImportacion(r);
    if (!imp) { console.log("No hay ninguna importación todavía. Usa «refresh preparar»."); return 0; }
    console.log(textoPreparar(carpeta, { reanudada: imp.estado === "en_curso", imp }) + (imp.estado === "cerrada" ? `\nÚltima importación cerrada · último refresh ${imp.ultimo_refresh ?? "—"}` : ""));
    return 0;
  }
  const imp = leerImportacion(r);
  if (accion === "muestra") {
    if (!imp || imp.estado !== "en_curso") { console.log("No hay importación en curso."); return 2; }
    const todos = imp.lotes.flatMap((l) => l.ids);
    const n = Math.min(Number(arg) || 30, todos.length);
    const paso = todos.length / n;
    const ids = Array.from({ length: n }, (_, i) => todos[Math.floor(i * paso)]);
    imp.muestreo.hecho = true;
    escribirJSON(r.importacion, imp);
    console.log([`MUESTRA: ${n} de ${todos.length} elementos, repartidos en el tiempo. Úsala para escribir convenciones.md (escribir convenciones.md) y resolver de golpe las preguntas generales. No guardes sesiones con esto.`, "",
      ...ids.map((id) => textoElemento(imp.elementos[id], { recorte: 1200 }))].join("\n\n"));
    return 0;
  }
  if (accion === "lote") {
    if (!imp || imp.estado !== "en_curso") { console.log("No hay importación en curso. Empieza con «refresh preparar»."); return 2; }
    const lote = arg === "siguiente" || !arg ? imp.lotes.find((l) => l.estado !== "hecho") : imp.lotes.find((l) => String(l.n) === String(arg));
    if (!lote) { console.log(arg ? `No existe el lote ${arg}.` : "No quedan lotes: «refresh cerrar»."); return 2; }
    const hechos = imp.lotes.filter((l) => l.estado === "hecho").length;
    ponerProceso(carpeta, { activo: true, fase: "normalizando", lote: lote.n, lotes_total: imp.lotes.length, pct: Math.round((hechos / imp.lotes.length) * 100), mensaje: `Normalizando · lote ${lote.n} de ${imp.lotes.length} (${lote.etiqueta})`, dudas: contarDudas(r) });
    publicar(carpeta);
    console.log(textoLote(carpeta, imp, lote));
    return 0;
  }
  if (accion === "guardar") {
    if (!arg) { console.log("Falta el número de lote (o «directo»)."); return 2; }
    // Por stdin (heredoc) o, si el heredoc no pasa, desde un fichero dentro de .gymhub/entrada/.
    let entrada;
    if (op.fichero && op.fichero !== true) {
      const f = rutaSegura(carpeta, op.fichero);
      if (!existsSync(f)) { console.log(`No existe ${op.fichero}`); return 2; }
      entrada = readFileSync(f, "utf8");
    } else entrada = readFileSync(0, "utf8");
    const res = guardar(carpeta, arg, entrada);
    if (res.errores.length) {
      console.log(`NO SE HA GUARDADO NADA. Corrige y vuelve a enviar el lote ${arg} completo:\n- ${res.errores.join("\n- ")}`);
      return 2;
    }
    const { resultado, imp: impN } = res;
    ponerProceso(carpeta, { fase: "calculando", mensaje: "Calculando…" });
    await derivarCarpeta(carpeta);
    if (impN) {
      const hechos = impN.lotes.filter((l) => l.estado === "hecho").length;
      const sig = impN.lotes.find((l) => l.estado !== "hecho");
      ponerProceso(carpeta, { activo: true, fase: "normalizando", lote: Number(arg), lotes_total: impN.lotes.length, pct: Math.round((hechos / impN.lotes.length) * 100), mensaje: `Normalizando · lote ${arg} de ${impN.lotes.length} guardado`, dudas: contarDudas(r) });
      publicar(carpeta);
      console.log([`Lote ${arg} guardado: ${resultado.escritas.length} sesiones escritas${resultado.omitidas.length ? `, ${resultado.omitidas.length} ya existían igual` : ""}${resultado.duplicadas.length ? `, ${resultado.duplicadas.length} como -2 (anotadas en revision.md)` : ""}${resultado.ignorados ? `, ${resultado.ignorados} elementos ignorados` : ""}.`,
        ...resultado.otros.map((x) => `- ${x}`), sig ? `SIGUIENTE: refresh lote ${sig.n}` : "SIGUIENTE: refresh cerrar"].join("\n"));
    } else {
      publicar(carpeta);
      console.log(`Guardado: ${resultado.escritas.join(", ") || "nada nuevo"}${resultado.omitidas.length ? ` (ya existían igual: ${resultado.omitidas.join(", ")})` : ""}.${resultado.otros.length ? "\n- " + resultado.otros.join("\n- ") : ""}`);
    }
    return 0;
  }
  if (accion === "cerrar") {
    const res = await cerrar(carpeta, { forzar: !!op.forzar });
    if (res.errores.length) { console.log(`No se puede cerrar: ${res.errores.join("; ")}`); return 2; }
    console.log([res.mensaje, res.rango ? `Fechas: ${res.rango[0]} → ${res.rango[1]}` : null,
      res.prs.length ? `PRs: ${res.prs.map((p) => `${p.nombre} ${p.texto} (${p.fecha})`).join(" · ")}` : null,
      res.movidos.length ? `Movido a CONTEXTO/procesado/: ${res.movidos.length} ficheros` : null,
      res.quedan.length ? `Se quedan en CONTEXTO/ (con elementos sin procesar): ${res.quedan.join(", ")}` : null,
      res.errores_sesiones?.length ? `AVISO: ${res.errores_sesiones.length} sesiones con errores no cuentan: ${res.errores_sesiones.map((e) => e.ruta).join(", ")}` : null,
      res.sugerencia ? `SUGERENCIA (termina tu respuesta con esta línea): ${res.sugerencia}` : null,
    ].filter(Boolean).join("\n"));
    return 0;
  }
  console.log(`Acción desconocida: ${accion}`);
  return 2;
});

registrar("catalogo", "lista compacta del catálogo de ejercicios (id · nombre · alias · grupo · carga · patrón)", ({ op }) => {
  const carpeta = carpetaObligatoria(op);
  const c = leerCatalogo(leerTexto(rutas(carpeta).ejercicios, ""));
  for (const e of c.ejercicios.values()) console.log(`${e.id} · ${e.nombre}${e.alias.length ? ` (${e.alias.join(", ")})` : ""} · ${e.grupo} · ${e.carga} · ${e.patron}`);
  return 0;
});

registrar("contexto", "lo que Claude necesita para normalizar: convenciones.md del usuario y el catálogo", ({ op }) => {
  const carpeta = carpetaObligatoria(op);
  const r = rutas(carpeta);
  const conv = leerTexto(r.convenciones, "");
  console.log(`## convenciones.md de esta persona${convencionesVacias(conv) ? " (todavía vacío)" : ""}\n\n${conv.trim()}\n`);
  const c = leerCatalogo(leerTexto(r.ejercicios, ""));
  for (const a of leerConvenciones(conv, c).avisos) console.log(`AVISO: ${a}. Corrígelo en convenciones.md (escribir convenciones.md).\n`);
  console.log(`## Catálogo de ejercicios (${c.ejercicios.size}): id · nombre (alias) · grupo · carga · patrón\n`);
  for (const e of c.ejercicios.values()) console.log(`${e.id} · ${e.nombre}${e.alias.length ? ` (${e.alias.join(", ")})` : ""} · ${e.grupo} · ${e.carga} · ${e.patron}`);
  return 0;
});
