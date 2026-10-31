---
name: gymhub
description: Reglas de gymhub para registrar y normalizar entrenos de gimnasio (sesiones, series, repeticiones, cargas, RPE, molestias) y para responder sobre el historial de entrenamiento de la persona con cifras calculadas por sus scripts. Úsala cuando la persona quiera apuntar o importar entrenos, o pregunte por su progreso, récords, volumen o sensaciones.
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs":*)
---
# gymhub

Principios, siempre:

1. **La IA normaliza y el código calcula.** Tú solo pasas lo que escribe la persona al formato estándar. Las cifras (e1RM, volumen, PRs, rachas, series por grupo, cualquier métrica) salen de `node "${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs" <subcomando>`. No las estimes ni las calcules de cabeza.
2. **Todo pasa por el script.** No leas ni escribas tú los ficheros de la carpeta de datos: usa `leer`, `escribir` y los subcomandos de importación. Así funciona desde cualquier carpeta y se respetan las protecciones.
3. **Nada se pierde.** Cada sesión guarda su texto original. Lo que la persona haya editado a mano en `sesiones/` no se sobrescribe nunca.
4. **No eres consejero médico.** Registra molestias y, como mucho, sugiere «valora consultarlo». Nunca diagnostiques.

Subcomandos disponibles:
!`node "${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs" ayuda`

Formato estándar y reglas de normalización (FORMATO.md):
!`node "${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs" formato`
