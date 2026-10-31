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
import { horasMinutos } from "./panel.mjs";

// ── semana ───────────────────────────────────────────────────────────────────────────────
/** Lunes (o domingo) de la semana pedida: «2026-W44», «anterior» o nada (la actual; si está vacía, la anterior). */
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
  const hay = c.base.sesiones.some((s) => s.fecha >= actual && s.fecha <= c.base.hoy);
  return hay ? actual : sumarDias(actual, -7);
}

export function resumenSemana(c, ini) {
  const { base, ficha } = c;
  const fin = sumarDias(ini, 6);
  const anio = aFecha(base.hoy).getFullYear();
  const ses = base.sesiones.filter((s) => s.fecha >= ini && s.fecha <= fin);
  const ant = base.sesiones.filter((s) => s.fecha >= sumarDias(ini, -7) && s.fecha <= sumarDias(ini, -1));
  const t = sumar(ses.map((s) => s.toneladas_kg)) / 1000, tAnt = sumar(ant.map((s) => s.toneladas_kg)) / 1000;
  const grupos = {};
  for (const s of ses) for (const [g, v] of Object.entries(s.grupos)) grupos[g] = (grupos[g] || 0) + v;
  const rpes = ses.flatMap((s) => s.ejercicios.flatMap((e) => e.series.filter((x) => x.trabajo && x.rpeEf !== null).map((x) => x.rpeEf)));
  const zonas = new Map();
  for (const s of ses) for (const m of s.molestias) { const z = nombreZona(m); zonas.set(z, [...(zonas.get(z) || []), m.estado]); }
  const clave = semanaISO(ini).clave;
  return {
    clave, inicio: ini, fin, sesiones: ses, objetivo: ficha.dias_semana || null,
    series: sumar(ses.map((s) => s.series_trabajo)), toneladas: t, delta: tAnt ? Math.round((t / tAnt - 1) * 100) : null,
    prs: ses.flatMap((s) => s.prs.map((p) => ({ ...p, fecha_texto: fechaCorta(p.fecha, anio) }))),
    rpe: media(rpes), sueno: media(ses.map((s) => s.sueno_h)), pre: media(ses.map((s) => s.pre)), post: media(ses.map((s) => s.post)),
    grupos: Object.entries(ficha.series_objetivo || {}).filter(([k]) => AGREGADOS[k] || GRUPOS.includes(k)).map(([k, o]) => ({ nombre: NOMBRE_GRUPO[k] ?? k, series: seriesGrupo(grupos, k), objetivo: o })),
    molestias: [...zonas.entries()].map(([z, est]) => ({ zona: z, estados: est })),
  };
}

export function textoSemana(c, r) {
  const anio = aFecha(c.base.hoy).getFullYear();
  const lineas = [`# Semana ${r.clave} (${fechaCorta(r.inicio, anio)} – ${fechaCorta(r.fin, anio)})`, "", "## Cifras (calculadas por gymhub)", ""];
  lineas.push(`- Sesiones: ${r.sesiones.length}${r.objetivo ? ` de ${r.objetivo}` : ""}${r.sesiones.length ? ` · ${r.sesiones.map((s) => `${DIAS[diaSemana(s.fecha)]} ${s.titulo || s.tipo || "sesión"}`).join(" · ")}` : ""}`);
  lineas.push(`- Series de trabajo: ${num(r.series, 0)} · volumen ${num(r.toneladas, 1)} t${r.delta !== null ? ` (${r.delta >= 0 ? "+" : "−"}${Math.abs(r.delta)} % frente a la semana anterior)` : ""}`);
  lineas.push(`- PRs: ${r.prs.length ? r.prs.map((p) => `${p.nombre.toLowerCase()} ${p.texto} (${p.fecha_texto})`).join(" · ") : "ninguno"}`);
  lineas.push(`- Esfuerzo y descanso: RPE medio ${r.rpe === null ? "—" : num(r.rpe)} · sueño medio ${horasMinutos(r.sueno) ?? "—"} · sensación antes ${r.pre === null ? "—" : num(r.pre)} / después ${r.post === null ? "—" : num(r.post)}`);
  if (r.grupos.length) lineas.push(`- Series por grupo: ${r.grupos.map((g) => `${g.nombre.toLowerCase()} ${num(g.series)}/${num(g.objetivo)}${g.series < 0.7 * g.objetivo ? " ▲" : ""}`).join(" · ")}`);
  lineas.push(`- Molestias: ${r.molestias.length ? r.molestias.map((m) => `${m.zona} (${m.estados.join(" → ")})`).join(" · ") : "ninguna anotada"}`);
  const ac = agudaCronica(c.base);
  const d = descarga(c, inicioSemana(c.base.hoy, c.config.semana_empieza || "lunes"));
  const est = estancados(c.base).slice(0, 3);
  lineas.push(`- Carga aguda:crónica (hoy): ${ac.valor === null ? `n/d (${ac.motivo})` : num(ac.valor, 2)}${d ? ` · ${d.texto} (${d.motivo})` : ""}`);
  if (est.length) lineas.push(`- Estancados: ${est.map((e) => `${e.nombre.toLowerCase()} (${e.semanas} sem)`).join(" · ")}`);
  lineas.push("", "## Qué ajustar", "<!-- Lo redacta Claude con /gymhub:semana a partir de estas cifras: 2 a 4 viñetas, sin cifras nuevas ni consejo médico. -->", "");
  return lineas.join("\n");
}

registrar("semana", "[AAAA-Www|anterior]: borrador del resumen semanal con las cifras (para semanas/AAAA-Www.md)", ({ pos, op }) => {
  const carpeta = carpetaObligatoria(op);
  const c = contexto(carpeta);
  const ini = semanaPedida(c, pos[0]);
  const r = resumenSemana(c, ini);
  const destino = `semanas/${r.clave}.md`;
  console.log(`FICHERO: ${destino}${existsSync(join(carpeta, destino)) ? " (ya existe: se reemplazará con copia)" : ""}\n`);
  console.log(textoSemana(c, r));
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
