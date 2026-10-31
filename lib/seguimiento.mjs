// Comandos de seguimiento (Fase 7): semana, ejercicio, revision, corregir y discos.
// Las cifras salen de aquí; Claude solo redacta lo cualitativo («qué ajustar»).
import { readFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { rutas, leerConfig } from "./config.mjs";
import { registrar, carpetaObligatoria, rutaSegura, recalcular } from "./registro.mjs";
import { contexto, derivarCarpeta } from "./derivar.mjs";
import { publicar, ponerNavegar } from "./publicar.mjs";
import { abrirEnNavegador } from "./abrir.mjs";
import { seriesGrupo, descarga } from "./panel.mjs";
import { NOMBRE_GRUPO, AGREGADOS, GRUPOS } from "./catalogo.mjs";
import { construirEjercicios } from "./ejercicio.mjs";
import { prediccion, estancados, agudaCronica } from "./analisis.mjs";
import { discosPorLado, textoDiscos } from "./discos.mjs";
import { nombreZona } from "./records.mjs";
import { leerSesion, validarSesion } from "./canonico.mjs";
import { inicioSemana, sumarDias, semanaISO, fechaCorta, num, media, sumar, redondear, aFecha, leerTexto, escribirAtomico, leerJSON, escribirJSON, claveTexto, DIAS, diaSemana, hoyISO } from "./util.mjs";
import { calcularSemanas, semanaDe, componerRepaso } from "./semanas.mjs";

// ── semana ───────────────────────────────────────────────────────────────────────────────
/** Lunes (o domingo) de la semana pedida: «2026-W44», «anterior» o nada (la actual). */
export function semanaPedida(c, arg) {
  const empieza = c.config.semana_empieza || "lunes";
  const actual = inicioSemana(c.base.hoy, empieza);
  if (arg === "anterior") return sumarDias(actual, -7);
  const m = String(arg ?? "").match(/^(\d{4})-?W(\d{1,2})$/i);
  if (m) {
    const jueves = (() => { const d = new Date(+m[1], 0, 4, 12); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 3 + 7 * (+m[2] - 1)); return d; })();
    const iso = `${jueves.getFullYear()}-${String(jueves.getMonth() + 1).padStart(2, "0")}-${String(jueves.getDate()).padStart(2, "0")}`;
    return inicioSemana(iso, empieza);
  }
  return actual;
}

const pctTxt = (d) => (d === null || d === undefined ? "—" : `${d >= 0 ? "+" : "−"}${Math.abs(d)} %`);
const lista2 = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs.at(-1)}`);

/** Hechos de la semana con su marcador, sacados de los datos (Claude los usa para el repaso). */
export function hechosSemana(w, { descarga = null } = {}) {
  const h = [];
  const k = w.kpis;
  if (w.pausa) return [{ marca: "→", texto: "Semana de pausa declarada: no cuenta para la racha ni para las medias." }];
  const masVolumen = k.toneladas.media4 !== null && k.toneladas.valor > k.toneladas.media4;
  if (w.estado === "cumplida") h.push({ marca: "✓", texto: `Cumpliste el objetivo: ${w.sesiones} de ${w.objetivo} sesiones${masVolumen ? " y con más volumen que tu media" : ""}.` });
  else if (w.estado === "en_curso") h.push({ marca: "▲", texto: `Vas por ${w.sesiones} de ${w.objetivo} sesiones y la semana sigue en curso.` });
  else h.push({ marca: "▲", texto: `Te quedaste en ${w.sesiones} de ${w.objetivo} sesiones.${w.sueno !== null && w.sueno < 6.5 ? ` Coincide con una semana de poco sueño (media ${num(w.sueno)} h).` : ""}` });
  if (w.prs.length) h.push({ marca: "★", texto: `${w.prs.length} PR${w.prs.length === 1 ? "" : "s"}: ${w.prs.map((p) => `${p.nombre.toLowerCase()} ${p.texto}`).join(", ")}.` });
  const bajos = w.grupos_cmp.filter((g) => g.aviso).map((g, i) => (i === 0 ? g.nombre : g.nombre.toLowerCase()));
  if (bajos.length) h.push({ marca: "▲", texto: `${lista2(bajos)} se ${bajos.length > 1 ? "han" : "ha"} quedado por debajo del 70 % de tu media.` });
  for (const m of w.molestias) h.push({ marca: "!", texto: `Molestias en ${m.zona === "lumbar" ? "la zona lumbar" : `${/^(rodilla|muñeca|espalda|cadera)/.test(m.zona) ? "la" : "el"} ${m.zona}`} (${m.sesiones} sesi${m.sesiones === 1 ? "ón" : "ones"}${m.estado === "dolor" ? ", con dolor" : ""})${m.repite ? "; se repite: valora consultarlo" : ""}.` });
  if (descarga) h.push({ marca: "→", texto: `${descarga.texto} (${descarga.motivo}).` });
  return h;
}

export function textoDatosSemana(c, w, existe) {
  const k = w.kpis;
  const estado = { cumplida: "cumplida", a1: "a 1 sesión", fallada: "no cumplida", pausa: "pausa declarada", en_curso: "en curso" }[w.estado];
  const r1 = (x) => (x === null ? "—" : num(x, 1));
  const desc = w.clave === semanaDe(c)?.clave ? descarga(c, inicioSemana(c.base.hoy, c.config.semana_empieza || "lunes")) : null;
  const lineas = [
    `SEMANA ${w.clave} · ${fechaCorta(w.inicio)} – ${fechaCorta(w.fin)} ${w.fin.slice(0, 4)} · FICHERO semanas/${w.clave}.md${existe ? " (ya existe: se reemplaza, con copia)" : ""}`,
    "", "Datos calculados por gymhub (no cambies ninguna cifra):",
    `- Sesiones: ${w.sesiones}${w.objetivo ? ` de ${w.objetivo}` : ""} · ${estado} · racha de semanas cumplidas: ${w.racha}`,
    `- Volumen: ${r1(k.toneladas.valor)} t (${pctTxt(k.toneladas.delta_anterior)} frente a la anterior, ${pctTxt(k.toneladas.delta_media4)} frente a la media de 4 semanas)`,
    `- Series de trabajo: ${num(k.series.valor, 0)} (${pctTxt(k.series.delta_anterior)} · ${pctTxt(k.series.delta_media4)})`,
    `- Intensidad media: ${k.intensidad.valor === null ? "—" : `${r1(k.intensidad.valor)} %`} (${pctTxt(k.intensidad.delta_anterior)} · ${pctTxt(k.intensidad.delta_media4)})`,
    `- PRs: ${w.prs.length}${w.prs.length ? ` · ${w.prs.map((p) => `${p.nombre.toLowerCase()} ${p.texto} (${fechaCorta(p.fecha)})`).join(" · ")}` : ""}`,
    `- Series por grupo (semana / media de 4): ${w.grupos_cmp.map((g) => `${g.nombre.toLowerCase()} ${num(g.series)}/${g.media4 === null ? "—" : num(g.media4)}${g.aviso ? " ▲" : ""}`).join(" · ")}`,
    `- Molestias: ${w.molestias.length ? w.molestias.map((m) => `${m.zona} (${m.estado}, ${m.sesiones} sesiones${m.repite ? ", se repite" : ""})`).join(" · ") : "ninguna anotada"}`,
    `- Sueño medio: ${w.sueno === null ? "—" : `${num(w.sueno)} h`}`,
    "", "Hechos para el repaso (escoge y redacta; como mucho 5 líneas, cada una con su marcador ✓ ★ ▲ ! →):",
    ...hechosSemana(w, { descarga: desc }).map((h) => `${h.marca} ${h.texto}`),
    "→ La acción para la semana que viene: según la respuesta a «¿Qué priorizas la semana que viene?» y estos datos.",
  ];
  return lineas.join("\n");
}

registrar("semana", "[AAAA-Www|anterior] | guardar <AAAA-Www> < texto: datos de la semana para el repaso, o guardar el repaso (semanas/AAAA-Www.md)", async ({ pos, op }) => {
  const carpeta = carpetaObligatoria(op);
  const c = contexto(carpeta);
  if (pos[0] === "guardar") {
    const clave = String(pos[1] ?? "").toUpperCase().replace(/^(\d{4})W/, "$1-W");
    const w = semanaDe(c, clave);
    if (!w) { console.log(`No hay datos de la semana «${pos[1] ?? ""}» (usa AAAA-Www, por ejemplo 2026-W44).`); return 2; }
    const d = new Date();
    const generado = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    const r = componerRepaso(clave, readFileSync(0, "utf8"), generado);
    if (r.errores.length) { console.log(`NO SE HA GUARDADO NADA. Corrige y reenvía:\n- ${r.errores.join("\n- ")}`); return 2; }
    const destino = join(rutas(carpeta).semanas, `${clave}.md`);
    const antes = leerTexto(destino);
    if (antes !== null && antes !== r.texto) escribirAtomico(join(rutas(carpeta).copias, `semanas__${clave}.md.${Date.now()}`), antes);
    escribirAtomico(destino, r.texto);
    ponerNavegar(carpeta, "semana", { filtro: clave });
    await derivarCarpeta(carpeta);
    publicar(carpeta);
    console.log(`Repaso guardado en semanas/${clave}.md. La pestaña Semana de la web lo muestra (se actualiza sola).`);
    return 0;
  }
  const ini = semanaPedida(c, pos[0]);
  const w = calcularSemanas(c).find((x) => x.inicio === ini);
  if (!w) { console.log("No hay sesiones en esa semana ni antes: no hay nada que repasar todavía."); return 3; }
  console.log(textoDatosSemana(c, w, existsSync(join(rutas(carpeta).semanas, `${w.clave}.md`))));
  return 0;
});

// ── ejercicio ────────────────────────────────────────────────────────────────────────────
/** Busca un ejercicio por nombre, alias, id o parte del nombre (entre los que tienen historial). */
export function buscarEjercicio(c, texto) {
  const exacto = c.catalogo.buscar(texto);
  if (exacto && c.base.porEjercicio.has(exacto)) return { id: exacto };
  const k = claveTexto(texto);
  const candidatos = [...c.base.porEjercicio.values()].filter((h) => claveTexto(h.nombre).includes(k) || h.id.includes(k.replace(/ /g, "-")) || (h.ficha?.alias || []).some((a) => claveTexto(a).includes(k)));
  if (candidatos.length === 1) return { id: candidatos[0].id };
  if (exacto) return { id: exacto, sinHistorial: true };
  return { candidatos: candidatos.sort((a, b) => b.sesiones.length - a.sesiones.length).slice(0, 6).map((h) => `${h.nombre} (${h.id})`) };
}

registrar("ejercicio", "<nombre> [--no-abrir]: resumen de un ejercicio; la web abre su ficha y la gráfica del Panel pasa a ese ejercicio", async ({ pos, op }) => {
  const carpeta = carpetaObligatoria(op);
  const c = contexto(carpeta);
  const texto = pos.join(" ");
  if (!texto) { console.log("Falta el nombre del ejercicio."); return 2; }
  const r = buscarEjercicio(c, texto);
  if (!r.id) { console.log(r.candidatos.length ? `No sé cuál es «${texto}». ¿Uno de estos? ${r.candidatos.join(" · ")}` : `No encuentro «${texto}» en tu historial.`); return 3; }
  if (r.sinHistorial) { console.log(`«${texto}» es ${c.catalogo.obtener(r.id).nombre} (${r.id}), pero no tienes sesiones con series de trabajo de ese ejercicio.`); return 3; }
  const h = c.base.porEjercicio.get(r.id);
  const E = construirEjercicios(c);
  const f = E.fichas[r.id];
  const lineas = [`${h.nombre} (${h.id}) · ${[NOMBRE_GRUPO[h.ficha?.grupo], h.ficha?.patron, h.ficha?.carga].filter(Boolean).join(" · ")}`];
  if (!f) lineas.push(`- ${h.sesiones.length} sesión(es): hacen falta 3 para su ficha completa. Última: ${h.sesiones.at(-1).fecha} ${h.sesiones.at(-1).mejor?.texto ?? ""}`);
  else {
    const k = f.kpis, esKg = f.escala === "kg";
    const mejor = c.records.find((x) => x.id === r.id);
    lineas.push(`- ${esKg ? "e1RM actual" : "Actual"}: ${k.actual ? (k.actual.texto || `${num(k.actual.valor)} kg`) : "—"} (${k.actual?.fecha_texto ?? "—"}) · mejor: ${mejor ? `${mejor.texto_valor} (${mejor.serie}, ${mejor.fecha})` : "—"}${k.marca ? ` · mayor carga: ${k.marca.texto} (${k.marca.fecha_texto})` : ""}`);
    lineas.push(`- 12 meses: ${k.var12 === null ? "n/d" : `${k.var12 > 0 ? "+" : ""}${num(k.var12)} %`} · frecuencia ${num(k.frecuencia)}/mes · ${f.n_sesiones} sesiones y ${f.n_series} series desde ${f.desde} · ${k.prs} PRs`);
    const p = prediccion(c).find((x) => x.id === r.id);
    if (p) lineas.push(`- Objetivo ${num(p.objetivo)} kg: ${p.texto}${p.pendiente !== undefined && p.estado === "ok" ? ` (+${num(p.pendiente, 2)} kg/sem)` : ""}`);
    lineas.push(`- Últimas sesiones: ${f.ultimas.slice(0, 4).map((s) => `${s.fecha_texto} ${s.mejor}${s.rpe !== null && s.rpe !== undefined ? ` @${num(s.rpe)}` : ""}${s.pr ? " ★" : ""}`).join(" · ")}`);
    const t = f.tabla.filter((x) => x.kg !== null);
    if (t.length) lineas.push(`- Mejor peso por repeticiones: ${t.map((x) => `${x.reps}: ${x.carga}`).join(" · ")}`);
    if (f.notas.length) lineas.push(`- En tus notas: ${f.notas.slice(0, 2).map((n) => `${n.fecha_texto} «${n.texto}»`).join(" · ")}`);
  }
  escribirJSON(join(rutas(carpeta).gymhub, "panel.json"), { ejercicio: r.id });
  ponerNavegar(carpeta, "ejercicios", { filtro: r.id });
  await derivarCarpeta(carpeta);
  const { ruta } = publicar(carpeta);
  if (!op["no-abrir"]) {
    const marca = join(rutas(carpeta).gymhub, "abierta.json");
    const ult = leerJSON(marca, null)?.t;
    if (!ult || Date.now() - new Date(ult).getTime() > 12 * 3600e3) { const a = abrirEnNavegador(ruta); if (a.abierta) escribirJSON(marca, { t: new Date().toISOString() }); }
  }
  lineas.push(`Web: vista Ejercicios en ${h.nombre.toLowerCase()} (la gráfica del Panel también pasa a este ejercicio).`);
  console.log(lineas.join("\n"));
  return 0;
});

// ── revision ─────────────────────────────────────────────────────────────────────────────
export function dudasPendientes(texto) {
  const out = [];
  String(texto ?? "").split("\n").forEach((l, i) => { if (/^\s*- \[ \]/.test(l)) out.push({ n: out.length + 1, linea: i, texto: l.replace(/^\s*- \[ \]\s*/, "") }); });
  return out;
}

registrar("revision", "[marcar <n> [--nota texto]]: lista las dudas pendientes de revision.md o marca una como resuelta", ({ pos, op }) => {
  const carpeta = carpetaObligatoria(op);
  const r = rutas(carpeta);
  const texto = leerTexto(r.revision, "");
  const dudas = dudasPendientes(texto);
  if (pos[0] === "marcar") {
    const d = dudas.find((x) => x.n === Number(pos[1]));
    if (!d) { console.log(`No hay duda pendiente número ${pos[1]}.`); return 2; }
    const lineas = texto.split("\n");
    const nota = op.nota && op.nota !== true ? ` · resuelto ${hoyISO()}: ${op.nota}` : ` · resuelto ${hoyISO()}`;
    lineas[d.linea] = lineas[d.linea].replace("- [ ]", "- [x]") + nota;
    escribirAtomico(r.revision, lineas.join("\n"));
    console.log(`Duda ${d.n} marcada como resuelta. Quedan ${dudas.length - 1}.`);
    return 0;
  }
  if (!dudas.length) { console.log("No hay dudas pendientes en revision.md."); return 0; }
  console.log(`${dudas.length} duda${dudas.length === 1 ? "" : "s"} pendiente${dudas.length === 1 ? "" : "s"}:`);
  for (const d of dudas) {
    const f = d.texto.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
    const ses = f ? [`sesiones/${f.slice(0, 4)}/${f}.md`, ...[2, 3].map((k) => `sesiones/${f.slice(0, 4)}/${f}-${k}.md`)].filter((p) => existsSync(join(carpeta, p))) : [];
    console.log(`${d.n}. ${d.texto}${ses.length ? `  [${ses.join(", ")}]` : ""}`);
  }
  return 0;
});

registrar("corregir", "<ruta de la sesión> < texto: reemplaza una sesión corregida en /gymhub:revision (valida, guarda copia y la protege)", async ({ pos, op }) => {
  const carpeta = carpetaObligatoria(op);
  const r = rutas(carpeta);
  const abs = rutaSegura(carpeta, pos.join(" "));
  const rel = relative(carpeta, abs).split("\\").join("/");
  if (!/^sesiones\/\d{4}\/\d{4}-\d{2}-\d{2}(-\d+)?\.md$/.test(rel) || !existsSync(abs)) { console.log(`No existe la sesión ${rel}.`); return 2; }
  const nuevo = readFileSync(0, "utf8");
  const antes = readFileSync(abs, "utf8");
  const s = leerSesion(nuevo, rel);
  const viejo = leerSesion(antes, rel);
  const { leerCatalogo } = await import("./catalogo.mjs");
  const errores = validarSesion(s, leerCatalogo(leerTexto(r.ejercicios, "")));
  if (errores.length) { console.log(`NO SE HA CAMBIADO NADA:\n- ${errores.join("\n- ")}`); return 2; }
  let texto = nuevo.replace(/\s*$/, "\n");
  if (!s.original && viejo.original) texto += `\n<details><summary>Original</summary>\n\n${viejo.original}\n\n</details>\n`;
  escribirAtomico(join(r.copias, `${rel.replace(/\//g, "__")}.${Date.now()}`), antes);
  escribirAtomico(abs, texto);
  // Corregida a petición de la persona: pasa a contar como editada a mano (no se reemplaza nunca).
  const generadas = leerJSON(r.generadas, {}) ?? {};
  delete generadas[rel];
  escribirJSON(r.generadas, generadas);
  await recalcular(carpeta);
  publicar(carpeta);
  console.log(`${rel} corregida (copia de la anterior en .gymhub/copias/). El original se conserva.`);
  return 0;
});

// ── discos ───────────────────────────────────────────────────────────────────────────────
registrar("discos", "<kg>: discos por lado para ese peso total; la calculadora de la web se pone en ese valor", async ({ pos, op }) => {
  const kg = Number(String(pos[0] ?? "").replace(",", "."));
  if (!isFinite(kg) || kg <= 0) { console.log("Dime un peso total en kg, por ejemplo: discos 120"); return 2; }
  const cfg = leerConfig();
  const r = discosPorLado(kg, { barra: cfg.barra_kg, discos: cfg.discos_kg });
  console.log(`${num(kg, 2)} kg con barra de ${num(cfg.barra_kg)} kg: ${textoDiscos(r)}`);
  const carpeta = (() => { try { return carpetaObligatoria(op); } catch { return null; } })();
  if (carpeta) {
    escribirJSON(join(rutas(carpeta).gymhub, "discos.json"), { kg });
    ponerNavegar(carpeta, "progreso", { kg });
    await derivarCarpeta(carpeta);
    publicar(carpeta);
  }
  return 0;
});
