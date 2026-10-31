// Catálogo de ejercicios (ejercicios.md): id, nombre, alias, grupo, secundarios, carga, patrón, principal.
import { claveTexto } from "./util.mjs";

export const GRUPOS = ["pecho", "dorsal", "espalda-alta", "trapecio", "lumbar", "hombro", "biceps", "triceps",
  "antebrazo", "abdomen", "cuadriceps", "femoral", "gluteo", "aductor", "gemelo"];
export const CARGAS = ["barra", "mancuerna", "maquina", "polea", "peso-corporal", "kettlebell", "banda", "otro"];
export const PATRONES = ["empuje-horizontal", "empuje-vertical", "tiron-horizontal", "tiron-vertical", "cadera",
  "rodilla", "aislamiento", "core", "cardio"];
export const PATRONES_RADAR = PATRONES.slice(0, 6);
/** Grupos agregados que se pueden usar en FICHA.md (series objetivo) y en el Panel. */
export const AGREGADOS = {
  espalda: ["dorsal", "espalda-alta", "trapecio"],
  pierna: ["cuadriceps", "femoral", "gluteo", "aductor", "gemelo"],
  brazos: ["biceps", "triceps", "antebrazo"],
  brazo: ["biceps", "triceps", "antebrazo"],
  core: ["abdomen"],
  abdominales: ["abdomen"],
  gluteos: ["gluteo"], gemelos: ["gemelo"], hombros: ["hombro"],
};
export const NOMBRE_GRUPO = {
  pecho: "Pecho", dorsal: "Dorsal", "espalda-alta": "Espalda alta", trapecio: "Trapecio", lumbar: "Lumbar",
  hombro: "Hombro", biceps: "Bíceps", triceps: "Tríceps", antebrazo: "Antebrazo", abdomen: "Abdomen",
  cuadriceps: "Cuádriceps", femoral: "Femoral", gluteo: "Glúteo", aductor: "Aductor", gemelo: "Gemelo",
  espalda: "Espalda", pierna: "Pierna", brazos: "Brazos", brazo: "Brazos", core: "Core",
};
export const NOMBRE_PATRON = {
  "empuje-horizontal": "Empuje horiz.", "empuje-vertical": "Empuje vert.", "tiron-vertical": "Tirón vert.",
  "tiron-horizontal": "Tirón horiz.", cadera: "Cadera", rodilla: "Rodilla",
};

const celdas = (linea) => linea.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
const lista = (s) => String(s ?? "").split(",").map((x) => x.trim()).filter(Boolean);

/** Lee la tabla del catálogo. Devuelve { ejercicios: Map id→ficha, errores }. */
export function leerCatalogo(texto) {
  const ejercicios = new Map();
  const errores = [];
  let cab = null;
  for (const linea of String(texto ?? "").replace(/\r/g, "").split("\n")) {
    if (!linea.trim().startsWith("|")) continue;
    const c = celdas(linea);
    if (!cab) { cab = c.map((x) => claveTexto(x).replace(/ /g, "_")); continue; }
    if (c.every((x) => /^:?-+:?$/.test(x))) continue;
    const fila = Object.fromEntries(cab.map((k, i) => [k, c[i] ?? ""]));
    const id = fila.id;
    if (!id) continue;
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) errores.push(`id no válido: «${id}»`);
    const ej = {
      id, nombre: fila.nombre || id, alias: lista(fila.alias), grupo: fila.grupo || "",
      secundarios: lista(fila.secundarios), carga: fila.carga || "otro", patron: fila.patron || "aislamiento",
      principal: /^s[ií]$/i.test(fila.principal || ""),
    };
    if (ej.grupo && !GRUPOS.includes(ej.grupo)) errores.push(`${id}: grupo desconocido «${ej.grupo}»`);
    for (const s of ej.secundarios) if (!GRUPOS.includes(s)) errores.push(`${id}: grupo secundario desconocido «${s}»`);
    if (!CARGAS.includes(ej.carga)) errores.push(`${id}: tipo de carga desconocido «${ej.carga}»`);
    if (!PATRONES.includes(ej.patron)) errores.push(`${id}: patrón desconocido «${ej.patron}»`);
    if (ejercicios.has(id)) errores.push(`id repetido: ${id}`);
    ejercicios.set(id, ej);
  }
  return crearIndice(ejercicios, errores);
}

function crearIndice(ejercicios, errores = []) {
  // Fusión: si un alias coincide con otro id, ese id pasa a ser parte de este ejercicio.
  const fusion = new Map();
  for (const ej of ejercicios.values()) {
    for (const a of ej.alias) if (ejercicios.has(a) && a !== ej.id) fusion.set(a, ej.id);
  }
  const canonico = (id) => {
    let x = id, n = 0;
    while (fusion.has(x) && n++ < 10) x = fusion.get(x);
    return x;
  };
  const porClave = new Map();
  const ambiguos = new Set();
  const poner = (clave, id) => {
    if (!clave) return;
    const prev = porClave.get(clave);
    if (prev && prev !== id) ambiguos.add(clave);
    else porClave.set(clave, id);
  };
  for (const ej of ejercicios.values()) {
    const c = canonico(ej.id);
    poner(claveTexto(ej.id), c);
    poner(claveTexto(ej.nombre), c);
    for (const a of ej.alias) poner(claveTexto(a), c);
  }
  return {
    ejercicios, errores, fusion, ambiguos,
    canonico,
    /** id canónico de un nombre, alias o id (o null). */
    buscar(nombre) {
      const k = claveTexto(nombre);
      if (!k) return null;
      if (porClave.has(k) && !ambiguos.has(k)) return porClave.get(k);
      const sinGuion = claveTexto(String(nombre).replace(/-/g, " "));
      return porClave.get(sinGuion) ?? null;
    },
    obtener(id) { return ejercicios.get(canonico(id)) ?? ejercicios.get(id) ?? null; },
    tiene(id) { return ejercicios.has(id) || fusion.has(id); },
  };
}

/** Una fila nueva del catálogo, lista para añadir a la tabla. */
export function filaCatalogo(ej) {
  return `| ${ej.id} | ${ej.nombre} | ${(ej.alias || []).join(", ")} | ${ej.grupo} | ${(ej.secundarios || []).join(", ")} | ${ej.carga} | ${ej.patron} | ${ej.principal ? "si" : "no"} |`;
}

/** Lee filas sueltas (las que propone Claude para ejercicios nuevos) y las valida. */
export function leerFilas(lineas) {
  const cab = "| id | nombre | alias | grupo | secundarios | carga | patron | principal |\n|---|---|---|---|---|---|---|---|\n";
  return leerCatalogo(cab + lineas.join("\n"));
}

/** Añade filas al final de la tabla del catálogo (sin tocar lo demás). */
export function anadirFilas(texto, filas) {
  if (!filas.length) return texto;
  const lineas = String(texto).replace(/\r/g, "").split("\n");
  let ultima = -1;
  lineas.forEach((l, i) => { if (l.trim().startsWith("|")) ultima = i; });
  if (ultima < 0) return texto.replace(/\n*$/, "\n\n") + "| id | nombre | alias | grupo | secundarios | carga | patron | principal |\n|---|---|---|---|---|---|---|---|\n" + filas.join("\n") + "\n";
  lineas.splice(ultima + 1, 0, ...filas);
  return lineas.join("\n");
}

/** Añade alias a un ejercicio existente (para unificar dos ids o aprender un mote). */
export function anadirAlias(texto, id, alias) {
  return String(texto).replace(/\r/g, "").split("\n").map((l) => {
    if (!l.trim().startsWith("|")) return l;
    const c = celdas(l);
    if (c[0] !== id) return l;
    const actuales = lista(c[2]);
    for (const a of alias) if (!actuales.includes(a)) actuales.push(a);
    c[2] = actuales.join(", ");
    return `| ${c.join(" | ")} |`;
  }).join("\n");
}
