# gymhub — formato estándar y normalización

Este documento define el **formato estándar** en el que gymhub guarda los entrenamientos y las **reglas** que sigue Claude para llevar a ese formato lo que cada persona deja en `CONTEXTO/`, se haya apuntado como se haya apuntado. Es parte del plugin: `/refresh` lo carga siempre.

Cada usuario apunta a su manera: en una libreta, en el móvil, en una app, en otro idioma, con sus abreviaturas y con hábitos que cambian con los años. gymhub no le pide que cambie. El estándar está en la salida, no en la entrada.

```
CONTEXTO/  (texto libre, CSV de apps, exports de chats, fotos de una libreta…)
   │  Claude normaliza: este documento + convenciones.md (las del propio usuario)
   ▼
sesiones/AAAA/AAAA-MM-DD.md  formato estándar, legible y editable   ← FUENTE DE VERDAD
   │  un script determinista lo parsea y lo valida
   ▼
.gymhub/datos.json  (derivado y regenerable; es lo que lee la web)
```

- **La IA** solo interviene en el paso desordenado: de lo que haya escrito el usuario al formato estándar.
- **Los números** (e1RM, volumen, PRs, rachas) los calcula siempre el código.
- **Nunca se pierde nada:** cada sesión guarda su texto original y lo importado se mueve a `CONTEXTO/procesado/`.
- **Coherencia entre usuarios y a lo largo del tiempo:** el formato de salida es igual para todos. Lo que cambia de una persona a otra se guarda en su `convenciones.md` (§4).

---

## 1. Carpeta de datos

```
GIMNASIO/                         (configurable con /carpeta)
├─ CONTEXTO/                      bandeja de entrada
│  └─ procesado/AAAA-MM-DD/       lo ya importado, intacto
├─ FICHA.md                       perfil: objetivos, días por semana, lesiones o limitaciones
├─ convenciones.md                cómo apunta ESTE usuario (se aprende y lo puede editar)
├─ ejercicios.md                  catálogo: id, nombre, alias, grupo, tipo de carga
├─ sesiones/AAAA/AAAA-MM-DD.md    una por sesión (si hay dos en un día: -2)
├─ records.md                     PRs (los genera el script) + marcas declaradas
├─ plantillas/                    rutinas o programas (opcional)
├─ semanas/AAAA-Www.md            resúmenes semanales
├─ revision.md                    dudas pendientes de confirmar
└─ .gymhub/                       derivados y control interno (regenerable)
```

---

## 2. Formato estándar de una sesión

```markdown
---
fecha: 2026-03-12
titulo: Torso pesado
tipo: torso             # ver §2.3
programa: null          # nombre del programa o bloque, si lo hay
semana_programa: null   # nº de semana dentro del programa
inicio: "18:30"
fin: "19:45"
duracion_min: 75
sueno_h: 7
sensacion_pre: 7        # escala 0-10 (si el usuario usa otra, se convierte; ver §3.6)
sensacion_post: 8
peso_corporal_kg: null
molestias:
  - zona: hombro
    lado: izq           # izq | der | ambos | null
    estado: molestia    # bien | molestia | dolor
fuente: "CONTEXTO/notas-marzo.md · bloque 3"
confianza: alta         # alta | media | baja (baja → revision.md)
---

# 2026-03-12 · Torso pesado

## Calentamiento y movilidad
- 5 min bici · rotaciones de hombro 2×15

## Ejercicios

### Press banca
<!-- id: press-banca -->
| # | tipo         | carga | reps | rpe | rir | nota      |
|---|--------------|-------|------|-----|-----|-----------|
| 1 | aproximacion | 20 kg | 10   |     |     |           |
| 2 | aproximacion | 60 kg | 5    |     |     |           |
| 3 | trabajo      | 80 kg | 5    | 8   |     | pausa 1 s |
| 4 | trabajo      | 80 kg | 5    | 8.5 |     |           |

### A1 · Dominadas
<!-- id: dominadas · superserie: A -->
| # | tipo    | carga     | reps | rpe | rir | nota |
|---|---------|-----------|------|-----|-----|------|
| 1 | trabajo | PC+10 kg  | 6    |     | 2   |      |

### A2 · Fondos
<!-- id: fondos · superserie: A -->
| # | tipo    | carga | reps | rpe | rir | nota |
|---|---------|-------|------|-----|-----|------|
| 1 | trabajo | PC    | 10   |     | 1   |      |

### Plancha
<!-- id: plancha -->
| # | tipo    | carga | reps | rpe | rir | nota |
|---|---------|-------|------|-----|-----|------|
| 1 | trabajo | PC    | 45s  |     |     |      |

## Cardio
| actividad | minutos | distancia_km | ritmo | pulso_medio | kcal | nota |
|-----------|---------|--------------|-------|-------------|------|------|
| cinta     | 20      | 2.5          |       | 130         |      | inclinación 10 |

## Notas
(notas del usuario, tal cual o apenas limpiadas)

<details><summary>Original</summary>

(texto original exacto)

</details>
```

### 2.1 Columnas de una serie

| Columna | Valores admitidos |
|---|---|
| `tipo` | `calentamiento`, `aproximacion`, `trabajo`, `top` (serie más pesada del día), `backoff`, `amrap`, `dropset`, `myo`, `cluster`, `no_hecho` |
| `carga` | `<n> kg` · `<n> lb` · `<n> kg/lado` · `<n> kg/mano` · `PC` · `PC+<n> kg` (lastre) · `PC-<n> kg` (asistida) · `banda <color o kg>` · `nivel <n>` (posición o pin de máquina) · `<n> %1RM` (si no se puede resolver) · vacío |
| `reps` | entero · `<n>/<n>` (por lado) · `fallo` · `<n>s` (tiempo) · `<n> m` (distancia) |
| `rpe` | número `1`-`10`, admite medios puntos; los rangos se guardan como la media y el rango va a `nota` |
| `rir` | repeticiones en reserva (`0`-`5`). Si solo hay RIR, el script estima `rpe = 10 − rir` para las medias |
| `nota` | texto corto: tempo, pausa, agarre, variante, prescripción… |

- **Una fila por serie.** Las notaciones abreviadas se expanden (§3.3).
- **Volumen** (lo calcula el script): series de tipo trabajo (`trabajo`, `top`, `backoff`, `amrap`, `dropset`, `myo`, `cluster`) con carga en kg o lb. `/lado` y `/mano` se multiplican por 2. `PC`, `banda` y `nivel` cuentan series pero no toneladas, salvo que `FICHA.md` indique el peso corporal o `convenciones.md` dé una equivalencia.
- **e1RM** (lo calcula el script): Epley, solo en series en kg o lb, de 1 a 10 repeticiones y de tipo trabajo. En lastrados, carga = peso corporal + lastre, si se conoce el peso corporal.

### 2.2 Superseries y circuitos
- Los ejercicios que van juntos llevan el mismo `superserie: X` y su título se numera `X1`, `X2`…
- **Circuitos y formatos por tiempo** (EMOM, AMRAP de 12 min, tabata): un ejercicio por movimiento con sus series, y el formato en `nota` del primero (`EMOM 10 min`).

### 2.3 Tipos de sesión
`pecho`, `espalda`, `pierna`, `hombro`, `brazo`, `torso`, `pierna-gluteo`, `empuje`, `tiron`, `full`, `cardio`, `movilidad`, `deporte`, `mixto`. Si el usuario usa otro nombre ("día A", "PPL-push"), se guarda en `titulo` y el `tipo` se deduce de los ejercicios.

---

## 3. Reglas de normalización (generales)

Estas reglas valen para cualquier usuario. Si alguna choca con lo que dice `convenciones.md`, **gana convenciones.md**.

### 3.1 Separar el material de entrada
- **Texto (`.md`, `.txt`, notas):** se separa por fechas o cabeceras de sesión. Un bloque con varias fechas se divide en varias sesiones.
- **Exports de chats (Telegram, WhatsApp…):** cada mensaje es un elemento, y la hora del mensaje sirve de pista para la fecha.
- **CSV o exports de apps de entreno:** se detectan las columnas (fecha, ejercicio, peso, reps, RPE…) y se mapean de forma determinista. Claude solo interviene para identificar los ejercicios.
- **Imágenes** (foto de una libreta o captura de una app): Claude las lee. El resultado se marca con `confianza: media` como mínimo y conviene revisarlo.
- **Otros formatos:** Claude decide cómo separarlos e informa en el resumen del `/refresh`.

### 3.2 Fechas
1. La fecha escrita en el contenido manda, en cualquier formato o idioma ("12/03", "mar 12", "Monday 3rd", "Día 12 - marzo").
2. Si falta el año: el del fichero o mensaje, eligiendo la fecha más cercana anterior.
3. **Formatos ambiguos** (`03/04`): se usa el orden de `convenciones.md`. Si todavía no está definido, se deduce de las fechas sin ambigüedad del mismo material, se pregunta y se guarda.
4. Si la fecha escrita contradice la del contenedor (mensaje o fichero) por más de 2 meses, se usa la del contenedor y se anota en `revision.md`.
5. Sin ninguna fecha: la del contenedor y `confianza: media`. Sin contenedor con fecha: se pregunta.

### 3.3 Series, repeticiones y carga: notaciones habituales
Ante una notación de tres números, la regla es identificar cuál es la carga (lleva unidad o es claramente la mayor) y cuáles son las series y las repeticiones. Si queda ambigua, se usa `convenciones.md` o se pregunta.

| Notación | Interpretación |
|---|---|
| `3x10 50kg` · `3x10x50` · `50x10x3` · `50kg 3x10` | 3 series × 10 reps × 50 kg |
| `10 - 50 kg x 3` · `10 reps @ 50 ×3` | 3 series × 10 reps × 50 kg |
| `50x10, 55x8, 60x6` | 3 series con cargas distintas |
| `10, 8, 6 - 60 kg` | 3 series a 60 kg con 10, 8 y 6 reps |
| `5/5/5/3 @ 100` | 4 series a 100 kg |
| `3×5 @ 80 kg RPE 8` | prescripción + lo hecho, si no hay más detalle |
| `5 @8`, `x5 @RPE 8`, `5 reps RIR 2` | esfuerzo en `rpe` o `rir` |
| `8-10 reps` (rango sin más) | valor bajo en `reps` y rango en `nota` |
| `AMRAP: 9`, `max`, `al fallo` | tipo `amrap`, o reps = `fallo` si no hay número |
| `drop 60→40→20` | 3 filas `dropset` |

- **Prescripción frente a ejecución:** si hay una línea de prescripción (`4×6 @ 80 % · 3 min`) y debajo lo realizado, las filas son lo realizado y la prescripción va a `nota`. Si solo hay prescripción y nada indica que se hizo distinto, se toma como hecha con `confianza: media`.

### 3.4 Unidades y números
- **Decimales:** `7.5`, `7,5`, `7'5` y `7½` son lo mismo.
- **kg y lb:** se guardan en la unidad original y el script convierte con `0,4536`. Con dos unidades para la misma carga ("31 lb / 14 kg"), se conserva la primera y la otra va a `nota`.
- **Mancuernas:** "2×20", "20 c/u", "20 por mano" son `20 kg/mano`. Las máquinas con dos brazos independientes, "por lado": `kg/lado`.
- **Barra:** si el usuario apunta solo los discos ("2 discos de 20"), se suma la barra de la config, salvo que `convenciones.md` diga otra cosa.
- **Posiciones de máquina** ("pin 7", "agujero 4", "nivel 11"…): son `nivel <n>`. Cuentan para la progresión en su propia escala. Si `convenciones.md` da una equivalencia en kg, el script la aplica.
- **Porcentajes** (`80 %`, `80% 1RM`): se resuelven a kg con el e1RM vigente de ese ejercicio. Si no hay e1RM, se guarda `80 %1RM`.

### 3.5 Lo que no se hizo, referencias y plantillas
- "Hoy no", "skip", "no me dio tiempo", un ejercicio tachado: `tipo: no_hecho`.
- **Referencias a otro día** ("la semana pasada 50×8", "anterior: …"): no son series de hoy, van a `nota`.
- **Plantillas a medio rellenar** (`___`, `[A / B]` sin elegir, casillas vacías): se ignora el hueco y se guarda solo lo ejecutado.

### 3.6 Calentamiento, movilidad y sensaciones
- **Series de aproximación** antes de las de trabajo ("aprox.", "calentamiento", "warm-up", cargas crecientes muy por debajo del trabajo): `aproximacion` o `calentamiento`.
- **Movilidad, prehab, bandas y estiramientos:** texto en `Calentamiento y movilidad`. No cuentan para el volumen.
- **Sensaciones en otra escala** (1-5, emojis, "bien/regular/mal"): se convierten a 0-10 con la tabla de `convenciones.md`, y el original se conserva.

### 3.7 Ejercicios
- Cada nombre se asocia a un `id` del catálogo, en cualquier idioma, abreviatura o mote: "banca", "bench", "BP", "press plano" → `press-banca`.
- Si no existe en el catálogo, se crea con su grupo y su tipo de carga. Si hay duda razonable entre dos, se elige el más probable y se anota en `revision.md`.
- **Variantes** (inclinado, unilateral, con pausa, en Smith): si cambian el estímulo de forma importante, son un `id` propio (`press-inclinado-mancuernas`). Si es un matiz, va a `nota`.
- **Nunca se renombra un `id` existente.** Para unificar dos, uno pasa a ser alias del otro y el script fusiona su historial.

### 3.8 Material que no es una sesión
- **Rutinas, estructuras o programas** ("Lunes torso, martes pierna…"): se guardan en `plantillas/`, con su fecha.
- **Días sin detalle** ("Hoy pierna", "Espalda y bíceps"): sesión con `tipo` y sin ejercicios, con `confianza: media`. Cuenta para racha y calendario, no para volumen.
- **Resúmenes de marcas** ("Mis máximos 2024: banca 80…"): van a `records.md → ## Marcas declaradas`, con año y sin reps conocidas. Se muestran como referencia, pero los PRs calculados salen solo de las sesiones.
- **Pausas** ("vacaciones", "lesionado 2 semanas"): un evento de `pausa` en el registro. La racha no se rompe si la pausa está declarada.
- **Vídeos, audios o mensajes sin contenido de entreno:** se ignoran y se cuentan en el resumen.

### 3.9 Molestias y salud
- Las menciones de dolor, molestia o lesión ("me tira el hombro", "rodilla bien", "knee pain") se guardan en `molestias` (zona, lado y estado) y el texto completo en `Notas`.
- gymhub **solo registra y muestra**. Si una molestia se repite en 3 o más sesiones seguidas, la web lo señala con una sugerencia neutra ("se repite: hombro izq. · valora consultarlo"). Nunca diagnostica ni prescribe.

---

## 4. `convenciones.md`: la forma de apuntar de cada usuario

Es lo que permite que el estándar funcione para cualquiera. Claude lo **crea en la primera importación**, a partir de lo que observa en el material y de las preguntas que va resolviendo, y lo **amplía** cuando aparece algo nuevo. El usuario puede editarlo cuando quiera.

```markdown
# Mis convenciones

## Fechas
- orden: día/mes            # día/mes | mes/día
- idioma: es

## Notación de series
- "10 - 50 kg x 3" = reps - carga × series
- "x5" detrás del nombre del ejercicio = nº total de series

## Unidades y máquinas
- "flecha N" = posición de máquina (nivel N)
- jalón: nivel 1 = 5 kg, +5 kg por nivel
- las mancuernas se apuntan por mano

## Sensaciones
- escala: 0-10

## Abreviaturas propias
- "PC" = peso corporal
- "HT" = hip thrust
- "MP" = multipower (Smith)
```

- **Prioridad:** `convenciones.md` > este documento > el criterio de Claude.
- **Preguntar una vez:** cada duda que se pueda generalizar, como el orden de una notación, se pregunta una sola vez y la respuesta se guarda aquí. No se vuelve a preguntar.
- **Hábitos que cambian:** una convención puede tener validez temporal (`desde 2025-01: "EJ1:" marca el inicio de cada ejercicio`).

---

## 5. Catálogo de ejercicios (`ejercicios.md`)

```markdown
| id | nombre | alias | grupo | secundarios | carga | patron | principal |
|---|---|---|---|---|---|---|---|
| press-banca | Press banca | banca, bench, bench press, BP, press plano | pecho | triceps, hombro | barra | empuje-horizontal | si |
| sentadilla | Sentadilla | squat, sentadilla libre, back squat | cuadriceps | gluteo, lumbar | barra | rodilla | si |
| jalon-pecho | Jalón al pecho | lat pulldown, jalón, polea al pecho | dorsal | biceps | polea | tiron-vertical | no |
```

- **Viene precargado** con unos 120 ejercicios comunes y alias en español e inglés. Crece con cada usuario.
- **Grupos** (son los del mapa muscular): `pecho`, `dorsal`, `espalda-alta`, `trapecio`, `lumbar`, `hombro`, `biceps`, `triceps`, `antebrazo`, `abdomen`, `cuadriceps`, `femoral`, `gluteo`, `aductor`, `gemelo`.
- **Series por grupo:** 1 por serie en el grupo principal y 0,5 en cada secundario.
- **Tipo de carga:** `barra`, `mancuerna`, `maquina`, `polea`, `peso-corporal`, `kettlebell`, `banda`, `otro`.
- **Patrón de movimiento** (para el radar y los ratios de Análisis): `empuje-horizontal`, `empuje-vertical`, `tiron-horizontal`, `tiron-vertical`, `cadera`, `rodilla`, `aislamiento`, `core`, `cardio`. Si el ejercicio es nuevo, Claude lo asigna al crearlo.
- **Principal:** `si` en los ejercicios de referencia de cada patrón (por ejemplo press banca, press militar, remo con barra, dominadas, peso muerto, sentadilla). Sirve para comparar fuerza entre patrones. Si un usuario no hace ninguno de un patrón, se usa su ejercicio más frecuente de ese patrón.

---

## 6. `revision.md`

```markdown
- [ ] 2025-01-14 · el año escrito (2024) no cuadra con el fichero (2025) → usado 2025-01-14
- [ ] 2023-10-16 · pone "x5" pero hay 3 series → guardadas 3
- [ ] 2023-08-25 · "espalda arriba": ¿jalón al pecho? → jalon-pecho
```

- Si corriges algo en la sesión y marcas la casilla, el siguiente `/refresh` lo respeta.
- Si la duda era una convención, la respuesta pasa a `convenciones.md`.
- **Lo editado a mano en `sesiones/` nunca se sobrescribe:** el script guarda el hash de cada sesión generada y, si ha cambiado, la deja como está.

---

## 7. Idempotencia e importaciones grandes

- **Sin duplicados:** cada elemento de entrada se identifica por un hash de su texto normalizado (`procesados.json`). Lo que ya se importó no se vuelve a importar.
- **Mismo día:** si ya hay una sesión con el mismo contenido, se omite. Si el contenido es distinto, se crea `-2` y se pregunta en `revision.md` si son la misma.
- **Importación grande** (más de 20 elementos nuevos):
  1. Primero se hace una **pasada de muestreo** sobre unos 30 elementos repartidos en el tiempo, para crear `convenciones.md` y resolver las preguntas generales de golpe.
  2. Después se procesa por meses, en lotes reanudables (`importacion.json`), con el avance en la web.
  3. Al final, una pasada de coherencia del catálogo.
