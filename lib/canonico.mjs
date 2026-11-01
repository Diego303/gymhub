// Formato estándar de una sesión (FORMATO.md §2): parser, validador y serializador.
// sesiones/AAAA/AAAA-MM-DD.md es la fuente de verdad; esto es lo único que la interpreta.

export const TIPOS_SERIE = ["calentamiento", "aproximacion", "trabajo", "top", "backoff", "amrap", "dropset", "myo", "cluster", "no_hecho"];
export const TIPOS_TRABAJO = ["trabajo", "top", "backoff", "amrap", "dropset", "myo", "cluster"];
export const TIPOS_SESION = ["pecho", "espalda", "pierna", "hombro", "brazo", "torso", "pierna-gluteo", "empuje", "tiron", "full", "cardio", "movilidad", "deporte", "mixto"];
export const ESTADOS_MOLESTIA = ["bien", "molestia", "dolor"];
export const LADOS = ["izq", "der", "ambos", null];
const CLAVES_FRONTMATTER = ["fecha", "titulo", "tipo", "programa", "semana_programa", "inicio", "fin", "duracion_min", "sueno_h",
  "sensacion_pre", "sensacion_post", "peso_corporal_kg", "molestias", "fuente", "confianza"];
export const LB_A_KG = 0.4536;

const numero = (s) => {
  const t = String(s ?? "").trim().replace(/(\d)['’](\d)/g, "$1.$2").replace(/(\d),(\d)/g, "$1.$2").replace("½", ".5");
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null;
};

// ── YAML mínimo (el subconjunto que usa el frontmatter) ──────────────────────────────────
function escalar(v) {
  let s = v.trim();
  // Entre comillas (y quizá un comentario detrás): las dobles admiten los escapes de JSON (\\, \t, \n, \").
  let q = s.match(/^"((?:[^"\\]|\\.)*)"\s*(?:#.*)?$/s);
  if (q) { try { return JSON.parse(`"${q[1]}"`); } catch { return q[1].replace(/\\"/g, '"'); } }
  q = s.match(/^'((?:[^']|'')*)'\s*(?:#.*)?$/s);
  if (q) return q[1].replace(/''/g, "'");
  s = s.replace(/\s+#.*$/, "").trim();
  if (s === "" || s === "null" || s === "~") return null;
  if (s === "true") return true;
  if (s === "false") return false;
  if (/^\[.*\]$/.test(s)) return s.slice(1, -1).split(",").map((x) => escalar(x)).filter((x) => x !== null);
  const n = numero(s);
  return n !== null && !/^0\d/.test(s) ? n : s;
}

export function leerYAML(texto) {
  const out = {};
  const lineas = texto.replace(/\r/g, "").split("\n");
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    if (!l.trim() || /^\s*#/.test(l)) continue;
    // [\s\S] y no «.»: un valor puede llevar U+2028/U+2029, que «.» no casa
    const m = l.match(/^([A-Za-z_][\w-]*)\s*:\s*([\s\S]*)$/);
    if (!m) continue;
    const [, clave, resto] = m;
    if (resto.replace(/\s+#.*$/, "").trim() !== "") { out[clave] = escalar(resto); continue; }
    // Lista de mapas o de escalares en las líneas siguientes
    const items = [];
    let actual = null;
    while (i + 1 < lineas.length && (/^\s+\S/.test(lineas[i + 1]) || lineas[i + 1].trim() === "")) {
      const s = lineas[++i];
      if (!s.trim()) continue;
      const item = s.match(/^\s*-\s*(.*)$/s);
      if (item) {
        const kv = item[1].match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/s);
        if (kv) { actual = { [kv[1]]: escalar(kv[2]) }; items.push(actual); }
        else { actual = null; items.push(escalar(item[1])); }
      } else {
        const kv = s.match(/^\s*([A-Za-z_][\w-]*)\s*:\s*(.*)$/s);
        if (kv && actual) actual[kv[1]] = escalar(kv[2]);
      }
    }
    out[clave] = items.length ? items : null;
  }
  return out;
}

const yamlValor = (v) => {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; // fechas sin comillas, como en FORMATO.md
  // Sin comillas solo lo que se lee igual: sin espacios en los extremos y que no parezca un número ni un valor especial.
  const bare = /^[\w.\-áéíóúñÁÉÍÓÚÑ ]+$/.test(s) && !/^\d/.test(s) && s === s.trim() && numero(s) === null && !["null", "true", "false", "~"].includes(s);
  return bare ? s : JSON.stringify(s).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
};

export function escribirYAML(obj) {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) {
      if (!v.length) { out.push(`${k}: []`); continue; }
      out.push(`${k}:`);
      for (const it of v) {
        if (it && typeof it === "object") {
          const ents = Object.entries(it);
          ents.forEach(([kk, vv], j) => out.push(`${j === 0 ? "  - " : "    "}${kk}: ${yamlValor(vv)}`));
        } else out.push(`  - ${yamlValor(it)}`);
      }
    } else out.push(`${k}: ${yamlValor(v)}`);
  }
  return out.join("\n");
}

// ── Carga y repeticiones (FORMATO §2.1) ──────────────────────────────────────────────────
export function leerCarga(texto) {
  const t = String(texto ?? "").trim();
  if (!t) return { tipo: "vacia", texto: t };
  let m = t.match(/^(\d+(?:[.,'’]\d+)?|\d+½)\s*(kg|lb|lbs)(?:\s*\/\s*(lado|mano))?$/i);
  if (m) return { tipo: "peso", texto: t, valor: numero(m[1]), unidad: /lb/i.test(m[2]) ? "lb" : "kg", por: m[3]?.toLowerCase() ?? null };
  if (/^PC$/i.test(t)) return { tipo: "pc", texto: t, extra: 0, unidad: "kg" };
  m = t.match(/^PC\s*([+\-−])\s*(\d+(?:[.,]\d+)?)\s*(kg|lb)?$/i);
  if (m) {
    const v = numero(m[2]) * (/lb/i.test(m[3] || "") ? LB_A_KG : 1);
    return { tipo: "pc", texto: t, extra: m[1] === "+" ? v : -v, unidad: "kg" };
  }
  m = t.match(/^banda\s+(.+)$/is);
  if (m) {
    const kg = m[1].match(/^(\d+(?:[.,]\d+)?)\s*kg$/i);
    return { tipo: "banda", texto: t, color: kg ? null : m[1].trim(), kg: kg ? numero(kg[1]) : null };
  }
  m = t.match(/^nivel\s+(\d+(?:[.,]\d+)?)$/i);
  if (m) return { tipo: "nivel", texto: t, valor: numero(m[1]) };
  m = t.match(/^(\d+(?:[.,]\d+)?)\s*%\s*1RM$/i);
  if (m) return { tipo: "pct", texto: t, valor: numero(m[1]) };
  return { tipo: "error", texto: t };
}

export function leerReps(texto) {
  const t = String(texto ?? "").trim();
  if (!t) return { tipo: "vacia", texto: t };
  if (/^\d+$/.test(t)) return { tipo: "n", texto: t, n: Number(t) };
  let m = t.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (m) return { tipo: "lados", texto: t, n: Number(m[1]) + Number(m[2]), min: Math.min(Number(m[1]), Number(m[2])) };
  if (/^fallo$/i.test(t)) return { tipo: "fallo", texto: t };
  m = t.match(/^(\d+(?:[.,]\d+)?)\s*s$/i);
  if (m) return { tipo: "tiempo", texto: t, s: numero(m[1]) };
  m = t.match(/^(\d+(?:[.,]\d+)?)\s*min$/i);
  if (m) return { tipo: "tiempo", texto: t, s: numero(m[1]) * 60 };
  m = t.match(/^(\d+(?:[.,]\d+)?)\s*(m|km)$/i);
  if (m) return { tipo: "distancia", texto: t, m: numero(m[1]) * (m[2].toLowerCase() === "km" ? 1000 : 1) };
  return { tipo: "error", texto: t };
}

// ── Tablas Markdown ──────────────────────────────────────────────────────────────────────
// Una «|» dentro de una celda se escribe «\|» (como en GitHub) y se lee entera.
const celdas = (l) => l.trim().replace(/^\|/, "").replace(/(?<!\\)\|$/, "").split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));
export const celda = (v) => String(v ?? "").replace(/\|/g, "\\|");
const esSeparador = (c) => c.every((x) => /^:?-{2,}:?$/.test(x));
const claveCol = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, "_");

/** Lee una tabla desde `desde`. Cada fila lleva su línea (`_linea`, índice en `lineas`) y si le sobran celdas. */
function leerTabla(lineas, desde) {
  const filas = [];
  let i = desde, cab = null;
  while (i < lineas.length && lineas[i].trim().startsWith("|")) {
    const c = celdas(lineas[i]);
    if (!cab) cab = c.map(claveCol);
    else if (!esSeparador(c)) {
      const f = Object.fromEntries(cab.map((k, j) => [k, c[j] ?? ""]));
      Object.defineProperty(f, "_linea", { value: i });
      Object.defineProperty(f, "_sobran", { value: c.length > cab.length && c.slice(cab.length).some((x) => x !== "") });
      filas.push(f);
    }
    i++;
  }
  return { cab, filas, fin: i };
}
const manana = (iso) => { const [a, m, d] = iso.split("-").map(Number); const f = new Date(a, m - 1, d + 1, 12); return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`; };
/** « (línea N)» para los errores: la línea del fichero (o del bloque de la sesión) donde está el problema. */
const L = (n) => (n ? ` (línea ${n})` : "");
const COLUMNAS_SERIE = ["#", "tipo", "carga", "reps", "rpe", "rir", "nota"];
const COLUMNAS_CARDIO = ["actividad", "minutos", "distancia_km", "ritmo", "pulso_medio", "kcal", "nota"];
const SOBRAN = "la fila tiene más celdas que la cabecera (si una nota lleva «|», escríbela como «\\|»)";

// ── Sesión ───────────────────────────────────────────────────────────────────────────────
/**
 * Lee una sesión. Nunca lanza: los problemas van a `errores` (impiden calcular) o a
 * `avisos` (se calcula igual).
 */
export function leerSesion(texto, ruta = null) {
  const s = {
    ruta, fecha: null, titulo: null, tipo: null, programa: null, semana_programa: null, inicio: null, fin: null,
    duracion_min: null, sueno_h: null, sensacion_pre: null, sensacion_post: null, peso_corporal_kg: null,
    molestias: [], fuente: null, confianza: null, extra: {},
    calentamiento: "", ejercicios: [], cardio: [], notas: "", original: null, otras: {},
    // Texto que no es una tabla ni un título, para no perderlo al reescribir la sesión.
    sueltas: { cabecera: "", ejercicios: "", cardio: "" }, errores: [], avisos: [],
  };
  const t = String(texto ?? "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n"); // sin BOM (Bloc de notas)
  const fm = t.match(/^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/); // tolera espacios detrás de «---»
  if (!fm) { s.errores.push(`falta el frontmatter (--- … ---)${L(1)}`); return s; }
  const meta = leerYAML(fm[1]);
  // Números de línea: los del frontmatter (por clave) y los del cuerpo (desde la línea que sigue al frontmatter).
  const lineaClave = {};
  fm[1].split("\n").forEach((l, j) => { const m = l.match(/^([A-Za-z_][\w-]*)\s*:/); if (m && !(m[1] in lineaClave)) lineaClave[m[1]] = j + 2; });
  Object.defineProperty(s, "_lineas", { value: lineaClave, enumerable: false });
  const base = (fm[0].match(/\n/g) || []).length;
  const linea = (i) => base + i + 1;
  for (const [k, v] of Object.entries(meta)) {
    if (CLAVES_FRONTMATTER.includes(k)) s[k] = v;
    else s.extra[k] = v;
  }
  if (s.fecha !== null) s.fecha = String(s.fecha);
  if (!Array.isArray(s.molestias)) s.molestias = s.molestias ? [] : [];
  let cuerpo = t.slice(fm[0].length);

  // El original va al final y es texto exacto: puede contener «</details>», así que llega hasta el último.
  const orig = cuerpo.match(/<details>\s*<summary>\s*Original\s*<\/summary>\s*\n([\s\S]*)\n?<\/details>/i);
  // (se quita dejando sus saltos de línea, para que los números de línea sigan siendo los del fichero)
  if (orig) { s.original = orig[1].replace(/^\n+/, "").replace(/\n+$/, ""); cuerpo = cuerpo.replace(orig[0], "\n".repeat((orig[0].match(/\n/g) || []).length)); }

  const lineas = cuerpo.split("\n");
  let seccion = null, ej = null;
  const texto_ = { calentamiento: [], notas: [] };
  const sueltas = { cabecera: [], ejercicios: [], cardio: [] };
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    // (bandera «s»: un título puede llevar U+2028/U+2029, que «.» no casa sin ella)
    const h2 = l.match(/^##\s+(.+?)\s*$/s);
    if (h2) {
      const n = claveCol(h2[1]);
      seccion = n.startsWith("calentamiento") ? "calentamiento" : n.startsWith("ejercicios") ? "ejercicios"
        : n.startsWith("cardio") ? "cardio" : n.startsWith("notas") ? "notas" : h2[1].trim();
      if (!["calentamiento", "ejercicios", "cardio", "notas"].includes(seccion)) s.otras[seccion] ??= []; // repetida: se junta
      ej = null;
      continue;
    }
    if (seccion === null && /^#\s+/.test(l)) continue; // el título de la sesión (lo rehace el script)
    if (seccion === null) { sueltas.cabecera.push(l); continue; }
    if (seccion === "ejercicios") {
      const h3 = l.match(/^###\s+(?:([A-Z])(\d+)\s*[·.\-]\s*)?(.+?)\s*$/s);
      if (h3) {
        ej = { nombre: h3[3], id: null, superserie: h3[1] ?? null, orden_superserie: h3[2] ? Number(h3[2]) : null, nota: null, series: [], linea: linea(i) };
        s.ejercicios.push(ej);
        continue;
      }
      const com = l.trim().match(/^<!--\s*(.*?)\s*-->$/s);
      if (com && ej) {
        for (const parte of com[1].split("·")) {
          const kv = parte.match(/^\s*([\w-]+)\s*:\s*(.*?)\s*$/s);
          if (!kv) continue;
          if (kv[1] === "id") ej.id = kv[2];
          else if (kv[1] === "superserie") ej.superserie = kv[2] || null;
          else if (kv[1] === "nota") ej.nota = kv[2];
        }
        continue;
      }
      if (l.trim().startsWith("|") && ej) {
        const tabla = leerTabla(lineas, i);
        i = tabla.fin - 1;
        // Sin «carga» o «reps» las cifras saldrían mal sin avisar: es un error. Otras columnas se conservan.
        for (const col of ["carga", "reps"]) if (!tabla.cab.includes(col)) s.errores.push(`${ej.nombre}: la tabla no tiene la columna «${col}» (las columnas son: ${COLUMNAS_SERIE.join(" · ")})${L(linea(i))}`);
        const extras = tabla.cab.filter((k) => k && !COLUMNAS_SERIE.includes(k));
        for (const k of extras) if (!ej.columnas_extra?.includes(k)) { (ej.columnas_extra ||= []).push(k); s.avisos.push(`${ej.nombre}: columna «${k}» que no es del formato (se conserva, pero no cuenta en las cifras)`); }
        tabla.filas.forEach((f, j) => { const x = leerFilaSerie(f, j, ej, s, linea(f._linea)); if (extras.length) x.extra = Object.fromEntries(extras.map((k) => [k, f[k] ?? ""])); ej.series.push(x); });
        continue;
      }
      if (!ej) sueltas.ejercicios.push(l);
      else if (l.trim()) ej.nota = [ej.nota, l.trim()].filter(Boolean).join("\n");
      continue;
    }
    if (seccion === "cardio" && l.trim().startsWith("|")) {
      const tabla = leerTabla(lineas, i);
      i = tabla.fin - 1;
      const extras = tabla.cab.filter((k) => k && !COLUMNAS_CARDIO.includes(k));
      for (const k of extras) if (!s.cardio_columnas_extra?.includes(k)) { (s.cardio_columnas_extra ||= []).push(k); s.avisos.push(`Cardio: columna «${k}» que no es del formato (se conserva)`); }
      for (const f of tabla.filas) {
        if (f._sobran) s.errores.push(`Cardio, ${f.actividad || "fila"}: ${SOBRAN}${L(linea(f._linea))}`);
        s.cardio.push({
          actividad: f.actividad || "", minutos: numero(f.minutos), distancia_km: numero(f.distancia_km),
          ritmo: f.ritmo || null, pulso_medio: numero(f.pulso_medio), kcal: numero(f.kcal), nota: f.nota || null,
          ...(extras.length ? { extra: Object.fromEntries(extras.map((k) => [k, f[k] ?? ""])) } : {}),
        });
      }
      continue;
    }
    if (seccion === "cardio") sueltas.cardio.push(l);
    else if (seccion === "calentamiento" || seccion === "notas") texto_[seccion].push(l);
    else if (seccion && s.otras[seccion]) s.otras[seccion].push(l);
  }
  s.calentamiento = texto_.calentamiento.join("\n").trim();
  s.notas = texto_.notas.join("\n").trim();
  for (const k of Object.keys(s.otras)) s.otras[k] = s.otras[k].join("\n").trim();
  for (const k of Object.keys(sueltas)) s.sueltas[k] = sueltas[k].join("\n").trim();
  validarBasico(s);
  return s;
}

function leerFilaSerie(f, j, ej, s, n = null) {
  const tipo = (f.tipo || "trabajo").toLowerCase().replace(/ó/g, "o");
  const serie = {
    n: numero(f["#"]) ?? j + 1, tipo, carga: leerCarga(f.carga), reps: leerReps(f.reps),
    rpe: numero(f.rpe), rir: numero(f.rir), nota: f.nota || null,
  };
  const donde = `${ej.nombre}, serie ${serie.n}${L(n)}`;
  if (f._sobran) s.errores.push(`${donde}: ${SOBRAN}`);
  if (!TIPOS_SERIE.includes(tipo)) s.errores.push(`${donde}: tipo de serie desconocido «${f.tipo}»`);
  if (serie.carga.tipo === "error") s.errores.push(`${donde}: carga no válida «${serie.carga.texto}»`);
  if (serie.reps.tipo === "error") s.errores.push(`${donde}: repeticiones no válidas «${serie.reps.texto}»`);
  if (f.rpe && serie.rpe === null) {
    const rango = String(f.rpe).match(/^(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)$/);
    if (rango) { serie.rpe = (numero(rango[1]) + numero(rango[2])) / 2; s.avisos.push(`${donde}: RPE en rango «${f.rpe}», guardado como ${serie.rpe}`); }
    else s.errores.push(`${donde}: RPE no válido «${f.rpe}»`);
  }
  if (serie.rpe !== null && (serie.rpe < 1 || serie.rpe > 10)) s.errores.push(`${donde}: RPE fuera de 1-10 (${serie.rpe})`);
  if (f.rir && serie.rir === null) s.errores.push(`${donde}: RIR no válido «${f.rir}»`);
  if (serie.rir !== null && (serie.rir < 0 || serie.rir > 10)) s.errores.push(`${donde}: RIR fuera de rango (${serie.rir})`);
  return serie;
}

function validarBasico(s) {
  const lc = (k) => L(s._lineas?.[k] ?? null);
  if (!s.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(s.fecha)) s.errores.push(`fecha no válida «${s.fecha}» (AAAA-MM-DD)${lc("fecha") || L(1)}`);
  else {
    const [a, m, d] = s.fecha.split("-").map(Number);
    const f = new Date(a, m - 1, d);
    if (f.getFullYear() !== a || f.getMonth() !== m - 1 || f.getDate() !== d) s.errores.push(`fecha imposible «${s.fecha}»${lc("fecha")}`);
  }
  if (s.ruta) {
    const nombre = s.ruta.split("/").pop().replace(/\.md$/, "");
    if (s.fecha && !nombre.startsWith(s.fecha)) s.errores.push(`la fecha del frontmatter (${s.fecha}) no coincide con el fichero (${nombre})${lc("fecha")}`);
  }
  if (s.tipo && !TIPOS_SESION.includes(s.tipo)) s.avisos.push(`tipo de sesión desconocido «${s.tipo}»`);
  if (s.confianza && !["alta", "media", "baja"].includes(s.confianza)) s.avisos.push(`confianza desconocida «${s.confianza}»`);
  for (const k of ["sensacion_pre", "sensacion_post"]) {
    if (s[k] !== null && (typeof s[k] !== "number" || s[k] < 0 || s[k] > 10)) s.errores.push(`${k} fuera de 0-10 («${s[k]}»)${lc(k)}`);
  }
  if (s.sueno_h !== null && (typeof s.sueno_h !== "number" || s.sueno_h < 0 || s.sueno_h > 24)) s.errores.push(`sueno_h no válido («${s.sueno_h}»)${lc("sueno_h")}`);
  s.molestias = (s.molestias || []).filter((m) => m && typeof m === "object").map((m) => ({
    zona: String(m.zona ?? "").trim().toLowerCase(), lado: m.lado ?? null, estado: m.estado ?? "molestia",
  }));
  for (const m of s.molestias) {
    if (!m.zona) s.errores.push(`molestia sin zona${lc("molestias")}`);
    if (!ESTADOS_MOLESTIA.includes(m.estado)) s.errores.push(`molestia ${m.zona}: estado desconocido «${m.estado}» (bien | molestia | dolor)${lc("molestias")}`);
    if (!LADOS.includes(m.lado)) s.errores.push(`molestia ${m.zona}: lado desconocido «${m.lado}» (izq | der | ambos)${lc("molestias")}`);
  }
  for (const e of s.ejercicios) {
    if (!e.id) s.errores.push(`${e.nombre}: falta el id (<!-- id: … -->)${L(e.linea)}`);
    else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(e.id)) s.errores.push(`${e.nombre}: id no válido «${e.id}»${L(e.linea)}`);
  }
  if (!s.ejercicios.length && !s.cardio.length && s.confianza === "alta") s.avisos.push("sesión sin ejercicios ni cardio con confianza alta");
}

/** Validación completa: lo básico, los ids contra el catálogo y que la fecha no sea futura (se admite mañana, por las zonas horarias). */
export function validarSesion(s, catalogo, { hoy = null } = {}) {
  const errores = [...s.errores];
  if (hoy && s.fecha && /^\d{4}-\d{2}-\d{2}$/.test(s.fecha) && !s.errores.length && s.fecha > manana(hoy)) {
    errores.push(`fecha en el futuro «${s.fecha}» (hoy es ${hoy}): ¿el año o el mes están mal escritos?${L(s._lineas?.fecha ?? 2)}`);
  }
  if (catalogo) for (const e of s.ejercicios) if (e.id && !catalogo.tiene(e.id)) errores.push(`${e.nombre}: el id «${e.id}» no está en el catálogo${L(e.linea)}`);
  return errores;
}

// ── Escribir una sesión en el formato estándar ───────────────────────────────────────────
export function escribirSesion(s) {
  const meta = {};
  for (const k of CLAVES_FRONTMATTER) meta[k] = s[k] ?? null;
  meta.molestias = (s.molestias || []).map((m) => ({ zona: m.zona, lado: m.lado ?? null, estado: m.estado }));
  Object.assign(meta, s.extra || {});
  const sueltas = s.sueltas || {};
  const out = ["---", escribirYAML(meta), "---", "", `# ${s.fecha}${s.titulo ? ` · ${s.titulo}` : ""}`, ""];
  if (sueltas.cabecera) out.push(sueltas.cabecera, "");
  if (s.calentamiento) out.push("## Calentamiento y movilidad", s.calentamiento, "");
  if (s.ejercicios?.length || sueltas.ejercicios) {
    out.push("## Ejercicios", "");
    if (sueltas.ejercicios) out.push(sueltas.ejercicios, "");
    for (const e of s.ejercicios) {
      out.push(`### ${e.superserie && e.orden_superserie ? `${e.superserie}${e.orden_superserie} · ` : ""}${e.nombre}`);
      out.push(`<!-- id: ${e.id}${e.superserie ? ` · superserie: ${e.superserie}` : ""} -->`);
      const ex = e.columnas_extra || [];
      out.push(`| ${[...COLUMNAS_SERIE, ...ex].join(" | ")} |`, `|${[...COLUMNAS_SERIE, ...ex].map(() => "---").join("|")}|`);
      e.series.forEach((x, i) => out.push(`| ${x.n ?? i + 1} | ${celda(x.tipo)} | ${celda(x.carga?.texto ?? x.carga)} | ${celda(x.reps?.texto ?? x.reps)} | ${x.rpe ?? ""} | ${x.rir ?? ""} | ${celda(x.nota)} |${ex.map((k) => ` ${celda(x.extra?.[k])} |`).join("")}`));
      if (e.nota) out.push(e.nota);
      out.push("");
    }
  }
  if (s.cardio?.length || sueltas.cardio) {
    out.push("## Cardio");
    if (s.cardio?.length) {
      const ex = s.cardio_columnas_extra || [];
      out.push(`| ${[...COLUMNAS_CARDIO, ...ex].join(" | ")} |`, `|${[...COLUMNAS_CARDIO, ...ex].map(() => "---").join("|")}|`);
      for (const c of s.cardio) out.push(`| ${celda(c.actividad)} | ${c.minutos ?? ""} | ${c.distancia_km ?? ""} | ${celda(c.ritmo)} | ${c.pulso_medio ?? ""} | ${c.kcal ?? ""} | ${celda(c.nota)} |${ex.map((k) => ` ${celda(c.extra?.[k])} |`).join("")}`);
    }
    if (sueltas.cardio) out.push(sueltas.cardio);
    out.push("");
  }
  for (const [titulo, texto] of Object.entries(s.otras || {})) out.push(`## ${titulo}`, texto, "");
  out.push("## Notas", s.notas || "", "");
  if (s.original !== null && s.original !== undefined) out.push("<details><summary>Original</summary>", "", s.original, "", "</details>", "");
  return out.join("\n");
}
