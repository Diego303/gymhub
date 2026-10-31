# Cómo se guarda lo que normalizas (`refresh guardar`)

Le pasas al script, por un heredoc, una serie de **bloques**. Cada bloque empieza con una línea `@@@ <tipo> …`. El script lo valida todo y, si algo falla, **no escribe nada** y te dice qué corregir. Entonces corriges y vuelves a enviar el lote **completo**.

```bash
node "${CLAUDE_PLUGIN_ROOT}/bin/gymhub.mjs" refresh guardar 3 <<'GYMHUB_FIN'
@@@ sesion elementos=1a2b3c4d5e
---
fecha: 2024-03-12
titulo: Torso
tipo: torso
sensacion_pre: 7
confianza: alta
---
# 2024-03-12 · Torso

## Ejercicios

### Press banca
<!-- id: press-banca -->
| # | tipo | carga | reps | rpe | rir | nota |
|---|---|---|---|---|---|---|
| 1 | trabajo | 80 kg | 5 | 8 | | |

## Notas
Lo que escribió la persona, tal cual o apenas limpio.
@@@ ignorar elementos=9f8e7d6c5b · motivo: mensaje sin entreno («buenos días»)
@@@ revision
- 2024-03-12 · "espalda arriba": ¿jalón al pecho? → jalon-pecho
GYMHUB_FIN
```

Si el heredoc no pasa (por ejemplo, porque el permiso de Bash lo bloquea por alguna comilla), escribe el mismo texto con Write en `<carpeta de datos>/.gymhub/entrada/lote-<n>.md` y ejecuta `refresh guardar <n> --fichero .gymhub/entrada/lote-<n>.md`.

## Bloques

| Bloque | Para qué |
|---|---|
| `@@@ sesion elementos=<id>[,<id>…]` | Una sesión en el formato estándar (FORMATO §2), con frontmatter. Los ids son los de los elementos de los que sale. Un elemento con dos días va en dos sesiones; dos mensajes del mismo entreno van en una. **El texto original lo añade el script**, exacto, a partir de los elementos: no hace falta que lo copies. |
| `@@@ ignorar elementos=<ids> · motivo: <texto>` | Lo que no es entreno ni sirve de nada (saludos, vídeos, «hoy no voy»). El motivo es obligatorio. |
| `@@@ plantilla <nombre> elementos=<ids>` | Una rutina o programa (FORMATO §3.8): un bloque por rutina, con el formato de abajo. |
| `@@@ marcas elementos=<ids>` | Resúmenes de marcas sin sesión («mis máximos 2024: banca 80»): líneas `- 2024 · press banca 80 kg`. |
| `@@@ evento elementos=<ids>` | Pausas e hitos: `- 2024-08-01 → 2024-08-15 · pausa · vacaciones`, `- 2025-01-07 · programa · Fuerza 12 sem`. |
| `@@@ ejercicios` | Filas nuevas del catálogo, con la cabecera de `ejercicios.md`: `\| id \| nombre \| alias \| grupo \| secundarios \| carga \| patron \| principal \|`. Úsalo antes de usar un id que no existe. |
| `@@@ alias <id>: mote1, mote2` | Aprender un mote para un ejercicio que ya existe. Poner el id de otro ejercicio como alias los fusiona. |
| `@@@ revision` | Dudas para `revision.md`, una por línea: `- AAAA-MM-DD · la duda → lo que has decidido`. |
| `@@@ convenciones` | El `convenciones.md` **completo** de la persona, cuando aprendas algo de cómo apunta (FORMATO §4). |

## Formato de una plantilla

```markdown
---
nombre: Pierna A
tipo: pierna
dia: lunes          # opcional: lunes … domingo
---
- Sentadilla · 5×5 · 120 kg · 3 min
- Peso muerto rumano · 3×8 · 100 kg
```

Una línea por ejercicio, separada con ` · `: nombre, `series×reps`, carga y descanso. Solo el nombre es obligatorio.

## Reglas que comprueba el script

- **Todos los elementos del lote** tienen que aparecer en algún bloque. Si falta uno, no se guarda nada.
- Cada sesión valida: fecha `AAAA-MM-DD`, tipos de serie, cargas (`80 kg`, `185 lb`, `20 kg/mano`, `PC+10 kg`, `nivel 7`…), repeticiones, RPE de 1 a 10, molestias (`bien | molestia | dolor`, lado `izq | der | ambos`) e **ids que existen en el catálogo** (o en un bloque `@@@ ejercicios` del mismo envío).
- **Nunca se sobrescribe** una sesión que ya existe. Si ese día ya hay otra con contenido distinto, se guarda como `AAAA-MM-DD-2.md` y se anota la duda en `revision.md`. Si es idéntica, se omite.
- `confianza: baja` añade sola una duda en `revision.md`. Las sesiones que salen de una imagen son, como mucho, `media`.

## Registrar sin importación (en una conversación)

Si la persona te cuenta un entreno en el chat («hoy banca 3x5 80»), guarda la sesión con `refresh guardar directo`. Es el mismo formato, pero sin `elementos=…`: incluye tú el original al final de la sesión.

```
<details><summary>Original</summary>

hoy banca 3x5 80

</details>
```
