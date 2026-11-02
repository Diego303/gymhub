// G1 · Casos de entrenamiento y entradas hostiles: se leen bien o dan un error claro con su línea,
// nunca un cálculo silenciosamente erróneo. Las cifras esperadas están calculadas a mano.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { leerSesion, escribirSesion, validarSesion } from "../lib/canonico.mjs";
import { calcularBase } from "../lib/base.mjs";
import { leerCatalogo } from "../lib/catalogo.mjs";
import { cargarSesiones } from "../lib/sesiones.mjs";
import { RAIZ, temporal } from "./ayuda.mjs";

const CAT = leerCatalogo(readFileSync(join(RAIZ, "templates/GIMNASIO/ejercicios.md"), "utf8"));
const CAB = "| # | tipo | carga | reps | rpe | rir | nota |\n|---|---|---|---|---|---|---|";
/** Una sesión con ejercicios dados como [título, id, filas «tipo | carga | reps | rpe | rir | nota»]. */
const sesion = (ejs, { fecha = "2026-03-12", fm = "", cuerpo = "" } = {}) => `---\nfecha: ${fecha}\ntitulo: Prueba\nconfianza: alta\n${fm}---\n\n# ${fecha} · Prueba\n\n## Ejercicios\n\n` +
  ejs.map(([t, id, filas]) => `### ${t}\n<!-- id: ${id} -->\n${CAB}\n${filas.map((f, i) => `| ${i + 1} | ${f} |`).join("\n")}\n`).join("\n") + cuerpo;
const base = (...textos) => {
  const ss = textos.map((t, i) => leerSesion(t, `sesiones/2026/${["2026-03-12", "2026-03-12-2", "2026-03-13"][i] ?? "2026-03-14"}.md`));
  for (const s of ss) assert.deepEqual(validarSesion(s, CAT), [], s.ruta);
  return calcularBase(ss, { catalogo: CAT, hoy: "2026-03-20" });
};
const ton = (b) => Math.round(b.sesiones.reduce((a, s) => a + s.toneladas_kg, 0) * 1000) / 1000;

test("calentamiento y aproximación no cuentan; top, backoff, dropset, amrap, myo y cluster sí", () => {
  const b = base(sesion([["Sentadilla", "sentadilla", [
    "calentamiento | 20 kg | 10 | | | ", "aproximacion | 60 kg | 5 | | | ", "top | 120 kg | 3 | 9 | | ", "backoff | 100 kg | 5 | 8 | | ",
    "dropset | 80 kg | 8 | | | ", "amrap | 60 kg | 12 | | | ", "myo | 50 kg | 5 | | | ", "cluster | 100 kg | 2 | | | ", "no_hecho | 100 kg | 5 | | | no me dio tiempo"]]]));
  const s = b.sesiones[0];
  assert.equal(s.series_trabajo, 6);
  // 120×3 + 100×5 + 80×8 + 60×12 + 50×5 + 100×2 = 360 + 500 + 640 + 720 + 250 + 200 = 2670
  assert.equal(s.toneladas_kg, 2670);
  // e1RM del día: el mejor de trabajo = 120 × (1 + 3/30) = 132 (no la aproximación)
  assert.equal(Math.round(b.porEjercicio.get("sentadilla").sesiones[0].e1rm * 100) / 100, 132);
});

test("superseries (A1/A2) y circuitos con su formato en la nota", () => {
  const t = `---\nfecha: 2026-03-12\nconfianza: alta\n---\n\n## Ejercicios\n\n### A1 · Dominadas\n<!-- id: dominadas · superserie: A -->\n${CAB}\n| 1 | trabajo | PC | 8 | | | EMOM 10 min |\n\n### A2 · Fondos\n<!-- id: fondos · superserie: A -->\n${CAB}\n| 1 | trabajo | PC | 10 | | | |\n`;
  const s = leerSesion(t);
  assert.deepEqual(s.ejercicios.map((e) => [e.nombre, e.superserie, e.orden_superserie]), [["Dominadas", "A", 1], ["Fondos", "A", 2]]);
  assert.equal(s.ejercicios[0].series[0].nota, "EMOM 10 min");
  assert.equal(leerSesion(escribirSesion(s)).ejercicios[1].superserie, "A");
});

test("unilaterales y mancuernas: «10/10» y «/lado» o «/mano» cuentan bien", () => {
  const b = base(sesion([
    ["Sentadilla búlgara", "sentadilla-bulgara", ["trabajo | 20 kg/mano | 10/10 | | | "]],   // 2 × 20 kg × 20 reps = 800
    ["Remo con mancuerna", "remo-mancuerna", ["trabajo | 30 kg | 12/10 | | | "]],          // 30 × 22 = 660; e1RM con 10 (el lado flojo)
    ["Prensa", "prensa", ["trabajo | 50 kg/lado | 10 | | | "]],                            // 2 × 50 × 10 = 1000
  ]));
  assert.equal(ton(b), 2460);
  assert.equal(Math.round(b.porEjercicio.get("remo-mancuerna").sesiones[0].e1rm * 100) / 100, 40); // 30 × (1 + 10/30)
});

test("peso corporal, lastre y asistidas (PC±n) con y sin peso corporal conocido", () => {
  const sin = base(sesion([["Dominadas", "dominadas", ["trabajo | PC+10 kg | 5 | | | ", "trabajo | PC-20 kg | 8 | | | ", "trabajo | PC | 10 | | | "]]]));
  assert.equal(sin.sesiones[0].toneladas_kg, 0, "sin peso corporal no hay toneladas");
  assert.equal(sin.sesiones[0].series_trabajo, 3, "pero las series cuentan");
  assert.equal(sin.porEjercicio.get("dominadas").escala, "lastre");
  const con = base(sesion([["Dominadas", "dominadas", ["trabajo | PC+10 kg | 5 | | | ", "trabajo | PC-20 kg | 8 | | | ", "trabajo | PC | 10 | | | "]]], { fm: "peso_corporal_kg: 80\n" }));
  // 90×5 + 60×8 + 80×10 = 450 + 480 + 800 = 1730; e1RM: el mejor de 90 × (1 + 5/30) = 105, 60 × (1 + 8/30) = 76 y 80 × (1 + 10/30) = 106,67
  assert.equal(con.sesiones[0].toneladas_kg, 1730);
  assert.equal(con.porEjercicio.get("dominadas").escala, "kg");
  assert.equal(Math.round(con.porEjercicio.get("dominadas").sesiones[0].e1rm * 100) / 100, 106.67);
});

test("isométricos por tiempo y cardio por tiempo o distancia", () => {
  const t = sesion([["Plancha", "plancha", ["trabajo | PC | 45s | | | ", "trabajo | PC | 1 min | | | ", "trabajo | PC+10 kg | 30s | | | "]]], {
    cuerpo: "\n## Cardio\n| actividad | minutos | distancia_km | ritmo | pulso_medio | kcal | nota |\n|---|---|---|---|---|---|---|\n| cinta | 20 | 2,5 | | 130 | | inclinación 10 |\n| remo | | 2 | | | | |\n",
  });
  const b = base(t);
  const series = b.sesiones[0].ejercicios[0].series;
  assert.deepEqual(series.map((x) => x.reps.s), [45, 60, 30]);
  assert.equal(b.porEjercicio.get("plancha").escala, "tiempo");
  assert.equal(b.sesiones[0].toneladas_kg, 0);
  assert.deepEqual(b.sesiones[0].cardio.map((c) => [c.actividad, c.minutos, c.distancia_km]), [["cinta", 20, 2.5], ["remo", null, 2]]);
  assert.equal(b.sesiones[0].cardio_min, 20);
});

test("RPE y RIR con decimales (punto o coma); solo RIR → RPE = 10 − RIR", () => {
  const s = leerSesion(sesion([["Press banca", "press-banca", ["trabajo | 80 kg | 5 | 8.5 | | ", "trabajo | 80 kg | 5 | 8,5 | | ", "trabajo | 80 kg | 5 | | 1.5 | ", "trabajo | 80 kg | 5 | 7-8 | | "]]]));
  assert.deepEqual(s.ejercicios[0].series.map((x) => [x.rpe, x.rir]), [[8.5, null], [8.5, null], [null, 1.5], [7.5, null]]);
  assert.ok(s.avisos.some((a) => /RPE en rango «7-8», guardado como 7.5/.test(a)));
  const b = base(sesion([["Press banca", "press-banca", ["trabajo | 80 kg | 5 | | 1.5 | "]]]));
  assert.equal(b.sesiones[0].rpe_medio, 8.5);
});

test("kg y lb (× 0,4536) y coma decimal", () => {
  const b = base(sesion([["Press banca", "press-banca", ["trabajo | 185 lb | 5 | | | ", "trabajo | 62,5 kg | 5 | | | ", "trabajo | 7'5 kg | 10 | | | "]]]));
  const [a, c, d] = b.sesiones[0].ejercicios[0].series;
  assert.equal(a.kg, 185 * 0.4536); // 83,916 kg
  assert.equal(c.kg, 62.5);
  assert.equal(d.kg, 7.5);
  // 83,916×5 + 62,5×5 + 7,5×10 = 419,58 + 312,5 + 75 = 807,08
  assert.equal(Math.round(b.sesiones[0].toneladas_kg * 100) / 100, 807.08);
});

test("series sin carga o sin reps: cuentan como series, no como toneladas ni e1RM", () => {
  const b = base(sesion([["Press banca", "press-banca", ["trabajo |  | 10 | | | ", "trabajo | 80 kg |  | | | ", "trabajo | 80 kg | fallo | | | "]]]));
  const s = b.sesiones[0];
  assert.equal(s.series_trabajo, 3);
  assert.equal(s.toneladas_kg, 0);
  assert.equal(b.porEjercicio.get("press-banca").sesiones[0].e1rm, null);
});

test("notas por serie y por sesión, y una sesión sin ejercicios (cuenta para la racha, no para el volumen)", () => {
  const sinEj = `---\nfecha: 2026-03-13\ntitulo: Hoy pierna\ntipo: pierna\nconfianza: media\n---\n\n## Notas\nSin detalle, pero fui.\n`;
  const conEj = sesion([["Press banca", "press-banca", ["trabajo | 80 kg | 5 | | | pausa 1 s"]]], { cuerpo: "\n## Notas\nBien, el hombro mejor.\n" });
  const b = base(conEj, `---\nfecha: 2026-03-12\nconfianza: media\n---\n`, sinEj);
  assert.equal(b.sesiones.find((s) => s.fecha === "2026-03-13").sin_detalle, true);
  const con = b.sesiones.find((s) => s.ruta === "sesiones/2026/2026-03-12.md");
  assert.equal(con.notas, "Bien, el hombro mejor.");
  assert.equal(con.ejercicios[0].series[0].nota, "pausa 1 s");
  assert.equal(b.racha.mejor, 2, "12 y 13 de marzo seguidos");
});

test("varias sesiones el mismo día (AAAA-MM-DD-2.md): cuentan las dos", () => {
  const t = temporal();
  try {
    const dir = join(t.dir, "sesiones", "2026");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "2026-03-12.md"), sesion([["Press banca", "press-banca", ["trabajo | 80 kg | 5 | | | "]]]));
    writeFileSync(join(dir, "2026-03-12-2.md"), sesion([["Sentadilla", "sentadilla", ["trabajo | 100 kg | 5 | | | "]]]));
    const { validas, conErrores } = cargarSesiones(t.dir, CAT);
    assert.deepEqual(conErrores, []);
    const b = calcularBase(validas, { catalogo: CAT, hoy: "2026-03-20" });
    assert.equal(b.total_sesiones, 2);
    assert.equal(ton(b), 900);
    assert.equal(b.racha.actual, 0, "más de 4 días sin entrenar hasta el 20");
  } finally { t.limpiar(); }
});

test("lo que no se entiende es un error claro con su línea (nunca un número silenciosamente mal)", () => {
  const casos = [
    ["trabajo | 80 | 5 | | | ", /carga no válida «80»/],                 // sin unidad: no se supone kg
    ["trabajo | 80kgs | 5 | | | ", /carga no válida «80kgs»/],
    ["trabajo | 3x10 50kg | | | | ", /carga no válida «3x10 50kg»/],      // notación sin normalizar
    ["trabajo | 80 kg | 10-12 | | | ", /repeticiones no válidas «10-12»/],
    ["trabajo | 80 kg | 5 | 11 | | ", /RPE fuera de 1-10/],
    ["trabajo | 80 kg | 5 | muy duro | | ", /RPE no válido «muy duro»/],
    ["trabajo | 80 kg | 5 | | 12 | ", /RIR fuera de rango/],
    ["serie | 80 kg | 5 | | | ", /tipo de serie desconocido «serie»/],
  ];
  for (const [fila, re] of casos) {
    const e = validarSesion(leerSesion(sesion([["Press banca", "press-banca", [fila]]])), CAT).join("\n");
    assert.match(e, re, fila);
    assert.match(e, /\(línea 15\)/, `la línea del error: ${fila}`);
  }
});

test("entradas hostiles: tabuladores, espacios al final, fichero vacío, secciones raras, emojis, HTML y fechas", () => {
  const tabs = sesion([["Press banca", "press-banca", ["trabajo\t|\t80 kg\t|\t5\t|\t\t|\t\t|\t"]]]).replace(/\n/g, "   \n");
  const s = leerSesion(tabs);
  assert.deepEqual(validarSesion(s, CAT), []);
  assert.equal(s.ejercicios[0].series[0].carga.valor, 80);
  assert.match(leerSesion("").errores[0], /falta el frontmatter/);
  const raro = leerSesion(sesion([], { cuerpo: "\n## Lo que comí 🍝\nmacarrones <script>alert(1)</script>\n\n## Notas\nñandú «bien» <img src=x onerror=alert(1)>\n" }));
  assert.equal(raro.otras["Lo que comí 🍝"], "macarrones <script>alert(1)</script>");
  assert.equal(raro.notas, "ñandú «bien» <img src=x onerror=alert(1)>");
  for (const [fecha, re] of [["2026-02-30", /fecha imposible/], ["12/03/2026", /fecha no válida «12\/03\/2026» \(AAAA-MM-DD\)/], ["2026-3-12", /fecha no válida/], ["", /fecha no válida/]]) {
    assert.match(leerSesion(sesion([], { fecha })).errores.join("\n"), re, fecha);
  }
  assert.match(validarSesion(leerSesion(sesion([], { fecha: "2031-01-01" })), CAT, { hoy: "2026-11-01" }).join(), /fecha en el futuro/);
});

test("un ejercicio que no está en el catálogo se marca y la sesión no se pierde", () => {
  const t = temporal();
  try {
    mkdirSync(join(t.dir, "sesiones", "2026"), { recursive: true });
    const f = join(t.dir, "sesiones", "2026", "2026-03-12.md");
    const texto = sesion([["Press raro", "press-raro", ["trabajo | 50 kg | 5 | | | "]]]);
    writeFileSync(f, texto);
    const { validas, conErrores } = cargarSesiones(t.dir, CAT);
    assert.equal(validas.length, 0);
    assert.match(conErrores[0].errores[0], /Press raro: el id «press-raro» no está en el catálogo \(línea 11\)/);
    assert.equal(readFileSync(f, "utf8"), texto, "el fichero no se toca");
  } finally { t.limpiar(); }
});

test("el ejemplo de sesión de FORMATO §2 se lee sin errores y vuelve igual", () => {
  const t = readFileSync(join(RAIZ, "tests/fixtures/formato/ejemplo-formato.md"), "utf8");
  const s = leerSesion(t, "sesiones/2026/2026-03-12.md");
  assert.deepEqual(validarSesion(s, CAT), []);
  assert.deepEqual(s.molestias, [{ zona: "hombro", lado: "izq", estado: "molestia" }]);
  assert.equal(s.ejercicios.length, 4);
  assert.deepEqual(s.ejercicios.map((e) => e.id), ["press-banca", "dominadas", "fondos", "plancha"]);
  assert.equal(s.cardio[0].nota, "inclinación 10");
  const b = calcularBase([s], { catalogo: CAT, hoy: "2026-03-12" });
  assert.equal(b.sesiones[0].toneladas_kg, 800, "solo las 2 series de trabajo de banca: 80 × 5 × 2");
  const r = leerSesion(escribirSesion(s), s.ruta);
  assert.equal(escribirSesion(r), escribirSesion(s));
});
