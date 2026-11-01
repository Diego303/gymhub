// G5 · XSS: nombres de ejercicio, títulos, notas, zonas, programas, hitos, repasos y errores con
// HTML se ven como texto en todas las vistas, también en los tooltips. Nada se ejecuta.
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { test, expect, mini } from "./base.mjs";
import { carpetaWeb } from "./ayuda.mjs";

const P = `<img src=x onerror="window.__xss=(window.__xss||0)+1">`;
const Q = `"><svg onload="window.__xss=1"></svg><script>window.__xss=1</script>`;

function hostil(c) {
  mini(c);
  // El nombre del ejercicio (en el catálogo), la zona de una molestia, el título, el programa, las notas y la nota de una serie
  const cat = join(c, "ejercicios.md");
  writeFileSync(cat, readFileSync(cat, "utf8").replace("| press-banca | Press banca |", `| press-banca | Banca ${P} |`));
  const f = join(c, "sesiones", "2026", "2026-11-02.md");
  let s = readFileSync(f, "utf8");
  s = s.replace("titulo: Torso", `titulo: ${JSON.stringify(`Torso ${P}`)}\nprograma: ${JSON.stringify(`Bloque ${Q}`)}\nsemana_programa: 3`)
    .replace("molestias: []", `molestias:\n  - zona: ${JSON.stringify(`codo ${P}`)}\n    lado: izq\n    estado: dolor`)
    .replace("Banca muy sólida hoy.", `Banca muy sólida ${P} y ${Q}.`)
    .replace("| 1 | trabajo | 80 kg | 5 | 8 |  |  |", `| 1 | trabajo | 80 kg | 5 | 8 |  | nota ${P} |`);
  writeFileSync(f, s);
  // Un hito, un repaso de la semana y una sesión con un error de formato que cita el HTML
  writeFileSync(join(c, "eventos.md"), `# Eventos\n\n- 2026-10-20 · hito · Primera competición ${P}\n`);
  mkdirSync(join(c, "semanas"), { recursive: true });
  writeFileSync(join(c, "semanas", "2026-W45.md"), `---\nsemana: 2026-W45\ngenerado: 2026-11-05T10:00\n---\n## Repaso\n- ✓ Bien ${P}\n- ! Molestia ${Q}\n\n## Preguntas\n- ¿Cómo te has sentido?: genial ${P}\n- ¿Molestias?: ninguna\n- ¿Qué priorizas la semana que viene?: ${Q}\n`);
  writeFileSync(join(c, "sesiones", "2026", "2026-11-03.md"), `---\nfecha: 2026-11-03\nconfianza: alta\n---\n## Ejercicios\n### Raro ${P}\n<!-- id: press-banca -->\n| # | tipo | carga | reps | rpe | rir | nota |\n|---|---|---|---|---|---|---|\n| 1 | trabajo | ${P} | 5 | | | |\n`);
}

test("lo que escribe la persona se ve como texto en las 6 vistas y en sus tooltips; nada se ejecuta", async ({ page }) => {
  const w = carpetaWeb({ preparar: hostil });
  try {
    let dialogos = 0;
    page.on("dialog", (d) => { dialogos++; d.dismiss(); });
    await page.goto(w.url + "#panel");
    await expect(page.locator("#p-k1")).toContainText("días");
    const vistas = { panel: "#p-k1", progreso: "#g-hist", analisis: "#a-rat", diario: "#d-tl", ejercicios: "#e-lista", semana: "#s-kpis" };
    for (const [v, sel] of Object.entries(vistas)) {
      await page.evaluate((x) => { location.hash = x; }, v);
      await expect(page.locator(sel)).toBeVisible();
      if (v === "diario") for (const e of await page.locator("#d-tl .ent").all()) await e.click().catch(() => {});
      if (v === "semana") { await page.keyboard.press("ArrowLeft"); await page.keyboard.press("ArrowRight"); }
      // Pasar por cada tooltip de la vista (y del aviso de errores de la cabecera)
      await page.evaluate(() => {
        for (const el of document.querySelectorAll("[data-tt]")) {
          const r = el.getBoundingClientRect();
          el.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: r.x + 1, clientY: r.y + 1 }));
        }
      });
      await page.waitForTimeout(150);
      const estado = await page.evaluate(() => ({ xss: window.__xss ?? 0, imgs: document.querySelectorAll("img[src='x'], #tt img, svg[onload]").length, scripts: [...document.querySelectorAll("script")].filter((s) => /__xss/.test(s.textContent)).length }));
      expect(estado, `vista ${v}`).toEqual({ xss: 0, imgs: 0, scripts: 0 });
    }
    expect(dialogos).toBe(0);
    // Y el texto se ve tal cual (escapado), por ejemplo en el Diario y en el aviso de errores
    await page.evaluate(() => { location.hash = "diario"; });
    await expect(page.locator("#d-tl")).toContainText(`Banca muy sólida ${P}`);
    await expect(page.locator("#aviso-datos")).toContainText("1 sesión con errores de formato");
  } finally { w.limpiar(); }
});
