// Provisional (Fase 1): datos.json vacío. La Fase 2 calcula todas las cifras.
import { rutas } from "./config.mjs";
import { escribirJSON } from "./util.mjs";

export async function derivarCarpeta(carpeta) {
  const datos = { esquema: 1, carpeta, vacio: true, resumen: { sesiones_total: 0 } };
  escribirJSON(rutas(carpeta).datos, datos);
  return datos;
}
