// plantillas/*.md: rutinas con frontmatter (nombre, tipo, dia) y una línea por ejercicio:
//   - Sentadilla · 5×5 · 120 kg · 3 min
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { leerYAML } from "./canonico.mjs";

const DIAS = { lunes: 0, martes: 1, miercoles: 2, "miércoles": 2, jueves: 3, viernes: 4, sabado: 5, "sábado": 5, domingo: 6 };

export function leerPlantilla(texto, archivo, catalogo) {
  const t = String(texto).replace(/\r/g, "");
  const fm = t.match(/^---\n([\s\S]*?)\n---\n?/);
  const meta = fm ? leerYAML(fm[1]) : {};
  const cuerpo = fm ? t.slice(fm[0].length) : t;
  const ejercicios = [];
  for (const l of cuerpo.split("\n")) {
    const m = l.match(/^\s*[-*\d.]+\s+(.+)$/);
    if (!m) continue;
    const partes = m[1].split(/\s+·\s+/).map((x) => x.trim());
    const nombre = partes[0];
    const pres = partes.find((p) => /^\d+\s*[×x]\s*(\d+|AMRAP)/i.test(p)) ?? null;
    const series = pres ? Number(pres.match(/^(\d+)/)[1]) : null;
    const carga = partes.find((p) => /\d\s*(kg|lb)|^PC/i.test(p)) ?? null;
    const descanso = partes.find((p) => /\d\s*(min|s)$/i.test(p) && p !== pres) ?? null;
    const desc = descanso ? (/min/i.test(descanso) ? Number(descanso.match(/[\d.,]+/)[0].replace(",", ".")) * 60 : Number(descanso.match(/\d+/)[0])) : null;
    ejercicios.push({ nombre, id: catalogo?.buscar(nombre) ?? null, prescripcion: [pres, carga].filter(Boolean).join(" · "), series, descanso_s: desc });
  }
  const dia = meta.dia ? DIAS[String(meta.dia).toLowerCase()] ?? null : null;
  return { archivo, nombre: meta.nombre ?? archivo.replace(/\.md$/, ""), tipo: meta.tipo ?? null, dia, ejercicios };
}

export function leerPlantillas(dir, catalogo) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((n) => n.endsWith(".md") && n !== "LEEME.md" && !n.startsWith("."))
    .map((n) => leerPlantilla(readFileSync(join(dir, n), "utf8"), n, catalogo)).filter((p) => p.ejercicios.length);
}
