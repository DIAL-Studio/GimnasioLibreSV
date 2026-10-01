import { describe, it, expect } from 'vitest'
import { buildHealthCsv, csvDateTime, sessionActivity } from './health-export.js'
import { EXDB } from './exercises.js'

const CARDIO = EXDB.find(e => e.bp === 'cardio').id
const LIFT = EXDB.find(e => e.bp !== 'cardio' && e.eq !== 'body weight').id

// Local-date constructors everywhere: the exporter writes local wall time, so the
// assertions stay true in any timezone the suite runs in.
const at = (d, h, min = 0, s = 0) => new Date(2026, 8, d, h, min, s).getTime()
const WORKOUT = {
  id: 'w1', d: '2026-09-01', name: 'Push',
  start: at(1, 7, 30), end: at(1, 8, 15),
  entries: [{ id: LIFT, sets: [{ done: true }] }],
}
const lines = csv => csv.trimEnd().split('\n')

describe('buildHealthCsv', () => {
  it('writes the exact header the importer documents', () => {
    expect(lines(buildHealthCsv({ workouts: [] }))[0]).toBe(
      'start datetime,end datetime,activity,energy burned (kcal),distance (mi)'
    )
  })

  it('is header-only for an empty history — and a missing state is the same thing', () => {
    expect(buildHealthCsv({ workouts: [] })).toBe(
      'start datetime,end datetime,activity,energy burned (kcal),distance (mi)\n'
    )
    expect(buildHealthCsv({})).toBe(buildHealthCsv({ workouts: [] }))
    expect(buildHealthCsv()).toBe(buildHealthCsv({ workouts: [] }))
  })

  it('writes one row per workout, with the session activity label', () => {
    const rows = lines(buildHealthCsv({ workouts: [WORKOUT, { ...WORKOUT, id: 'w2', start: at(3, 9), end: at(3, 10) }] }))
    expect(rows).toHaveLength(3)
    expect(rows[1]).toContain(',Strength Training,,')
    expect(rows[2]).toContain(',Strength Training,,')
  })

  it('formats start and end as local yyyy-MM-dd HH:mm:ss, as the example CSV does', () => {
    expect(csvDateTime(at(1, 7, 30, 5))).toBe('2026-09-01 07:30:05')
    const row = lines(buildHealthCsv({ workouts: [WORKOUT] }))[1]
    expect(row.startsWith('2026-09-01 07:30:00,2026-09-01 08:15:00,')).toBe(true)
  })

  it('leaves energy and distance blank — the app records neither, so neither is invented', () => {
    const row = lines(buildHealthCsv({ workouts: [WORKOUT] }))[1]
    const fields = row.split(',')
    expect(fields).toHaveLength(5)
    expect(fields[3]).toBe('')
    expect(fields[4]).toBe('')
    expect(row.endsWith(',,')).toBe(true)
  })

  it('sorts rows by start, oldest first, regardless of how the history is stored', () => {
    const w1 = { ...WORKOUT, id: 'a', start: at(1, 9), end: at(1, 10) }
    const w2 = { ...WORKOUT, id: 'b', start: at(2, 9), end: at(2, 10) }
    const w3 = { ...WORKOUT, id: 'c', start: at(3, 9), end: at(3, 10) }
    const rows = lines(buildHealthCsv({ workouts: [w3, w1, w2] }))
    expect(rows[1].startsWith('2026-09-01 ')).toBe(true)
    expect(rows[2].startsWith('2026-09-02 ')).toBe(true)
    expect(rows[3].startsWith('2026-09-03 ')).toBe(true)
  })

  it('labels a cardio-dominated session Cardio and everything else Strength Training', () => {
    const lift = { id: LIFT }
    const cardio = { id: CARDIO }
    expect(sessionActivity({ entries: [lift, lift, lift] })).toBe('Strength Training')
    expect(sessionActivity({ entries: [cardio, cardio, lift] })).toBe('Cardio')
    // exactly half is not "dominated" — still a strength session
    expect(sessionActivity({ entries: [cardio, lift] })).toBe('Strength Training')
    // no entries (or no workout at all) reads as the app's core activity
    expect(sessionActivity({ entries: [] })).toBe('Strength Training')
    expect(sessionActivity(null)).toBe('Strength Training')
  })

  it('reads an explicit mode and the plan target a finished workout keeps', () => {
    // a lift the user files under cardio logs a cardio row even without the body part
    expect(sessionActivity({ entries: [{ id: LIFT, mode: 'cardio' }] })).toBe('Cardio')
    // finished workouts keep the plan config on target; imported ones only have the id
    expect(sessionActivity({ entries: [{ id: LIFT, target: { id: LIFT, mode: 'cardio' } }] })).toBe('Cardio')
    expect(sessionActivity({ entries: [{ id: CARDIO, target: { id: CARDIO } }] })).toBe('Cardio')
  })

  it('skips workouts without a usable start and clamps a reversed end to the start', () => {
    const broken = { ...WORKOUT, id: 'broken', start: undefined }
    const reversed = { ...WORKOUT, id: 'r', start: at(2, 9), end: at(2, 8) }
    const rows = lines(buildHealthCsv({ workouts: [broken, reversed] }))
    expect(rows).toHaveLength(2)
    expect(rows[1].startsWith('2026-09-02 09:00:00,2026-09-02 09:00:00,')).toBe(true)
  })
})
