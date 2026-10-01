# Sincronizar entrenamientos con Apple Health y Health Connect

La app guarda tus entrenamientos con todo el detalle: ejercicios, series, reps y peso.
Los centros de salud del teléfono (Apple Health en iPhone, Health Connect en Android)
solo entienden **sesiones**: fecha, hora de inicio y fin, y tipo de actividad. HealthKit y
Health Connect no tienen ningún tipo de dato por serie, así que **las series, reps y pesos
nunca salen de la app** — ni con esta exportación ni con ninguna otra. Para el detalle, el
historial de la app es la fuente de verdad; los centros de salud solo suman la sesión al
historial de actividad del día.

La app **no registra calorías ni distancia**, así que no se inventan: en el archivo van en
blanco y el centro de salud las mostrará vacías o calculadas por él (si el reloj las mide).

Esta guía cubre las tres vías que existen hoy, sin cuentas y sin backend. Todas empiezan
en **Ajustes → Datos**.

## Qué se exporta exactamente

| Dato | ¿Llega al centro de salud? |
|---|---|
| Fecha de la sesión | Sí |
| Hora de inicio y fin | Sí |
| Tipo de actividad (`Strength Training` / `Cardio`) | Sí |
| Series, reps, peso, volumen | **No** — no existe un tipo de dato para eso |
| Calorías | No — la app no las registra y no se inventan |
| Distancia | No — igual que las calorías |

### El archivo CSV

**Exportar para apps de salud** (justo debajo de *Exportar copia (JSON)*) descarga o
comparte `gimnasiolibresv-health-AAAA-MM-DD.csv`, con exactamente las columnas del ejemplo
oficial de Health CSV Importer:

```csv
start datetime,end datetime,activity,energy burned (kcal),distance (mi)
2026-09-01 07:30:00,2026-09-01 08:15:00,Strength Training,,
```

Las fechas van en **hora local** con formato `yyyy-MM-dd HH:mm:ss`, sin zona horaria. Si el
importador te pregunta en qué zona leerlas, elige la tuya: los datos se registraron en la
hora del teléfono.

## iPhone — Health CSV Importer (la vía principal)

[Health CSV Importer](https://healthcsvimporter.com) es una app de iOS que importa archivos
CSV a Apple Health. Importar peso es gratis; los entrenamientos suelen requerir la versión
Pro (consulta los precios actuales en su web).

1. En la app: **Ajustes → Datos → Exportar para apps de salud** y guarda el CSV.
2. Consigue el archivo en el iPhone: si exportaste desde la web, se descarga directo; si
   exportaste desde la app nativa, sale la hoja de compartir (AirDrop, Archivos, correo…).
3. Instala **Health CSV Importer** desde la App Store.
4. Abre la app e importa el CSV. En el asistente:
   - Tipo de dato: **Workouts** (entrenamientos).
   - Mapea las columnas si te lo pide: `start datetime` → inicio, `end datetime` → fin,
     `activity` → actividad.
   - Zona horaria: la tuya (hora local).
5. Los entrenamientos aparecen en **Salud → Entrenamientos**. Repite el import cada vez que
   quieras: el importador evita duplicados comparando inicio, fin, tipo y actividad.

Si `Strength Training` o `Cardio` no se reconocen en el mapeo, elige a mano el tipo
equivalente (fuerza / cardio) cuando el asistente lo pregunte.

> Nota: las columnas de energía y distancia van vacías a propósito. La app no las mide;
> no queremos que aparezcan datos falsos en tu historial de salud.

## Android — Tasker + Tasker Health Connect (receta avanzada)

En Android no existe un importador de CSV a Health Connect, así que esta vía usa Tasker
([Play Store](https://play.google.com/store/apps/details?id=net.dinglisch.android.taskerm))
y el plugin gratuito [Tasker Health Connect](https://github.com/RafhaanShah/TaskerHealthConnect)
(APK en GitHub Releases u Obtainium). Es una receta para gente técnica: el plugin escribe
JSON directamente contra la API de Health Connect.

1. Instala **Health Connect** (en Android 14 y superiores ya viene en el sistema; en
   versiones anteriores está en Play Store) y el plugin **Tasker Health Connect**.
2. Abre el plugin una vez y concede permisos de escritura.
3. En la app: **Ajustes → Datos → Exportar copia (JSON)** y guarda el archivo. Ahí están
   los campos `start` y `end` de cada sesión (milisegundos epoch: los mismos que necesita
   Health Connect).
4. En Tasker crea una tarea → **añadir acción → Plugin → Tasker Health Connect → Write Data**.
5. Rellena los dos campos:
   - *Class of the type of Health Record*: `ExerciseSessionRecord`
   - *JSON Object or List of Objects to write*: un objeto (o una lista) por sesión, con los
     mismos `start`/`end` del backup:

   ```json
   [
     { "startTime": 1788269400000, "endTime": 1788272100000, "exerciseType": 70 }
   ]
   ```

6. `exerciseType` es el tipo de actividad de Health Connect: **70 = Strength Training**
   (fuerza). Para sesiones con mayoría de cardio usa **0 = Other Workout**, o el tipo
   concreto (correr, bici…) si lo sabes.
7. Ejecuta la tarea una vez por cada lote de sesiones. Como el plugin no deduplica, no
   vuelvas a escribir el mismo rango de fechas dos veces.

Puedes automatizarlo del todo (leer el JSON del backup con las acciones *JSON Read* de
Tasker y armar la lista), pero para un historial pequeño es más rápido pegar los objetos
nuevos y ejecutar la tarea una sola vez.

## Alternativa gratis en iPhone — Atajos (Shortcuts)

Si no quieres pagar la versión Pro del importador:

1. Abre **Atajos** en el iPhone y crea un atajo nuevo.
2. Busca la acción del sistema **Registrar entrenamiento** (*Log Workout*, dentro de Salud).
   Es gratis y viene incluida en iOS.
3. Configúrala con el tipo (*Strength Training* / *Cardio*) y la duración de la sesión.
4. Si el formulario te obliga a poner energía o distancia, deja **0**: es un campo
   obligatorio del atajo, no una medición real — la app no registra esos datos.
5. Ejecuta el atajo una vez por sesión. Según tu versión de iOS, el entrenamiento puede
   quedar registrado a la hora en que ejecutaste el atajo; si necesitas las horas exactas
   de inicio y fin, usa la vía del CSV con Health CSV Importer.

## La verdad incómoda: las series no llegan nunca

Ni Apple Health ni Health Connect tienen un tipo de dato para una serie (peso × reps). Eso
significa que ninguna app de salud va a mostrar "press banca 4×8 @ 60 kg" a partir de un
import — ni desde aquí ni desde ningún otro exportador. Lo que sí ganas es la sesión
completa: que el día cuente como entrenado, con su duración y su tipo. El detalle de las
series vive en el historial de la app, que es donde se puede consultar y progresar.

---

Referencias verificadas:

- Esquema y formatos de fecha: [guía de Health CSV Importer](https://2017.lionheartsw.com/software/health-csv-importer/guide.html)
  (pestaña "Workouts and Exercise Activities" del CSV de ejemplo).
- Plugin de Android: [TaskerHealthConnect](https://github.com/RafhaanShah/TaskerHealthConnect).
- Constantes de tipo de ejercicio de Health Connect: [ExerciseSessionRecord](https://developer.android.com/reference/kotlin/androidx/health/connect/client/records/ExerciseSessionRecord)
  (`STRENGTH_TRAINING = 70`, `OTHER_WORKOUT = 0`).
