// Publica datos.js de forma atómica: fichero temporal en la misma carpeta + rename.
import { writeFileSync, renameSync, copyFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
export function publicar(dir, version, activo = false) {
  const datos = { version: String(version), generado: new Date().toISOString(), proceso: { activo } };
  const tmp = join(dir, `.datos.js.tmp-${process.pid}`);
  writeFileSync(tmp, `window.GYMHUB = ${JSON.stringify(datos)};\n`);
  renameSync(tmp, join(dir, "datos.js"));
  // El latido va después: cuando la página ve la versión nueva, datos.js ya está completo.
  const tmpV = join(dir, `.version.js.tmp-${process.pid}`);
  writeFileSync(tmpV, `window.GYMHUB_VERSION = ${JSON.stringify(String(version))};\n`);
  renameSync(tmpV, join(dir, "version.js"));
}
export function preparar(dir) {
  const html = join(dir, "prueba.html");
  if (!existsSync(html)) copyFileSync(join(dirname(fileURLToPath(import.meta.url)), "prueba.html"), html);
  return html;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [dir, version = "1", activo] = process.argv.slice(2);
  preparar(dir); publicar(dir, version, activo === "activo"); console.log("publicado", version);
}
