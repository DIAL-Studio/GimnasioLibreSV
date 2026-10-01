import { describe, it, expect, afterAll } from 'vitest'

// Same reasoning as format.test.js: pin a UTC-6 zone before the parsers are imported, or a
// day key read as UTC midnight (and local instants built off it) cannot be told apart from
// the correct parse. El Salvador is the app's launch market.
const ORIG_TZ = process.env.TZ
process.env.TZ = 'America/El_Salvador'
const { parseWorkoutCSV, parseBodyweight } = await import('./import-csv.js')
const { isoOf } = await import('./format.js')

afterAll(() => {
  if (ORIG_TZ === undefined) delete process.env.TZ
  else process.env.TZ = ORIG_TZ
})

describe('imported dates stay on the day the file names (America/El_Salvador)', () => {
  it('files a workout under the literal date, with its start instant on that local day', () => {
    const p = parseWorkoutCSV('Date,Exercise,Weight,Reps\n2026-09-01,Bench Press,60,10', { unit: 'kg' })
    expect(p.error).toBeUndefined()
    const w = p.workouts[0]
    expect(w.d).toBe('2026-09-01')
    expect(isoOf(new Date(w.start))).toBe('2026-09-01')
    expect(new Date(w.start).getHours()).toBe(18)   // a file with no clock defaults to 18:00 local
  })

  it('keeps a workout time-of-day on the local day it was performed', () => {
    const p = parseWorkoutCSV(
      'Date,Workout Name,Exercise Name,Set Order,Weight,Reps\n2026-09-01 20:30,Push,Bench Press,1,60,10',
      { unit: 'kg' })
    const w = p.workouts[0]
    expect(w.d).toBe('2026-09-01')
    expect(new Date(w.start).getHours()).toBe(20)
    expect(new Date(w.start).getMinutes()).toBe(30)
    expect(isoOf(new Date(w.start))).toBe('2026-09-01')
  })

  it('maps a bodyweight date to local midnight, not to UTC midnight (the day before)', () => {
    const p = parseBodyweight('Date,Weight (kg)\n2026-09-01,80', { unit: 'kg' })
    expect(p.error).toBeUndefined()
    const b = p.bodyweight[0]
    expect(b.d).toBe('2026-09-01')
    expect(isoOf(new Date(b.t))).toBe('2026-09-01')
    expect(new Date(b.t).getHours()).toBe(0)
  })

  it('keeps a bodyweight time-of-day on the same local day', () => {
    const p = parseBodyweight('Date,Weight (kg)\n2026-09-01 07:30,80', { unit: 'kg' })
    const b = p.bodyweight[0]
    expect(b.d).toBe('2026-09-01')
    expect(isoOf(new Date(b.t))).toBe('2026-09-01')
    expect(new Date(b.t).getHours()).toBe(7)
    expect(new Date(b.t).getMinutes()).toBe(30)
  })
})
