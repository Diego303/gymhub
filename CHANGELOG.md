# Changelog

## v0.1.0 · 2026-10-31

Primera versión.

- **Importación** (`/gymhub:refresh`): notas en cualquier formato y con fechas en cualquier orden, exports de Telegram (JSON y HTML) y WhatsApp, CSV de apps de entreno, fotos de libretas y otros ficheros. Lotes mensuales reanudables, pasada de muestreo y `convenciones.md` aprendido por persona. Todo lo que se guarda se valida antes de escribir, cada sesión guarda su texto original, lo importado se mueve a `CONTEXTO/procesado/` y nunca se sobrescribe lo editado a mano.
- **Formato estándar** en Markdown (`sesiones/AAAA/AAAA-MM-DD.md`) y catálogo de unos 125 ejercicios con alias en español e inglés.
- **Cifras calculadas por el código:** e1RM (Epley), volumen con lb, `/lado`, `/mano`, peso corporal y lastre, posiciones de máquina con equivalencia, series por grupo y patrón, PRs, rachas con pausas, bloque, radar de equilibrio, ratios, carga aguda:crónica, disposición, predicción, estancados, correlaciones y adherencia.
- **Web local** (`dashboard.html`, autocontenida y sin red): Panel, Progreso, Análisis, Diario y Ejercicios, con tema claro y oscuro, se actualiza sola en ≤ 1 s mientras importas y muestra el avance lote a lote. Con Rex, el compañero de píxeles.
- **Comandos:** `/gymhub:configurar`, `/gymhub:carpeta`, `/gymhub:web`, `/gymhub:panel`, `/gymhub:progreso`, `/gymhub:analisis`, `/gymhub:diario`, `/gymhub:ejercicio`, `/gymhub:semana`, `/gymhub:revision`, `/gymhub:discos` y, opcionales, `/gymhub:entreno`, `/gymhub:serie` y `/gymhub:fin`.
