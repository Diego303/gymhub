# gymhub · instrucciones

Pasos para empezar a usar gymhub en una carpeta tuya y para el día a día. El detalle de todo está en el [README](README.md).

## 0. Lo que necesitas

- **Claude Code**, en la terminal.
- **Node.js 20 o superior.** Compruébalo con `node --version`. Si no lo tienes: https://nodejs.org
- Un navegador (Edge, Chrome, Brave o Firefox).

## 1. Crea tu carpeta

Puede estar donde quieras y llamarse como quieras. En WSL, mejor en un disco de Windows (`/mnt/c/…`, `/mnt/d/…`), para que el navegador la abra sin rodeos.

```bash
mkdir -p /mnt/d/MiGimnasio
cd /mnt/d/MiGimnasio
```

- **Carpeta nueva o que ya existe:** las dos valen. Si ya tiene cosas (por ejemplo, tus notas antiguas), no se toca nada: `/gymhub:configurar` solo añade lo que falta y nunca sobrescribe. Después, mueve tus notas a `CONTEXTO/` (paso 4).
- **Ruta con espacios:** ponla entre comillas: `mkdir -p "/mnt/d/Mi Gimnasio"` y `cd "/mnt/d/Mi Gimnasio"`.
- **Ruta de Windows:** en la terminal de WSL, `D:\MiGimnasio` es `/mnt/d/MiGimnasio`.

## 2. Instala gymhub solo en esa carpeta

Desde **dentro** de la carpeta, elige una de estas dos formas.

**Mientras gymhub no esté publicado en GitHub**, usa el repo que tienes en tu disco:

```bash
claude plugin install gymhub --marketplace /mnt/d/GitHub/gymhub --scope project
```

> Así, gymhub se lee directamente de esa carpeta del repo: si cambias de rama (por ejemplo, a `main`, que todavía no tiene el código), cambia también lo que usas. Déjala en `develop` o reinstala desde GitHub cuando esté publicado.

**Cuando esté publicado:**

```bash
claude plugin install gymhub --marketplace Diego303/gymhub --scope project
```

`--scope project` significa que gymhub solo está activo en esta carpeta. En el resto de carpetas, Claude Code sigue como siempre. Puedes comprobarlo con `claude plugin list`, que dentro de la carpeta lo muestra `✔ enabled`.

## 3. Primera vez: configurar

```bash
claude
```

1. Si te pregunta si confías en la carpeta, di que sí.
2. Escribe `/gymhub:configurar`. Si no tienes Node.js 20, te lo dice aquí.
   - Cuando te pregunte qué carpeta usar, elige **el directorio de la sesión** (la carpeta en la que estás).
   - Te pregunta los días que quieres entrenar por semana, tus objetivos de fuerza y si tienes alguna lesión. Todo es opcional; lo que digas va a `FICHA.md`.
3. Se abre tu web en el navegador. **Guárdala en favoritos:** es el fichero `.gymhub/web/dashboard.html` de tu carpeta (en Windows, por ejemplo, `D:\MiGimnasio\.gymhub\web\dashboard.html`).

Ya tienes la estructura: `CONTEXTO/` (tu bandeja de entrada), `FICHA.md`, `sesiones/`, `ejercicios.md`…

> **Truco:** los comandos llevan delante `gymhub:`. Escribe `/refre` y pulsa **Tab**, y se completa solo.

> **Permisos:** gymhub hace su trabajo con un script propio (`node …/bin/gymhub.mjs`), que sus comandos ya tienen permitido. Si en algún momento Claude Code te pide permiso para ese script o para cargar la skill de gymhub, acepta. Con «no volver a preguntar», no lo vuelve a hacer.

> **Siempre en esta carpeta:** abre Claude Code desde ella (`cd /mnt/d/MiGimnasio && claude`) y gymhub usará esta carpeta. Fuera de ella, los comandos de gymhub no aparecen.

## 4. Importa lo que ya tengas

1. Copia en `CONTEXTO/` todo lo que tengas, como esté: notas (`.txt`, `.md`), el CSV de una app, un export de Telegram (`result.json`) o de WhatsApp (`.txt`), fotos de tu libreta… Puedes usar subcarpetas.
2. Deja la web abierta y, en Claude Code, escribe `/gymhub:refresh`.
3. Si hay mucho material, Claude primero mira una muestra y te hace unas pocas preguntas generales: el orden de las fechas, qué significan tus abreviaturas, qué es «pin 7» en tu máquina… Lo que contestes se guarda en `convenciones.md` y **no te lo vuelve a preguntar nunca**.
4. Mira la web: verás «Normalizando · lote 3 de 12…» y cómo aparecen tus datos. No hace falta recargar.
   - **Si tienes mucho historial,** tarda: unos segundos por lote de hasta 25 entrenos, por meses. Si se corta (cierras la terminal, te quedas sin sesión…), vuelve a escribir `/gymhub:refresh` y **sigue donde se quedó**: no repite ni duplica nada.
5. Al terminar, Claude te dice cuántas sesiones ha importado, los PRs y las dudas. Lo importado se mueve, intacto, a `CONTEXTO/procesado/`.
6. Si quedan dudas: `/gymhub:revision`. Te las enseña una a una para que confirmes o corrijas.

## 5. Cada semana

1. Entrena y apunta como siempre: en tu libreta, en el móvil, donde sea.
2. Cuando quieras (al llegar a casa o el domingo), deja lo nuevo en `CONTEXTO/`. Las dos formas valen:
   - **un fichero nuevo** con lo de esta semana (por ejemplo, `semana-45.txt`);
   - **la misma nota de siempre, entera**, si la llevas en el móvil y va creciendo. gymhub reconoce lo que ya importó y solo coge lo nuevo. Si cambiaste algo de un día ya importado, ese día se guarda aparte (`AAAA-MM-DD-2.md`) y te lo pregunta en `revision.md`.
3. `/gymhub:refresh`.
4. `/gymhub:semana`: tu resumen de la semana en `semanas/AAAA-Www.md`, con lo que conviene ajustar.
5. Mira la web: Panel (tu semana), Progreso, Análisis, Diario y Ejercicios. Cambia de vista con las teclas `1` a `5`.

## 6. Otras cosas que puedes hacer

| Quiero… | Escribe |
|---|---|
| Abrir la web | `/gymhub:web` |
| Ver cómo voy en un ejercicio | `/gymhub:ejercicio banca` |
| Ver un análisis en volumen en vez de fuerza | `/gymhub:analisis volumen` |
| Ver el diario de una molestia | `/gymhub:diario rodilla` |
| Saber qué discos poner | `/gymhub:discos 120` |
| Apuntar un entreno sin fichero | Díselo a Claude: «apunta que hoy hice banca 3x5 a 80» |
| Registrar en vivo desde el terminal (opcional) | `/gymhub:entreno`, luego `/gymhub:serie "sentadilla 5x120 @8"` en cada serie, y `/gymhub:fin` al acabar |
| Cambiar objetivos, peso, lesiones | Edita `FICHA.md` (o díselo a Claude) |
| Corregir una sesión | Edita su fichero en `sesiones/` a mano: gymhub nunca sobrescribe tus cambios |
| Ver o cambiar la carpeta | `/gymhub:carpeta` |
| Mover o renombrar la carpeta | Muévela, vuelve a instalar gymhub dentro (paso 2) y abre `claude` allí: gymhub usa la carpeta en la que estás. Para la ruta guardada, `/gymhub:carpeta <ruta nueva>` |
| Tener otra carpeta (por ejemplo, de prueba) | Repite los pasos 1 a 3 en ella. Cada una funciona por su lado: gymhub usa la carpeta en la que abres Claude Code |

## 7. Si algo no va

- **«Unknown command: /refresh».** Falta el prefijo: `/gymhub:refresh` (o `/refre` + Tab).
- **No aparece ningún comando de gymhub.** Estás fuera de la carpeta donde lo instalaste. Entra en ella (`cd /mnt/d/MiGimnasio`) antes de abrir `claude`.
- **La web no cambia.** Ábrela con `/gymhub:web`. Si se ha movido la carpeta, la web lo avisa arriba («No se pueden leer los datos»).
- **Un comando de vista no abre pestaña nueva.** Es a propósito: cambia la pestaña que ya tienes abierta. Si la cerraste, `/gymhub:web`.
- **gymhub necesita Node.js 20.** Instálalo desde https://nodejs.org y vuelve a probar.
- **Una sesión se queda fuera de los cálculos.** Tiene un error de formato (por ejemplo, la editaste a mano y se coló una errata). La web lo avisa arriba, con el fichero y el error, igual que `/gymhub:web` y el final de `/gymhub:refresh`. Corrígela o pídeselo a Claude.

## 8. Copias, actualizar y desinstalar

- **Copia de seguridad:** toda tu información está en tu carpeta. `.gymhub/` se regenera solo y lo demás es Markdown. Basta con copiar la carpeta.
- **Actualizar gymhub:**
  - instalado desde el repo local, basta con tener el repo al día; en una sesión abierta, `/reload-plugins`;
  - instalado desde GitHub, `claude plugin update gymhub --scope project` y después `/reload-plugins`.
- **Desinstalar** (tus datos se quedan donde están):
  ```bash
  cd /mnt/d/MiGimnasio
  claude plugin uninstall gymhub --scope project
  ```
