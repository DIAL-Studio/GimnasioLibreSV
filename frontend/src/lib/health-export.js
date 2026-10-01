// Session-level CSV for the two on-device bridges into the phone health hubs:
//   - iPhone: Apple Health, via the "Health CSV Importer" app (healthcsvimporter.com)
//   - Android: Health Connect, via Tasker + the "Tasker Health Connect" plugin
// (docs/HEALTH_SYNC.md walks through both.)
//
// Only sessions can ever reach those hubs: neither HealthKit nor Health Connect has a
// per-set data type, so sets, reps and weights stay in openGym. The app also records no
// calories or distance, and this file does not invent them — both columns go out empty.
//
// Schema and datetime format are pinned to the official workout example CSV in the
// importer's guide (https://2017.lionheartsw.com/software/health-csv-importer/guide.html,
// "Workouts and Exercise Activities" example):
//
//   start datetime,end datetime,activity,energy burned (kcal),distance (mi)
//   2024-01-01 12:00:00,2024-01-01 13:00:00,running,100,1
//
// i.e. local wall time as `yyyy-MM-dd HH:mm:ss` with no UTC offset — the guide says the
// importer then asks which timezone to read the values in (local/GMT), and local is the
// right answer for a phone-only app.
import { modeOf } from './history.js'

const HEADER = 'start datetime,end datetime,activity,energy burned (kcal),distance (mi)'
const pad = n => String(n).padStart(2, '0')

// `yyyy-MM-dd HH:mm:ss` in the phone's local time, mirroring the example CSV exactly.
export function csvDateTime(ms) {
  const d = new Date(ms)
  if (!Number.isFinite(d.getTime())) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// The hubs only want an activity type, so this is deliberately coarse. A finished workout
// keeps the plan config on `target` (and old/imported ones don't), so mode is read the same
// way the rest of the app reads it: an explicit `mode` first, then the exercise's body part.
const entryMode = e => modeOf({ id: e && e.id, mode: (e && e.mode) || (e && e.target && e.target.mode) })

// Cardio only when the session's entries are mostly cardio. Everything else — including
// sessions with no entries — reads as Strength Training: the thing this app is for.
export function sessionActivity(w) {
  const entries = (w && w.entries) || []
  const cardio = entries.filter(e => entryMode(e) === 'cardio').length
  return entries.length > 0 && cardio * 2 > entries.length ? 'Cardio' : 'Strength Training'
}

// One row per workout, oldest first. A workout without a usable start is skipped rather
// than written with an empty date, which the importer would reject row by row.
export function buildHealthCsv(S) {
  const rows = [HEADER]
  const workouts = [...((S && S.workouts) || [])]
    .filter(w => w && Number.isFinite(w.start))
    .sort((a, b) => a.start - b.start)
  for (const w of workouts) {
    const end = Number.isFinite(w.end) && w.end >= w.start ? w.end : w.start
    rows.push([csvDateTime(w.start), csvDateTime(end), sessionActivity(w), '', ''].join(','))
  }
  return rows.join('\n') + '\n'
}
