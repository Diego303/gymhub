// Registro en vivo (opcional, Fase 7): /gymhub:entreno, /gymhub:serie y /gymhub:fin.
// Lo que apuntas va, tal cual, a CONTEXTO/AAAA-MM-DD-en-vivo.md, que luego importa /refresh.
// El estado del entreno (rutina, casillas, descanso) vive en .gymhub/vivo.json y lo pinta la web.
import { existsSync, appendFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { rutas, leerConfig, esWSL } from "./config.mjs";
import { registrar, carpetaObligatoria, lista } from "./registro.mjs";
import { contexto, derivarCarpeta } from "./derivar.mjs";
import { publicar } from "./publicar.mjs";
import { rutinaHoy } from "./panel.mjs";
import { leerPlantillas } from "./plantillas.mjs";
import { discosPorLado } from "./discos.mjs";
import { leerJSON, escribirJSON, hoyISO, claveTexto, num } from "./util.mjs";

/** Calentamiento (PLAN §3.1): barra × 10, 50 % × 5, 70 % × 3 y 85 % × 1 del peso de trabajo, a disco disponible. */
export function calentamiento(W, { barra = 20, discos = [25, 20, 15, 10, 5, 2.5, 1.25] } = {}) {
  if (!W || W <= barra) return [];
  const paso = Math.min(...discos) * 2;
  const redondear = (kg) => Math.max(barra, barra + Math.round((kg - barra) / paso) * paso);
  const pasos = [[barra, 10], [redondear(W * 0.5), 5], [redondear(W * 0.7), 3], [redondear(W * 0.85), 1]];
  const out = [];
  for (const [kg, reps] of pasos) if (!out.some((p) => p.kg === kg) && (kg === barra || kg < W)) out.push({ kg, reps, discos: discosPorLado(kg, { barra, discos })?.por_lado ?? [] });
  return out;
}

/** Desfase del reloj de Windows respecto al de WSL (ms), medido una vez por hora. 0 fuera de WSL. */
export function desfaseReloj(carpeta) {
  if (!esWSL() || process.env.GYMHUB_NO_AVISO === "1") return 0;
  const f = join(rutas(carpeta).gymhub, "reloj.json");
  const c = leerJSON(f, null);
  if (c && Date.now() - c.medido < 3600e3) return c.desfase_ms;
  try {
    const a = Date.now();
    const w = Number(execFileSync("powershell.exe", ["-NoProfile", "-Command", "[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()"], { cwd: "/mnt/c", timeout: 8000 }).toString().trim());
    const b = Date.now();
    const desfase = Math.round(w - (a + b) / 2);
    escribirJSON(f, { medido: Date.now(), desfase_ms: desfase });
    return desfase;
  } catch { return 0; }
}

/** Aviso de escritorio al terminar el descanso (proceso suelto que espera y avisa; se puede desactivar). */
export function avisarFinDescanso(segundos, texto = "Fin del descanso: ¡a por la siguiente serie!") {
  if (process.env.GYMHUB_NO_AVISO === "1" || leerConfig().aviso_descanso === false) return "sin aviso";
  try {
    if (esWSL()) {
      const ps = `Start-Sleep -Seconds ${Math.round(segundos)}; [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null; $t = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02); $x = $t.GetElementsByTagName('text'); $x.Item(0).AppendChild($t.CreateTextNode('gymhub')) > $null; $x.Item(1).AppendChild($t.CreateTextNode('${texto.replace(/'/g, "''")}')) > $null; [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe').Show([Windows.UI.Notifications.ToastNotification]::new($t))`;
      spawn("powershell.exe", ["-NoProfile", "-WindowStyle", "Hidden", "-Command", ps], { detached: true, stdio: "ignore", cwd: "/mnt/c" }).unref();
    } else if (process.platform === "darwin") {
      spawn("sh", ["-c", `sleep ${Math.round(segundos)}; osascript -e 'display notification "${texto}" with title "gymhub"'`], { detached: true, stdio: "ignore" }).unref();
    } else {
      spawn("sh", ["-c", `sleep ${Math.round(segundos)}; notify-send gymhub "${texto}" 2>/dev/null || printf '\\a'`], { detached: true, stdio: "ignore" }).unref();
    }
    return `aviso al terminar (${Math.round(segundos)} s)`;
  } catch { return "sin aviso (no se pudo lanzar)"; }
}

const ficheroVivo = (carpeta, hoy) => join(rutas(carpeta).contexto, `${hoy}-en-vivo.md`);
const hora = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

/** La rutina con la que empieza el entreno: la plantilla pedida o la de hoy. */
function elegirRutina(c, nombre) {
  if (nombre) {
    const k = claveTexto(nombre);
    const p = leerPlantillas(rutas(c.carpeta).plantillas, c.catalogo).find((x) => claveTexto(x.nombre).includes(k) || claveTexto(x.archivo).includes(k));
    if (p) return { titulo: p.nombre, tipo: p.tipo, origen: "plantilla", ejercicios: p.ejercicios.map((e) => ({ nombre: (e.id && c.catalogo.obtener(e.id)?.nombre) || e.nombre, id: e.id, prescripcion: e.prescripcion, total: e.series || 3, hechas: 0, descanso_s: e.descanso_s })) };
  }
  const r = rutinaHoy(c);
  if (!r || r.origen === "hecha" || r.origen === "vivo") return r ? { ...r, ejercicios: r.ejercicios.map((e) => ({ ...e, hechas: 0 })) } : null;
  const plantillas = leerPlantillas(rutas(c.carpeta).plantillas, c.catalogo);
  const pl = plantillas.find((p) => p.nombre === r.titulo);
  return { ...r, ejercicios: r.ejercicios.map((e, i) => ({ ...e, id: pl?.ejercicios[i]?.id ?? c.catalogo.buscar(e.nombre), hechas: 0, descanso_s: pl?.ejercicios[i]?.descanso_s ?? null })) };
}

/** Peso de trabajo de un ejercicio: el de la prescripción o el de su última sesión. */
function pesoTrabajo(c, e) {
  const m = String(e.prescripcion ?? "").match(/(\d+(?:[.,]\d+)?)\s*kg(?!\s*\/)/);
  if (m) return Number(m[1].replace(",", "."));
  const h = e.id && c.base.porEjercicio.get(e.id);
  const ult = h?.sesiones.at(-1);
  return ult ? Math.max(0, ...ult.series.map((x) => (x.carga?.tipo === "peso" && !x.carga.por ? x.kg : 0))) || null : null;
}

export function empezarEntreno(carpeta, { plantilla = null } = {}) {
  const c = contexto(carpeta);
  const hoy = c.base.hoy;
  const rutina = elegirRutina(c, plantilla) ?? { titulo: "Entreno libre", tipo: null, origen: "libre", ejercicios: [] };
  const vivo = { entreno: true, fecha: hoy, inicio: new Date().toISOString(), rutina: { ...rutina, origen: "vivo" }, serie_actual: null, descanso_s: null, descanso_inicio_ms: null, reloj_desfase_ms: 0, actualizado: new Date().toISOString() };
  escribirJSON(rutas(carpeta).vivo, vivo);
  const f = ficheroVivo(carpeta, hoy);
  mkdirSync(rutas(carpeta).contexto, { recursive: true });
  if (!existsSync(f)) writeFileSync(f, `# ${hoy} · entreno en vivo (gymhub)\nrutina: ${rutina.titulo}\n`);
  else appendFileSync(f, `${hora()} (vuelvo a empezar: ${rutina.titulo})\n`);
  const cfg = leerConfig();
  const barra = rutina.ejercicios.find((e) => e.id && c.catalogo.obtener(e.id)?.carga === "barra");
  const W = barra ? pesoTrabajo(c, barra) : null;
  return { vivo, rutina, calentamiento: barra && W ? { ejercicio: barra.nombre, peso: W, pasos: calentamiento(W, { barra: cfg.barra_kg, discos: cfg.discos_kg }) } : null, prehab: c.ficha.prehab, fichero: f };
}

export function apuntarSerie(carpeta, { texto, ejercicio = null }) {
  const c = contexto(carpeta);
  const hoy = c.base.hoy;
  const r = rutas(carpeta);
  let vivo = leerJSON(r.vivo, null);
  if (!vivo?.entreno || vivo.fecha !== hoy) vivo = empezarEntreno(carpeta).vivo;
  appendFileSync(ficheroVivo(carpeta, hoy), `${hora()} ${texto}\n`);
  const id = ejercicio ? c.catalogo.buscar(ejercicio) ?? ejercicio : null;
  let e = vivo.rutina.ejercicios.find((x) => id && x.id === id);
  if (!e && id) { e = { nombre: c.catalogo.obtener(id)?.nombre ?? ejercicio, id, prescripcion: "", total: 1, hechas: 0, descanso_s: null }; vivo.rutina.ejercicios.push(e); }
  if (e) { e.hechas += 1; if (e.hechas > e.total) e.total = e.hechas; }
  const cfg = leerConfig();
  const descanso = e?.descanso_s ?? cfg.descanso_s_por_defecto ?? 120;
  Object.assign(vivo, {
    serie_actual: e ? { ejercicio: e.nombre, n: e.hechas, de: e.total } : null, ultima_serie: new Date().toISOString(),
    descanso_s: descanso, descanso_inicio_ms: Date.now(), reloj_desfase_ms: desfaseReloj(carpeta), actualizado: new Date().toISOString(),
  });
  escribirJSON(r.vivo, vivo);
  return { vivo, e, descanso, aviso: avisarFinDescanso(descanso) };
}

export function terminarEntreno(carpeta, { post = null, notas = null } = {}) {
  const r = rutas(carpeta);
  const vivo = leerJSON(r.vivo, null);
  const hoy = vivo?.fecha ?? hoyISO();
  const f = ficheroVivo(carpeta, hoy);
  if (!existsSync(f)) return { error: "no hay entreno en vivo hoy" };
  const extra = [post !== null && post !== undefined ? `sensación post: ${post}` : null, notas ? `notas: ${notas}` : null].filter(Boolean);
  appendFileSync(f, `${hora()} fin del entreno${extra.length ? ` · ${extra.join(" · ")}` : ""}\n`);
  if (vivo) escribirJSON(r.vivo, { ...vivo, entreno: false, descanso_s: null, terminado: new Date().toISOString() });
  return { fichero: f, vivo };
}

const tablaRutina = (rutina) => rutina.ejercicios.map((e) => `  ${e.hechas >= e.total ? "■" : "□"} ${e.nombre}${e.prescripcion ? ` · ${e.prescripcion}` : ""}${e.hechas ? ` (${e.hechas}/${e.total})` : ""}`).join("\n");

registrar("entreno", "[plantilla]: empieza el entreno de hoy (rutina, calentamiento y prehab); Rex pasa a «levantando»", async ({ pos, op }) => {
  const carpeta = carpetaObligatoria(op);
  const r = empezarEntreno(carpeta, { plantilla: pos.join(" ") || null });
  await derivarCarpeta(carpeta);
  publicar(carpeta);
  const lineas = [`Entreno de hoy: ${r.rutina.titulo}${r.rutina.ejercicios.length ? "" : " (sin rutina: apunta lo que hagas con /gymhub:serie)"}`];
  if (r.prehab.length) lineas.push(`Prehab primero: ${r.prehab.map((p) => `${p.zona}: ${p.texto}`).join(" · ")}`);
  if (r.calentamiento) lineas.push(`Calentamiento para ${r.calentamiento.ejercicio.toLowerCase()} (trabajo ${num(r.calentamiento.peso, 2)} kg): ${r.calentamiento.pasos.map((p) => `${num(p.kg, 2)}×${p.reps}${p.discos.length ? ` [${p.discos.map((d) => num(d, 2)).join("+")}]` : " [barra]"}`).join(" → ")}`);
  if (r.rutina.ejercicios.length) lineas.push(tablaRutina(r.rutina));
  lineas.push(`Apuntando en ${r.fichero.replace(carpeta + "/", "")}`);
  console.log(lineas.join("\n"));
  return 0;
});

registrar("serie", "--ejercicio <id|nombre> -- <texto>: apunta una serie en vivo, marca la casilla y arranca el descanso", async ({ pos, op }) => {
  const carpeta = carpetaObligatoria(op);
  const texto = pos.join(" ").trim();
  if (!texto) { console.log("Falta el texto de la serie, por ejemplo: serie --ejercicio sentadilla sentadilla 5x120 @8"); return 2; }
  const ej = lista(op.ejercicio)[0] ?? null;
  const r = apuntarSerie(carpeta, { texto, ejercicio: ej && ej !== true ? ej : null });
  await derivarCarpeta(carpeta);
  publicar(carpeta);
  console.log(`Apuntado: «${texto}»${r.e ? ` · ${r.e.nombre} ${r.e.hechas}/${r.e.total}` : ""} · descanso ${Math.floor(r.descanso / 60)}:${String(r.descanso % 60).padStart(2, "0")} · ${r.aviso}`);
  return 0;
});

registrar("fin", "[--post N] [--notas texto]: cierra el entreno en vivo; después, /gymhub:refresh lo importa", async ({ op }) => {
  const carpeta = carpetaObligatoria(op);
  const r = terminarEntreno(carpeta, { post: op.post !== undefined && op.post !== true ? op.post : null, notas: op.notas && op.notas !== true ? op.notas : null });
  if (r.error) { console.log(`No se puede cerrar: ${r.error}.`); return 2; }
  await derivarCarpeta(carpeta);
  publicar(carpeta);
  console.log(`Entreno cerrado. Lo apuntado está en ${r.fichero.replace(carpeta + "/", "")}. SIGUIENTE: importarlo con el flujo de /gymhub:refresh (refresh preparar…).`);
  return 0;
});
