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
  if (/^".*"$/.test(s)) return s.slice(1, -1).replace(/\\"/g, '"');
  if (/^'.*'$/.test(s)) return s.slice(1, -1).replace(/''/g, "'");
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
    const m = l.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!m) continue;
    const [, clave, resto] = m;
    if (resto.replace(/\s+#.*$/, "").trim() !== "") { out[clave] = escalar(resto); continue; }
    // Lista de mapas o de escalares en las líneas siguientes
    const items = [];
    let actual = null;
    while (i + 1 < lineas.length && (/^\s+\S/.test(lineas[i + 1]) || lineas[i + 1].trim() === "")) {
      const s = lineas[++i];
      if (!s.trim()) continue;
      const item = s.match(/^\s*-\s*(.*)$/);
      if (item) {
        const kv = item[1].match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
        if (kv) { actual = { [kv[1]]: escalar(kv[2]) }; items.push(actual); }
        else { actual = null; items.push(escalar(item[1])); }
      } else {
        const kv = s.match(/^\s*([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
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
  return /^[\w.\-áéíóúñÁÉÍÓÚÑ ]+$/.test(s) && !/^\d/.test(s) && !["null", "true", "false"].includes(s) ? s : JSON.stringify(s);
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
  m = t.match(/^banda\s+(.+)$/i);
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
const celdas = (l) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
const esSeparador = (c) => c.every((x) => /^:?-{2,}:?$/.test(x));
const claveCol = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, "_");

function leerTabla(lineas, desde) {
  const filas = [];
  let i = desde, cab = null;
  while (i < lineas.length && lineas[i].trim().startsWith("|")) {
    const c = celdas(lineas[i]);
    if (!cab) cab = c.map(claveCol);
    else if (!esSeparador(c)) filas.push(Object.fromEntries(cab.map((k, j) => [k, c[j] ?? ""])));
    i++;
  }
  return { cab, filas, fin: i };
}

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
    calentamiento: "", ejercicios: [], cardio: [], notas: "", original: null, otras: {}, errores: [], avisos: [],
  };
  const t = String(texto ?? "").replace(/\r\n?/g, "\n");
  const fm = t.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!fm) { s.errores.push("falta el frontmatter (--- … ---)"); return s; }
  const meta = leerYAML(fm[1]);
  for (const [k, v] of Object.entries(meta)) {
    if (CLAVES_FRONTMATTER.includes(k)) s[k] = v;
    else s.extra[k] = v;
  }
  if (s.fecha !== null) s.fecha = String(s.fecha);
  if (!Array.isArray(s.molestias)) s.molestias = s.molestias ? [] : [];
  let cuerpo = t.slice(fm[0].length);

  // El original va al final y es texto exacto: puede contener «</details>», así que llega hasta el último.
  const orig = cuerpo.match(/<details>\s*<summary>\s*Original\s*<\/summary>\s*\n([\s\S]*)\n?<\/details>/i);
  if (orig) { s.original = orig[1].replace(/^\n+/, "").replace(/\n+$/, ""); cuerpo = cuerpo.replace(orig[0], ""); }

  const lineas = cuerpo.split("\n");
  let seccion = null, ej = null;
  const texto_ = { calentamiento: [], notas: [] };
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    const h2 = l.match(/^##\s+(.+?)\s*$/);
    if (h2) {
      const n = claveCol(h2[1]);
      seccion = n.startsWith("calentamiento") ? "calentamiento" : n.startsWith("ejercicios") ? "ejercicios"
        : n.startsWith("cardio") ? "cardio" : n.startsWith("notas") ? "notas" : h2[1].trim();
      if (!["calentamiento", "ejercicios", "cardio", "notas"].includes(seccion)) s.otras[seccion] = [];
      ej = null;
      continue;
    }
    if (/^#\s+/.test(l)) continue;
    if (seccion === "ejercicios") {
      const h3 = l.match(/^###\s+(?:([A-Z])(\d+)\s*[·.\-]\s*)?(.+?)\s*$/);
      if (h3) {
        ej = { nombre: h3[3], id: null, superserie: h3[1] ?? null, orden_superserie: h3[2] ? Number(h3[2]) : null, nota: null, series: [] };
        s.ejercicios.push(ej);
        continue;
      }
      const com = l.match(/^<!--\s*(.*?)\s*-->$/);
      if (com && ej) {
        for (const parte of com[1].split("·")) {
          const kv = parte.match(/^\s*([\w-]+)\s*:\s*(.*?)\s*$/);
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
        tabla.filas.forEach((f, j) => ej.series.push(leerFilaSerie(f, j, ej, s)));
        continue;
      }
      if (l.trim() && ej) ej.nota = [ej.nota, l.trim()].filter(Boolean).join(" ");
      continue;
    }
    if (seccion === "cardio" && l.trim().startsWith("|")) {
      const tabla = leerTabla(lineas, i);
      i = tabla.fin - 1;
      for (const f of tabla.filas) {
        s.cardio.push({
          actividad: f.actividad || "", minutos: numero(f.minutos), distancia_km: numero(f.distancia_km),
          ritmo: f.ritmo || null, pulso_medio: numero(f.pulso_medio), kcal: numero(f.kcal), nota: f.nota || null,
        });
      }
      continue;
    }
    if (seccion === "calentamiento" || seccion === "notas") texto_[seccion].push(l);
    else if (seccion && s.otras[seccion]) s.otras[seccion].push(l);
  }
  s.calentamiento = texto_.calentamiento.join("\n").trim();
  s.notas = texto_.notas.join("\n").trim();
  for (const k of Object.keys(s.otras)) s.otras[k] = s.otras[k].join("\n").trim();
  validarBasico(s);
  return s;
}

function leerFilaSerie(f, j, ej, s) {
  const tipo = (f.tipo || "trabajo").toLowerCase().replace(/ó/g, "o");
  const serie = {
    n: numero(f["#"]) ?? j + 1, tipo, carga: leerCarga(f.carga), reps: leerReps(f.reps),
    rpe: numero(f.rpe), rir: numero(f.rir), nota: f.nota || null,
  };
  const donde = `${ej.nombre}, serie ${serie.n}`;
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
  if (!s.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(s.fecha)) s.errores.push(`fecha no válida «${s.fecha}» (AAAA-MM-DD)`);
  else {
    const [a, m, d] = s.fecha.split("-").map(Number);
    const f = new Date(a, m - 1, d);
    if (f.getFullYear() !== a || f.getMonth() !== m - 1 || f.getDate() !== d) s.errores.push(`fecha imposible «${s.fecha}»`);
  }
  if (s.ruta) {
    const nombre = s.ruta.split("/").pop().replace(/\.md$/, "");
    if (s.fecha && !nombre.startsWith(s.fecha)) s.errores.push(`la fecha del frontmatter (${s.fecha}) no coincide con el fichero (${nombre})`);
  }
  if (s.tipo && !TIPOS_SESION.includes(s.tipo)) s.avisos.push(`tipo de sesión desconocido «${s.tipo}»`);
  if (s.confianza && !["alta", "media", "baja"].includes(s.confianza)) s.avisos.push(`confianza desconocida «${s.confianza}»`);
  for (const k of ["sensacion_pre", "sensacion_post"]) {
    if (s[k] !== null && (typeof s[k] !== "number" || s[k] < 0 || s[k] > 10)) s.errores.push(`${k} fuera de 0-10 («${s[k]}»)`);
  }
  if (s.sueno_h !== null && (typeof s.sueno_h !== "number" || s.sueno_h < 0 || s.sueno_h > 24)) s.errores.push(`sueno_h no válido («${s.sueno_h}»)`);
  s.molestias = (s.molestias || []).filter((m) => m && typeof m === "object").map((m) => ({
    zona: String(m.zona ?? "").trim().toLowerCase(), lado: m.lado ?? null, estado: m.estado ?? "molestia",
  }));
  for (const m of s.molestias) {
    if (!m.zona) s.errores.push("molestia sin zona");
    if (!ESTADOS_MOLESTIA.includes(m.estado)) s.errores.push(`molestia ${m.zona}: estado desconocido «${m.estado}» (bien | molestia | dolor)`);
    if (!LADOS.includes(m.lado)) s.errores.push(`molestia ${m.zona}: lado desconocido «${m.lado}» (izq | der | ambos)`);
  }
  for (const e of s.ejercicios) {
    if (!e.id) s.errores.push(`${e.nombre}: falta el id (<!-- id: … -->)`);
    else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(e.id)) s.errores.push(`${e.nombre}: id no válido «${e.id}»`);
  }
  if (!s.ejercicios.length && !s.cardio.length && s.confianza === "alta") s.avisos.push("sesión sin ejercicios ni cardio con confianza alta");
}

/** Validación completa: lo básico más los ids contra el catálogo. */
export function validarSesion(s, catalogo) {
  const errores = [...s.errores];
  if (catalogo) for (const e of s.ejercicios) if (e.id && !catalogo.tiene(e.id)) errores.push(`${e.nombre}: el id «${e.id}» no está en el catálogo`);
  return errores;
}

// ── Escribir una sesión en el formato estándar ───────────────────────────────────────────
export function escribirSesion(s) {
  const meta = {};
  for (const k of CLAVES_FRONTMATTER) meta[k] = s[k] ?? null;
  meta.molestias = (s.molestias || []).map((m) => ({ zona: m.zona, lado: m.lado ?? null, estado: m.estado }));
  Object.assign(meta, s.extra || {});
  const out = ["---", escribirYAML(meta), "---", "", `# ${s.fecha}${s.titulo ? ` · ${s.titulo}` : ""}`, ""];
  if (s.calentamiento) out.push("## Calentamiento y movilidad", s.calentamiento, "");
  if (s.ejercicios?.length) {
    out.push("## Ejercicios", "");
    for (const e of s.ejercicios) {
      out.push(`### ${e.superserie && e.orden_superserie ? `${e.superserie}${e.orden_superserie} · ` : ""}${e.nombre}`);
      out.push(`<!-- id: ${e.id}${e.superserie ? ` · superserie: ${e.superserie}` : ""} -->`);
      out.push("| # | tipo | carga | reps | rpe | rir | nota |", "|---|---|---|---|---|---|---|");
      e.series.forEach((x, i) => out.push(`| ${x.n ?? i + 1} | ${x.tipo} | ${x.carga?.texto ?? x.carga ?? ""} | ${x.reps?.texto ?? x.reps ?? ""} | ${x.rpe ?? ""} | ${x.rir ?? ""} | ${x.nota ?? ""} |`));
      out.push("");
    }
  }
  if (s.cardio?.length) {
    out.push("## Cardio", "| actividad | minutos | distancia_km | ritmo | pulso_medio | kcal | nota |", "|---|---|---|---|---|---|---|");
    for (const c of s.cardio) out.push(`| ${c.actividad} | ${c.minutos ?? ""} | ${c.distancia_km ?? ""} | ${c.ritmo ?? ""} | ${c.pulso_medio ?? ""} | ${c.kcal ?? ""} | ${c.nota ?? ""} |`);
    out.push("");
  }
  for (const [titulo, texto] of Object.entries(s.otras || {})) out.push(`## ${titulo}`, texto, "");
  out.push("## Notas", s.notas || "", "");
  if (s.original !== null && s.original !== undefined) out.push("<details><summary>Original</summary>", "", s.original, "", "</details>", "");
  return out.join("\n");
}
