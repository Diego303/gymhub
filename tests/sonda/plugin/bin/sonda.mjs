#!/usr/bin/env node
import { readFileSync } from "node:fs";
const [cmd, ...rest] = process.argv.slice(2);
if (cmd === "formato") process.stdout.write(readFileSync(new URL("../docs/FORMATO.md", import.meta.url), "utf8"));
else if (cmd === "guardar") { const t = readFileSync(0, "utf8"); console.log(`guardado-ok bytes=${Buffer.byteLength(t)} lineas=${t.split("\n").length} tuberias=${(t.match(/\|/g)||[]).length} backticks=${(t.match(/`/g)||[]).length}`); }
else console.log("node-ok", process.version, cmd ?? "", rest.join(" "));
