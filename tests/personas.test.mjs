// Las 5 personas sintéticas (PLAN §4): se separa su CONTEXTO/, se guarda lote a lote lo que
// produciría Claude (su resultado esperado), se cierra y se comprueba el resultado.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { temporal, cli, RAIZ } from "./ayuda.mjs";

const PERSONAS = ["1-telegrafica", "2-ingles", "3-csv", "4-plantillas", "5-calistenia"];
const HOY = "2026-10-31";

export function renderBloque(b, ids) {
  const el = b.el ? ` elementos=${b.el.map((ref) => { if (!ids[ref]) throw new Error(`no hay elemento ${ref}`); return ids[ref]; }).join(",")}` : "";
  switch (b.tipo) {
    case "sesion": return `@@@ sesion${el}\n${b.md}`;
    case "ignorar": return `@@@ ignorar${el} · motivo: ${b.motivo}`;
    case "plantilla": return `@@@ plantilla ${b.nombre}${el}\n${b.md}`;
    case "ejercicios": return `@@@ ejercicios\n${b.filas.join("\n")}`;
    case "revision": return `@@@ revision\n${b.lineas.map((l) => `- ${l}`).join("\n")}`;
    default: throw new Error(b.tipo);
  }
}

const sesionesEn = (carpeta) => {
  const dir = join(carpeta, "sesiones");
  return readdirSync(dir).flatMap((a) => readdirSync(join(dir, a)).map((f) => `sesiones/${a}/${f}`)).sort();
};

for (const p of PERSONAS) {
  test(`persona ${p}: se importa entera, sin perder nada y sin duplicar al repetir`, async () => {
    const t = temporal();
    const antes = process.env.GYMHUB_CONFIG, antesHoy = process.env.GYMHUB_HOY;
    try {
      const carpeta = join(t.dir, "GIMNASIO");
      cli(t.dir, ["configurar", carpeta]);
      process.env.GYMHUB_CONFIG = join(t.dir, "config.json");
      process.env.GYMHUB_HOY = HOY;
      cpSync(join(RAIZ, "tests/fixtures/personas", p, "CONTEXTO"), join(carpeta, "CONTEXTO"), { recursive: true });
      const esperado = await import(`./fixtures/personas/${p}/esperado.mjs`);
      const { preparar, guardar, cerrar } = await import("../lib/refresh.mjs");
      const { contexto } = await import("../lib/derivar.mjs");

      const { imp } = preparar(carpeta);
      assert.equal(imp.automaticos.length, esperado.comprobar.automaticos, "multimedia que se ignora sola");
      const ids = {};
      for (const e of Object.values(imp.elementos)) ids[`${e.fichero.replace(/^CONTEXTO\//, "")}#${e.n}`] = e.id;
      const enLotes = new Set(imp.lotes.flatMap((l) => l.ids));
      const pendientes = [...esperado.bloques];
      imp.lotes.forEach((lote, i) => {
        const delLote = pendientes.filter((b) => (b.el ? b.el.every((r) => lote.ids.includes(ids[r])) : i === 0));
        for (const b of delLote) pendientes.splice(pendientes.indexOf(b), 1);
        const entrada = [`@@@ convenciones\n${esperado.convenciones}`].filter(() => i === 0).concat(delLote.map((b) => renderBloque(b, ids))).join("\n");
        const r = guardar(carpeta, lote.n, entrada);
        assert.deepEqual(r.errores, [], `lote ${lote.n}`);
      });
      assert.deepEqual(pendientes, [], "todos los bloques esperados caben en algún lote");
      assert.ok(enLotes.size > 0);

      const cierre = await cerrar(carpeta);
      assert.deepEqual(cierre.errores, []);
      assert.equal(cierre.sesiones, esperado.comprobar.sesiones);
      const rutas = sesionesEn(carpeta);
      assert.equal(rutas.length, esperado.comprobar.sesiones);
      for (const r of rutas) {
        const txt = readFileSync(join(carpeta, r), "utf8");
        assert.match(txt, /<details><summary>Original<\/summary>\n\n[\s\S]+\n\n<\/details>/, `${r}: guarda el original`);
        assert.match(txt, /^fuente: "CONTEXTO\//m, `${r}: con su fuente`);
      }
      // CONTEXTO/ queda vacío (salvo LEEME) y todo está en procesado/
      const quedan = readdirSync(join(carpeta, "CONTEXTO")).filter((n) => n !== "LEEME.md" && n !== "procesado");
      assert.deepEqual(quedan, []);
      assert.ok(existsSync(join(carpeta, "CONTEXTO/procesado", HOY)));
      assert.equal(readFileSync(join(carpeta, "convenciones.md"), "utf8"), esperado.convenciones.trimEnd() + "\n");
      if (esperado.comprobar.plantillas) assert.equal(readdirSync(join(carpeta, "plantillas")).filter((n) => n !== "LEEME.md").length, esperado.comprobar.plantillas);

      // Las cifras salen del código
      const c = contexto(carpeta, { hoy: HOY });
      assert.deepEqual(c.conErrores, []);
      for (const [id, valor] of Object.entries(esperado.comprobar.e1rm)) {
        const h = c.base.porEjercicio.get(id);
        const mejor = Math.max(...h.sesiones.map((s) => s.e1rm || 0));
        assert.ok(Math.abs(mejor - valor) < 0.01, `${p} ${id}: e1RM ${mejor} ≠ ${valor}`);
      }
      const datos = readFileSync(join(carpeta, ".gymhub/web/datos.js"), "utf8");
      assert.match(datos, /"fase":"listo"/);

      // Repetir /refresh: nada nuevo, nada duplicado (aunque se vuelva a dejar lo mismo en CONTEXTO/)
      cpSync(join(RAIZ, "tests/fixtures/personas", p, "CONTEXTO"), join(carpeta, "CONTEXTO"), { recursive: true });
      const otra = preparar(carpeta);
      assert.equal(otra.imp.lotes.length, 0, "lo ya importado no se vuelve a importar");
      await cerrar(carpeta);
      assert.deepEqual(sesionesEn(carpeta), rutas);
    } finally {
      if (antes === undefined) delete process.env.GYMHUB_CONFIG; else process.env.GYMHUB_CONFIG = antes;
      if (antesHoy === undefined) delete process.env.GYMHUB_HOY; else process.env.GYMHUB_HOY = antesHoy;
      t.limpiar();
    }
  });
}
