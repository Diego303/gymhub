// Falla si web/dashboard.html hace (o puede hacer) peticiones de red: la web es local y offline.
import { readFileSync } from "node:fs";
const html = readFileSync(new URL("../web/dashboard.html", import.meta.url), "utf8");
const reglas = [
  [/https?:\/\//i, "una URL http(s)"],
  [/<link\b/i, "un <link>"],
  [/@import/i, "un @import"],
  [/\bfetch\s*\(/, "fetch()"],
  [/XMLHttpRequest|WebSocket|EventSource|sendBeacon|navigator\.serviceWorker/, "una API de red"],
  [/<(img|iframe|video|audio|source|embed|object)\b[^>]*\bsrc=/i, "un recurso externo (src)"],
  [/url\(\s*['"]?(?!data:|#)/i, "un url() de CSS"],
];
const errores = reglas.filter(([re]) => re.test(html.replace(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g, ""))).map(([, d]) => d);
// Los scripts se cargan solo con cargar("datos.js" | "version.js", …), que añade ?t=.
for (const m of html.matchAll(/\.src\s*=\s*([^;]+);/g)) {
  if (!/^(\w+)\s*\+\s*["']\?t=["']\s*\+\s*Date\.now\(\)$/.test(m[1].trim())) errores.push(`un src dinámico inesperado: ${m[1].trim()}`);
}
for (const m of html.matchAll(/\bcargar\(\s*([^,)]+)/g)) {
  if (!/^["'](datos|version)\.js["']$/.test(m[1].trim())) errores.push(`cargar() con algo que no es datos.js/version.js: ${m[1].trim()}`);
}
if (errores.length) { console.error("web/dashboard.html no es autocontenida:\n- " + errores.join("\n- ")); process.exit(1); }
console.log(`web/dashboard.html autocontenida (${Math.round(html.length / 1024)} KB, sin peticiones de red)`);
