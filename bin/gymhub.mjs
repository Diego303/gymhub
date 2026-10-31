#!/usr/bin/env node
// Punto de entrada de los scripts de gymhub. Lo llaman los comandos del plugin:
//   node "${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs" <subcomando> [argumentos]
// Toda la lectura y escritura de la carpeta de datos pasa por aquí (notas técnicas §2.6).
const [major] = process.versions.node.split(".").map(Number);
if (major < 20) {
  console.error(`gymhub necesita Node.js 20 o superior (tienes ${process.version}). Instálalo desde https://nodejs.org`);
  process.exit(1);
}

try {
  const { ejecutar } = await import("../lib/cli.mjs");
  const codigo = await ejecutar(process.argv.slice(2));
  process.exitCode = codigo ?? 0;
} catch (e) {
  console.error(`gymhub: ${e.message}`);
  if (process.env.GYMHUB_DEPURAR) console.error(e.stack);
  process.exitCode = 1;
}
