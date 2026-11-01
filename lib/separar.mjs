// separar (FORMATO §3.1): CONTEXTO/ → elementos con hash. Determinista: no interpreta el
// entreno, solo corta el material en trozos (un bloque de texto, un mensaje, un día de un CSV,
// una imagen) y da pistas de fecha para agruparlos por meses. Claude normaliza cada elemento.
import { readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import { join, relative, extname, basename, dirname } from "node:path";
import { createHash } from "node:crypto";
import { normalizarParaHash, sha256, fechaISO } from "./util.mjs";
import { celda } from "./canonico.mjs";

const IMAGENES = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".gif", ".bmp"];
const MULTIMEDIA = [".mp3", ".m4a", ".ogg", ".opus", ".wav", ".mp4", ".mov", ".avi", ".webm", ".3gp"];
const TEXTO = [".md", ".txt", ".markdown", ".text", ""];
const IGNORAR = new Set(["LEEME.md", "README.md", ".DS_Store", "Thumbs.db", "desktop.ini"]);

const MESES = {
  ene: 1, enero: 1, feb: 2, febrero: 2, mar: 3, marzo: 3, abr: 4, abril: 4, may: 5, mayo: 5, jun: 6, junio: 6,
  jul: 7, julio: 7, ago: 8, agosto: 8, sep: 9, sept: 9, septiembre: 9, set: 9, setiembre: 9, oct: 10, octubre: 10,
  nov: 11, noviembre: 11, dic: 12, diciembre: 12,
  jan: 1, january: 1, february: 2, march: 3, apr: 4, april: 4, june: 6, july: 7, aug: 8, august: 8,
  september: 9, october: 10, november: 11, dec: 12, december: 12,
};
const RE_MES = Object.keys(MESES).sort((a, b) => b.length - a.length).join("|");
const DIA_SEMANA = "(?:lunes|martes|mi[ée]rcoles|jueves|viernes|s[áa]bado|domingo|lun|mar|mi[ée]|jue|vie|s[áa]b|dom|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\\.?";

const sinTildes = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const anio4 = (a) => (a === undefined || a === null ? null : a.length === 2 ? 2000 + Number(a) : Number(a));
const valida = (a, m, d) => m >= 1 && m <= 12 && d >= 1 && d <= 31 && (a === null || (a >= 1990 && a <= 2100));

/**
 * Busca una fecha al principio de `linea` (o en cualquier sitio si es una cabecera).
 * Devuelve { texto, anio, mes, dia, ambigua, orden } o null. `orden` es el de la convención
 * del fichero ("dm" | "md" | null) para resolver 03/04.
 */
export function fechaEnLinea(linea, { cabecera = false, orden = null } = {}) {
  let l = sinTildes(linea.trim().replace(/^[#>*\-•\s]+/, "").replace(/\*\*/g, "")).toLowerCase();
  l = l.replace(new RegExp(`^${DIA_SEMANA}[,\\s]+`), "").replace(/^d[ií]a\s+(?=\d)/, "");
  const intentos = cabecera ? [l, ...[...l.matchAll(/[\s(—–\-·:,]+(?=\d|[a-z])/g)].map((m) => l.slice(m.index + m[0].length))] : [l];
  for (const t of intentos) {
    const f = fechaAlPrincipio(t, orden);
    if (f) return f;
  }
  return null;
}

function fechaAlPrincipio(l, orden) {
  const fin = "(?=$|[\\s,.:;)\\]—–-](?!\\d))";
  let m = l.match(new RegExp(`^(\\d{4})-(\\d{1,2})-(\\d{1,2})${fin}`));
  if (m && valida(+m[1], +m[2], +m[3])) return { texto: m[0], anio: +m[1], mes: +m[2], dia: +m[3], ambigua: false };
  m = l.match(new RegExp(`^(\\d{1,2})[/.\\-](\\d{1,2})(?:[/.\\-](\\d{4}|\\d{2}))?${fin}`));
  if (m && !/^\d{1,2}[/.\-]\d{1,2}[/.\-]\d$/.test(l.slice(0, m[0].length + 2).trim())) {
    const a = anio4(m[3]), x = +m[1], y = +m[2];
    if (x > 12 && valida(a, y, x)) return { texto: m[0], anio: a, mes: y, dia: x, ambigua: false, orden: "dm" };
    if (y > 12 && valida(a, x, y)) return { texto: m[0], anio: a, mes: x, dia: y, ambigua: false, orden: "md" };
    if (valida(a, y, x)) {
      if (orden === "md") return { texto: m[0], anio: a, mes: x, dia: y, ambigua: false }; // lo decide convenciones.md
      return { texto: m[0], anio: a, mes: y, dia: x, ambigua: x !== y && orden !== "dm" };
    }
  }
  m = l.match(new RegExp(`^(\\d{1,2})(?:st|nd|rd|th|º|o)?\\s*(?:de\\s+|of\\s+|[-–]\\s*)?(${RE_MES})\\.?(?:,?\\s+(?:de\\s+)?(\\d{4}))?${fin}`));
  if (m && valida(anio4(m[3]), MESES[m[2]], +m[1])) return { texto: m[0], anio: anio4(m[3]), mes: MESES[m[2]], dia: +m[1], ambigua: false };
  m = l.match(new RegExp(`^(${RE_MES})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?${fin}`));
  if (m && valida(anio4(m[3]), MESES[m[1]], +m[2])) return { texto: m[0], anio: anio4(m[3]), mes: MESES[m[1]], dia: +m[2], ambigua: false };
  return null;
}

/** Año del contenedor: el del nombre del fichero, el de las primeras líneas o el de su fecha. */
function anioContenedor(rel, texto, mtime) {
  const n = basename(rel).match(/(?:^|\D)((?:19|20)\d{2})(?:\D|$)/) || rel.match(/(?:^|\D)((?:19|20)\d{2})(?:\D|$)/);
  if (n) return { anio: +n[1], origen: "nombre" };
  const cab = texto.split("\n").slice(0, 3).join(" ").match(/\b((?:19|20)\d{2})\b/);
  if (cab) return { anio: +cab[1], origen: "cabecera" };
  return { anio: mtime.getFullYear(), origen: "fecha del fichero" };
}

const iso = (a, m, d) => `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const idDe = (hash) => hash.slice(0, 10);

function elemento(base, texto, extra = {}) {
  // En un mensaje, la fecha y la hora son parte de su identidad: «hoy pierna» puede repetirse.
  const clave = base.tipo === "mensaje" || (base.hora && base.fecha_pista && base.tipo !== "csv") ? `${base.fecha_pista} ${base.hora} ${texto}` : texto;
  const hash = sha256(normalizarParaHash(clave));
  return { id: idDe(hash), hash, texto, ...base, ...extra };
}

/** Orden de fecha que se deduce de las fechas sin ambigüedad del mismo material. */
function ordenDelTexto(lineas) {
  let dm = 0, md = 0;
  for (const l of lineas) {
    const f = fechaEnLinea(l);
    if (f?.orden === "dm") dm++;
    if (f?.orden === "md") md++;
  }
  return dm && !md ? "dm" : md && !dm ? "md" : null;
}

// ── Texto ────────────────────────────────────────────────────────────────────────────────
export function separarTexto(texto, { rel, mtime = new Date(), orden = null }) {
  const t = texto.replace(/\r\n?/g, "\n");
  const lineas = t.split("\n");
  const ordenFichero = orden ?? ordenDelTexto(lineas);
  const { anio: anioBase, origen } = anioContenedor(rel, t, mtime);
  const cortes = [];
  lineas.forEach((l, i) => {
    if (!l.trim()) return;
    const cabecera = /^\s{0,3}#{1,6}\s/.test(l) || (/^\s*\*\*.+\*\*\s*$/.test(l));
    if (!cabecera && l.trim().length > 80) return;
    const f = fechaEnLinea(l, { cabecera, orden: ordenFichero });
    if (f) cortes.push({ i, f });
  });
  const bloques = [];
  const empuja = (desde, hasta, f) => {
    const txt = lineas.slice(desde, hasta).join("\n").replace(/^\n+|\n+$/g, "");
    if (txt.trim()) bloques.push({ txt, f });
  };
  if (!cortes.length) empuja(0, lineas.length, null);
  else {
    empuja(0, cortes[0].i, null);
    cortes.forEach((c, k) => empuja(c.i, k + 1 < cortes.length ? cortes[k + 1].i : lineas.length, c.f));
  }
  // Un mes en el nombre del fichero («april-2025.txt», «2025-04.md») resuelve 4/2 frente a 2/4.
  const nombre = sinTildes(basename(rel)).toLowerCase();
  const mesNombre = (nombre.match(new RegExp(`(?:^|[^a-z])(${RE_MES})(?:[^a-z]|$)`)) || [])[1];
  const mesFichero = mesNombre ? MESES[mesNombre] : +((nombre.match(/(?:19|20)\d{2}[-_.](\d{2})(?:\D|$)/) || [])[1] || 0) || null;
  return bloques.map((b, k) => {
    let pista = null, ambigua = false;
    if (b.f?.ambigua && mesFichero && b.f.dia === mesFichero && b.f.mes !== mesFichero) b.f = { ...b.f, mes: b.f.dia, dia: b.f.mes, ambigua: false };
    else if (b.f?.ambigua && mesFichero && b.f.mes === mesFichero) b.f = { ...b.f, ambigua: false };
    if (b.f) {
      let a = b.f.anio ?? anioBase;
      if (b.f.anio === null && origen === "fecha del fichero") {
        // sin año escrito: la fecha más cercana anterior a la del fichero
        if (iso(a, b.f.mes, b.f.dia) > fechaISO(mtime)) a--;
      }
      pista = iso(a, b.f.mes, b.f.dia);
      ambigua = !!b.f.ambigua;
    }
    return elemento({ tipo: "texto", fichero: rel, n: k + 1, fecha_pista: pista, fecha_texto: b.f?.texto ?? null, fecha_ambigua: ambigua, contenedor: `${anioBase} (${origen})` }, b.txt);
  });
}

// ── Exports de chats ─────────────────────────────────────────────────────────────────────
const textoTelegram = (t) => (Array.isArray(t) ? t.map((x) => (typeof x === "string" ? x : x?.text ?? "")).join("") : String(t ?? ""));

export function separarTelegramJSON(json, { rel, dir }) {
  const mensajes = Array.isArray(json?.messages) ? json.messages : [];
  const out = [];
  let k = 0;
  for (const m of mensajes) {
    if (m.type && m.type !== "message") continue;
    k++;
    const texto = textoTelegram(m.text).trim();
    const fecha = String(m.date ?? "").slice(0, 10) || null;
    const hora = String(m.date ?? "").slice(11, 16) || null;
    const base = { tipo: "mensaje", fichero: rel, n: k, fecha_pista: fecha, hora, contenedor: `mensaje ${m.date ?? "sin fecha"}` };
    const foto = m.photo && existsSync(join(dir, m.photo)) ? join(dir, m.photo) : null;
    if (foto) out.push(elemento({ ...base, tipo: "imagen", imagen: foto }, `${texto}\n[imagen ${m.photo}]`, { texto_imagen: texto || null }));
    else if (texto) out.push(elemento(base, texto));
    else out.push(elemento({ ...base, tipo: "multimedia", motivo: `mensaje sin texto (${m.media_type || (m.file ? "archivo" : m.photo ? "foto" : "vacío")})` }, `multimedia ${rel} ${m.id ?? k} ${m.date ?? ""}`));
  }
  return out;
}

export function separarTelegramHTML(html, { rel }) {
  const out = [];
  let k = 0;
  for (const bloque of html.split(/<div class="message default/).slice(1)) {
    k++;
    const fecha = bloque.match(/class="pull_right date details" title="(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2})/);
    const texto = (bloque.match(/<div class="text">([\s\S]*?)<\/div>/)?.[1] ?? "")
      .replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").trim();
    const base = { tipo: "mensaje", fichero: rel, n: k, fecha_pista: fecha ? `${fecha[3]}-${fecha[2]}-${fecha[1]}` : null, hora: fecha ? `${fecha[4]}:${fecha[5]}` : null, contenedor: "mensaje de Telegram" };
    if (texto) out.push(elemento(base, texto));
    else out.push(elemento({ ...base, tipo: "multimedia", motivo: "mensaje sin texto" }, `multimedia ${rel} ${k} ${base.fecha_pista} ${base.hora}`));
  }
  return out;
}

const RE_WHATSAPP = /^\[?(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*(?:[ap]\.?\s?m\.?)?\]?\s*(?:-\s*)?([^:]{1,40}):\s?(.*)$/i;
export const esWhatsApp = (texto) => texto.split("\n").filter((l) => RE_WHATSAPP.test(l)).length >= 3;

export function separarWhatsApp(texto, { rel, orden = null, dir }) {
  const lineas = texto.replace(/\r\n?/g, "\n").replace(/[\u200e\u200f]/g, "").split("\n");
  const msgs = [];
  for (const l of lineas) {
    const m = l.match(RE_WHATSAPP);
    if (m) msgs.push({ a: +m[1], b: +m[2], anio: anio4(m[3]), hora: `${m[4].padStart(2, "0")}:${m[5]}`, texto: m[7] });
    else if (msgs.length) msgs.at(-1).texto += "\n" + l;
  }
  let ord = orden;
  if (!ord) {
    if (msgs.some((m) => m.a > 12)) ord = "dm";
    else if (msgs.some((m) => m.b > 12)) ord = "md";
  }
  return msgs.map((m, k) => {
    const [mes, dia] = ord === "md" ? [m.a, m.b] : [m.b, m.a];
    const base = { tipo: "mensaje", fichero: rel, n: k + 1, fecha_pista: iso(m.anio, mes, dia), hora: m.hora, fecha_ambigua: !ord && m.a !== m.b, contenedor: "mensaje de WhatsApp" };
    const t = m.texto.trim();
    if (/^<(multimedia omitido|media omitted|archivo omitido|imagen omitida|video omitido|audio omitido)>$/i.test(t) || /^(null|este mensaje fue eliminado|this message was deleted)$/i.test(t)) {
      return elemento({ ...base, tipo: "multimedia", motivo: "multimedia omitido" }, `multimedia ${rel} ${k + 1} ${base.fecha_pista} ${m.hora}`);
    }
    const adj = t.match(/^(.+\.(?:jpe?g|png|webp|heic))\s*\((?:archivo adjunto|file attached)\)/i);
    if (adj && existsSync(join(dir, adj[1]))) return elemento({ ...base, tipo: "imagen", imagen: join(dir, adj[1]) }, `[imagen ${adj[1]}]`);
    return elemento(base, t);
  });
}

// ── CSV de apps de entreno ───────────────────────────────────────────────────────────────
const COLUMNAS = {
  fecha: ["fecha", "date", "dia", "day", "fecha y hora", "datetime", "start time", "start_time"],
  entreno: ["entreno", "workout", "workout name", "rutina", "sesion", "session", "nombre del entreno", "titulo", "title"],
  ejercicio: ["ejercicio", "exercise", "exercise name", "exercise_title", "movimiento", "movement"],
  serie: ["serie", "set", "set order", "set number", "set_index", "n"],
  peso: ["peso", "weight", "carga", "load", "kg", "lbs", "lb", "weight kg", "weight (kg)", "weight (lbs)", "weight_kg", "weight_lbs", "peso (kg)", "peso kg"],
  unidad: ["unidad", "unit", "units", "weight unit"],
  reps: ["reps", "repeticiones", "repetitions", "rep"],
  segundos: ["segundos", "seconds", "duration (s)", "duration_seconds", "duracion (s)", "tiempo (s)", "time (s)"],
  distancia: ["distancia", "distance", "distance (km)", "distancia (km)", "distance_km"],
  rpe: ["rpe"],
  rir: ["rir"],
  notas: ["notas", "notes", "nota", "note", "comentario", "comments"],
  tipo: ["tipo", "set type", "set_type", "type"],
};

function trocearCSV(texto) {
  const lineas = texto.replace(/^\ufeff/, "").replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim());
  const cab = lineas[0] ?? "";
  const sep = [";", "\t", ","].map((s) => [s, cab.split(s).length]).sort((a, b) => b[1] - a[1])[0][0];
  const partir = (l) => {
    const out = []; let cur = "", q = false;
    for (let i = 0; i < l.length; i++) {
      const ch = l[i];
      if (ch === '"') { if (q && l[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (ch === sep && !q) { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out.map((c) => c.trim());
  };
  return { cab: partir(cab), filas: lineas.slice(1).map((l, i) => ({ celdas: partir(l), linea: lineas[i + 1] })), lineaCab: cab };
}

export function mapearColumnas(cab) {
  const norm = cab.map((c) => sinTildes(c).toLowerCase().replace(/\s+/g, " ").trim());
  const mapa = {};
  for (const [campo, nombres] of Object.entries(COLUMNAS)) {
    const i = norm.findIndex((c, j) => nombres.includes(c) && !Object.values(mapa).includes(j));
    if (i >= 0) mapa[campo] = i;
  }
  if (mapa.peso === undefined) {
    const i = norm.findIndex((c) => /^(peso|weight)/.test(c));
    if (i >= 0) mapa.peso = i;
  }
  return { mapa, unidadCab: mapa.peso !== undefined ? (/lb/.test(norm[mapa.peso]) ? "lb" : /kg/.test(norm[mapa.peso]) ? "kg" : null) : null };
}

const numCSV = (s) => { const t = String(s ?? "").trim().replace(",", "."); return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null; };
function fechaCSV(s, orden) {
  const t = String(s ?? "").trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/);
  if (m) { const a = anio4(m[3]); const [mes, dia] = orden === "md" || (+m[2] > 12) ? [+m[1], +m[2]] : [+m[2], +m[1]]; return iso(a, mes, dia); }
  const f = fechaEnLinea(t);
  return f && f.anio ? iso(f.anio, f.mes, f.dia) : null;
}

/** Un elemento por día (y entreno) con un borrador determinista en el formato estándar. */
export function separarCSV(texto, { rel, orden = null }) {
  const { cab, filas, lineaCab } = trocearCSV(texto);
  const { mapa, unidadCab } = mapearColumnas(cab);
  if (mapa.fecha === undefined || mapa.ejercicio === undefined) return null; // no parece un export de entrenos
  const get = (f, campo) => (mapa[campo] === undefined ? "" : f.celdas[mapa[campo]] ?? "");
  const ordenCSV = orden ?? (filas.some((f) => /^\d{1,2}[/.\-](\d{1,2})/.test(get(f, "fecha")) && +get(f, "fecha").split(/[/.\-]/)[0] > 12) ? "dm" : null);
  const grupos = new Map();
  for (const f of filas) {
    const fecha = fechaCSV(get(f, "fecha"), ordenCSV);
    const clave = `${fecha}|${get(f, "entreno")}`;
    if (!grupos.has(clave)) grupos.set(clave, { fecha, entreno: get(f, "entreno"), hora: (get(f, "fecha").match(/\d{1,2}:\d{2}/) || [null])[0], filas: [] });
    grupos.get(clave).filas.push(f);
  }
  let k = 0;
  return [...grupos.values()].map((g) => {
    k++;
    const crudo = [lineaCab, ...g.filas.map((f) => f.linea)].join("\n");
    const ejercicios = new Map();
    for (const f of g.filas) {
      const nombre = get(f, "ejercicio");
      if (!ejercicios.has(nombre)) ejercicios.set(nombre, []);
      const peso = numCSV(get(f, "peso"));
      const unidad = (get(f, "unidad").toLowerCase().startsWith("lb") ? "lb" : null) ?? unidadCab ?? "kg";
      const reps = numCSV(get(f, "reps"));
      const seg = numCSV(get(f, "segundos"));
      const tipoApp = get(f, "tipo").toLowerCase();
      const tipo = /warm|calent/.test(tipoApp) ? "calentamiento" : /drop/.test(tipoApp) ? "dropset" : /fail|fallo|amrap/.test(tipoApp) ? "amrap" : "trabajo";
      ejercicios.get(nombre).push({
        tipo, carga: peso !== null && peso > 0 ? `${peso} ${unidad}` : "", reps: reps !== null && reps > 0 ? String(reps) : seg ? `${seg}s` : "",
        rpe: numCSV(get(f, "rpe")) ?? "", rir: numCSV(get(f, "rir")) ?? "", nota: [get(f, "notas"), numCSV(get(f, "distancia")) ? `${get(f, "distancia")} km` : ""].filter(Boolean).join(" · "),
      });
    }
    const md = [`---`, `fecha: ${g.fecha ?? "?"}`, `titulo: ${g.entreno || "Entreno"}`, `tipo: ?`, g.hora ? `inicio: "${g.hora}"` : null, `fuente: "${rel} · día ${k}"`, `confianza: alta`, `---`, "", `# ${g.fecha} · ${g.entreno || "Entreno"}`, "", "## Ejercicios", ""].filter((x) => x !== null);
    for (const [nombre, series] of ejercicios) {
      md.push(`### ${nombre}`, "<!-- id: ? -->", "| # | tipo | carga | reps | rpe | rir | nota |", "|---|---|---|---|---|---|---|");
      series.forEach((x, i) => md.push(`| ${i + 1} | ${x.tipo} | ${celda(x.carga)} | ${celda(x.reps)} | ${x.rpe} | ${x.rir} | ${celda(x.nota)} |`));
      md.push("");
    }
    return elemento({ tipo: "csv", fichero: rel, n: k, fecha_pista: g.fecha, hora: g.hora, contenedor: "fila de CSV", borrador: md.join("\n") }, crudo);
  });
}

// ── Recorrer CONTEXTO/ ───────────────────────────────────────────────────────────────────
function hashFichero(p) { return createHash("sha256").update(readFileSync(p)).digest("hex"); }

/** Todos los ficheros de CONTEXTO/ salvo procesado/ y los ignorables. */
export function ficherosContexto(contexto) {
  const out = [];
  if (!existsSync(contexto)) return out;
  const recorrer = (dir) => {
    for (const n of readdirSync(dir).sort()) {
      if (n.startsWith(".") || IGNORAR.has(n)) continue;
      const p = join(dir, n);
      const st = statSync(p);
      if (st.isDirectory()) { if (relative(contexto, p) !== "procesado") recorrer(p); }
      else out.push({ abs: p, rel: relative(contexto, p).split("\\").join("/"), mtime: st.mtime, size: st.size });
    }
  };
  recorrer(contexto);
  return out;
}

/**
 * Separa todo CONTEXTO/. Devuelve { elementos, ficheros: [{rel, tipo, elementos}] }.
 * `orden` ("dm" | "md") viene de convenciones.md, si está definido.
 */
export function separarContexto(contexto, { orden = null } = {}) {
  const elementos = [], ficheros = [];
  // Las imágenes que cuelgan de un export de chat se leen desde su mensaje, no sueltas.
  const usadas = new Set();
  const lista = ficherosContexto(contexto);
  const porTipo = (f) => {
    const ext = extname(f.rel).toLowerCase();
    const rel = "CONTEXTO/" + f.rel;
    if (MULTIMEDIA.includes(ext)) return [elemento({ tipo: "multimedia", fichero: rel, n: 1, fecha_pista: fechaISO(f.mtime), motivo: `audio o vídeo (${ext})` }, `multimedia ${rel} ${hashFichero(f.abs)}`)];
    if (IMAGENES.includes(ext)) return [elemento({ tipo: "imagen", fichero: rel, n: 1, imagen: f.abs, fecha_pista: fechaISO(f.mtime), contenedor: `fecha del fichero ${fechaISO(f.mtime)}` }, `imagen ${hashFichero(f.abs)}`)];
    if (f.size > 20 * 1024 * 1024) return [elemento({ tipo: "otro", fichero: rel, n: 1, ruta: f.abs }, `otro ${rel} ${f.size}`)];
    const bruto = readFileSync(f.abs, "utf8");
    if (ext === ".json") {
      try {
        const j = JSON.parse(bruto);
        if (Array.isArray(j?.messages)) {
          for (const m of j.messages) if (m.photo) usadas.add(join(dirname(f.abs), m.photo));
          return separarTelegramJSON(j, { rel, dir: dirname(f.abs) });
        }
      } catch { /* no es JSON válido */ }
      return [elemento({ tipo: "otro", fichero: rel, n: 1, ruta: f.abs }, bruto)];
    }
    if (ext === ".html" || ext === ".htm") {
      if (/class="message default/.test(bruto)) return separarTelegramHTML(bruto, { rel });
      const plano = bruto.replace(/<(script|style)[\s\S]*?<\/\1>/gi, "").replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr)>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
      return separarTexto(plano, { rel, mtime: f.mtime, orden });
    }
    if (ext === ".csv" || ext === ".tsv") {
      const csv = separarCSV(bruto, { rel, orden });
      if (csv) return csv;
      return [elemento({ tipo: "otro", fichero: rel, n: 1, ruta: f.abs }, bruto)];
    }
    if (TEXTO.includes(ext)) {
      if (esWhatsApp(bruto)) {
        for (const l of bruto.split("\n")) { const a = l.match(/([^:\s]+\.(?:jpe?g|png|webp|heic))\s*\((?:archivo adjunto|file attached)\)/i); if (a) usadas.add(join(dirname(f.abs), a[1])); }
        return separarWhatsApp(bruto, { rel, orden, dir: dirname(f.abs) });
      }
      return separarTexto(bruto, { rel, mtime: f.mtime, orden });
    }
    return [elemento({ tipo: "otro", fichero: rel, n: 1, ruta: f.abs }, `otro ${rel} ${hashFichero(f.abs)}`)];
  };
  // Primero los que no son imágenes, para saber qué imágenes van dentro de un chat.
  const orden_ = [...lista].sort((a, b) => Number(IMAGENES.includes(extname(a.rel).toLowerCase())) - Number(IMAGENES.includes(extname(b.rel).toLowerCase())));
  for (const f of orden_) {
    if (usadas.has(f.abs)) { ficheros.push({ rel: "CONTEXTO/" + f.rel, abs: f.abs, tipo: "adjunto", elementos: [] }); continue; }
    const els = porTipo(f);
    ficheros.push({ rel: "CONTEXTO/" + f.rel, abs: f.abs, tipo: els[0]?.tipo ?? "vacio", elementos: els.map((e) => e.id) });
    elementos.push(...els);
  }
  return { elementos, ficheros };
}
