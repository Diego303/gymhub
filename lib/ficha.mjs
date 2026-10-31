// FICHA.md: objetivos, series objetivo, datos personales, lesiones, referencias y rangos.
// Se lee de forma tolerante (es un fichero que edita la persona) y se edita por secciones.

const num = (s) => {
  const m = String(s ?? "").replace(/(\d)['’](\d)/g, "$1.$2").replace(",", ".").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
};

export const REFERENCIAS_POR_DEFECTO = {
  "empuje-horizontal": 1.0, "empuje-vertical": 0.62, "tiron-horizontal": 0.8,
  "tiron-vertical": 0.85, "rodilla": 1.3, "cadera": 1.55,
};
const NOMBRE_REFERENCIA = {
  banca: "empuje-horizontal", "press banca": "empuje-horizontal", militar: "empuje-vertical",
  "press militar": "empuje-vertical", remo: "tiron-horizontal", dominada: "tiron-vertical",
  dominadas: "tiron-vertical", sentadilla: "rodilla", "peso muerto": "cadera", muerto: "cadera",
};
export const RANGOS_POR_DEFECTO = {
  "empuje:tiron": [0.9, 1.1], "cuadriceps:femoral": [1.0, 1.6], "banca:remo": [1.0, 1.3],
};

/** Divide el Markdown en secciones `## Título` → líneas. */
export function secciones(texto) {
  const out = { _cabecera: [] };
  let actual = "_cabecera";
  for (const linea of String(texto ?? "").replace(/\r/g, "").split("\n")) {
    const m = linea.match(/^##\s+(.+?)\s*(←.*)?$/);
    if (m) { actual = m[1].trim().toLowerCase(); out[actual] = []; continue; }
    out[actual].push(linea);
  }
  return out;
}

const sinComentarios = (lineas) => lineas.join("\n").replace(/<!--[\s\S]*?-->/g, "").split("\n");
const buscar = (sec, ...nombres) => {
  for (const k of Object.keys(sec)) if (nombres.some((n) => k.startsWith(n))) return sinComentarios(sec[k]);
  return [];
};

export function leerFicha(texto) {
  const sec = secciones(texto);
  const ficha = {
    dias_semana: null, objetivos: {}, series_objetivo: {}, peso_corporal_kg: null,
    sueno_objetivo_h: 8, racha_umbral_dias: 4, lesiones: [], prehab: [],
    referencias: { ...REFERENCIAS_POR_DEFECTO }, rangos: structuredClone(RANGOS_POR_DEFECTO),
  };
  for (const l of buscar(sec, "objetivos")) {
    const m = l.match(/^\s*[-*]\s*([^:]+):\s*(.+)$/);
    if (!m) continue;
    const clave = m[1].trim().toLowerCase();
    if (/^d[ií]as[_ ]semana$/.test(clave)) ficha.dias_semana = num(m[2]);
    else if (num(m[2]) !== null) ficha.objetivos[m[1].trim()] = { valor: num(m[2]), unidad: /lb/i.test(m[2]) ? "lb" : "kg" };
  }
  const so = buscar(sec, "series objetivo").join(" ");
  for (const m of so.matchAll(/([a-záéíóúñ-]+)\s+(\d+(?:[.,]\d+)?)/gi)) {
    ficha.series_objetivo[m[1].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")] = num(m[2]);
  }
  for (const l of [...buscar(sec, "datos"), ...buscar(sec, "objetivos")]) {
    const m = l.match(/^\s*[-*]\s*([^:]+):\s*(.*)$/);
    if (!m) continue;
    const k = m[1].trim().toLowerCase().replace(/ /g, "_");
    if (k === "peso_corporal") ficha.peso_corporal_kg = num(m[2]) !== null ? (/lb/i.test(m[2]) ? num(m[2]) * 0.4536 : num(m[2])) : null;
    if (k === "sueno_objetivo" || k === "sueño_objetivo") ficha.sueno_objetivo_h = num(m[2]) ?? 8;
    if (k === "racha_umbral_dias") ficha.racha_umbral_dias = num(m[2]) ?? 4;
  }
  for (const l of buscar(sec, "lesiones")) {
    const m = l.match(/^\s*[-*]\s*(.+)$/);
    if (!m || /^\(?ninguna\)?$/i.test(m[1].trim())) continue;
    const texto = m[1].replace(/\s+\(ejemplo.*\)\s*$/i, "").trim();
    ficha.lesiones.push(texto);
    const p = texto.match(/^([^:]+):\s*(.*prehab.*)$/i);
    if (p) ficha.prehab.push({ zona: p[1].trim().toLowerCase(), texto: p[2].trim() });
  }
  const refs = buscar(sec, "referencias").join(" ");
  for (const m of refs.matchAll(/([a-záéíóúñ ]+?)\s+(\d+(?:[.,]\d+)?)/gi)) {
    const patron = NOMBRE_REFERENCIA[m[1].trim().toLowerCase().replace(/^·\s*/, "")];
    if (patron) ficha.referencias[patron] = num(m[2]);
  }
  const rangos = buscar(sec, "rangos").join(" ");
  for (const m of rangos.matchAll(/([a-záéíóú]+:[a-záéíóú]+)\s+(\d+(?:[.,]\d+)?)\s*[–-]\s*(\d+(?:[.,]\d+)?)/gi)) {
    ficha.rangos[m[1].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")] = [num(m[2]), num(m[3])];
  }
  return ficha;
}

/** Sustituye (o añade al final) el cuerpo de la sección `## titulo`. */
export function ponerSeccion(texto, titulo, cuerpo) {
  const lineas = String(texto ?? "").replace(/\r/g, "").split("\n");
  const ini = lineas.findIndex((l) => new RegExp(`^##\\s+${titulo}`, "i").test(l));
  const nuevo = cuerpo.replace(/\n+$/, "").split("\n");
  if (ini < 0) return lineas.join("\n").replace(/\n*$/, "\n\n") + `## ${titulo}\n` + nuevo.join("\n") + "\n";
  let fin = lineas.findIndex((l, i) => i > ini && /^##\s+/.test(l));
  if (fin < 0) fin = lineas.length;
  const resto = lineas.slice(fin);
  return [...lineas.slice(0, ini + 1), ...nuevo, ...(resto.length ? ["", ...resto] : [])].join("\n").replace(/\n*$/, "\n");
}

/** Cambia una línea `- clave: valor` de una sección, o la añade. */
export function ponerClave(texto, titulo, clave, valor) {
  const sec = secciones(texto);
  const k = Object.keys(sec).find((s) => s.startsWith(titulo.toLowerCase()));
  const lineas = k ? sec[k].slice() : [];
  const re = new RegExp(`^\\s*[-*]\\s*${clave.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:`, "i");
  // Las líneas dentro de <!-- … --> son ejemplos: no se tocan.
  let enComentario = false;
  const comentada = lineas.map((l) => {
    const antes = enComentario;
    if (l.includes("<!--")) enComentario = true;
    const dentro = antes || enComentario;
    if (l.includes("-->")) enComentario = false;
    return dentro;
  });
  const i = lineas.findIndex((l, n) => !comentada[n] && re.test(l));
  const linea = `- ${clave}: ${valor}`;
  if (i >= 0) lineas[i] = linea;
  else {
    let j = lineas.length;
    while (j > 0 && lineas[j - 1].trim() === "") j--;
    lineas.splice(j, 0, linea);
  }
  const titReal = k ? texto.match(new RegExp(`^##\\s+(${titulo}[^\\n]*)$`, "im"))[1] : titulo;
  return ponerSeccion(texto, titReal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), lineas.join("\n"));
}

/** Añade una lesión, quitando el marcador «(ninguna)». */
export function anadirLesion(texto, lesion) {
  const sec = secciones(texto);
  const k = Object.keys(sec).find((s) => s.startsWith("lesiones"));
  const lineas = (k ? sec[k] : []).filter((l) => !/^\s*[-*]\s*\(?ninguna\)?\s*$/i.test(l));
  let j = lineas.length;
  while (j > 0 && lineas[j - 1].trim() === "") j--;
  lineas.splice(j, 0, `- ${lesion}`);
  return ponerSeccion(texto, "Lesiones y limitaciones", lineas.join("\n"));
}
