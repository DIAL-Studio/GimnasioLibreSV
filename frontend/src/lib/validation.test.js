import { describe, it, expect } from 'vitest'
import { LIMITS, toNumber, clampNum, clampInt, clampField, limitsFor, normalizeConfig } from './validation.js'

describe('LIMITS', () => {
  it('pins the bounds every field is validated against', () => {
    expect(LIMITS.sets).toEqual({ min: 1, max: 20, int: true })
    expect(LIMITS.reps).toEqual({ min: 1, max: 100, int: true })
    expect(LIMITS.repsMin).toEqual({ min: 1, max: 100, int: true })
    expect(LIMITS.repsMax).toEqual({ min: 1, max: 100, int: true })
    expect(LIMITS.sec).toEqual({ min: 1, max: 3600, int: true })
    expect(LIMITS.min).toEqual({ min: 1, max: 600, int: true })
    expect(LIMITS.speed).toEqual({ min: 0, max: 50, dp: 1 })
    expect(LIMITS.load).toEqual({ min: 0, max: 300, dp: 1, lbMax: 660 })
    expect(LIMITS.inc).toEqual({ min: 0.25, max: 50, dp: 2 })
  })

  it('keeps a zero floor where zero is a real answer and a one floor where it is not', () => {
    expect(LIMITS.load.min).toBe(0)
    expect(LIMITS.speed.min).toBe(0)
    expect(LIMITS.sets.min).toBe(1)
    expect(LIMITS.reps.min).toBe(1)
    expect(LIMITS.sec.min).toBe(1)
    expect(LIMITS.min.min).toBe(1)
  })
})

describe('toNumber', () => {
  it('reads numbers and numeric strings, including a comma decimal', () => {
    expect(toNumber(5)).toBe(5)
    expect(toNumber('5')).toBe(5)
    expect(toNumber(' 5 ')).toBe(5)
    expect(toNumber('2,5')).toBe(2.5)
    expect(toNumber(-5)).toBe(-5)
    expect(toNumber(0)).toBe(0)
  })

  it('refuses everything that is not a finite number', () => {
    expect(toNumber(NaN)).toBe(null)
    expect(toNumber(Infinity)).toBe(null)
    expect(toNumber(-Infinity)).toBe(null)
    expect(toNumber(null)).toBe(null)
    expect(toNumber(undefined)).toBe(null)
    expect(toNumber('')).toBe(null)
    expect(toNumber('   ')).toBe(null)
    expect(toNumber('abc')).toBe(null)
    expect(toNumber('-')).toBe(null)
    expect(toNumber('.')).toBe(null)
    expect(toNumber(true)).toBe(null)
    expect(toNumber({})).toBe(null)
    expect(toNumber([])).toBe(null)
  })
})

describe('clampNum', () => {
  it('clamps below the floor — a negative is not flipped positive', () => {
    expect(clampNum(-5, { min: 0 })).toBe(0)
    expect(clampNum(-5, { min: 1 })).toBe(1)
    expect(clampNum(-0.1, { min: 0 })).toBe(0)
  })

  it('clamps above the ceiling', () => {
    expect(clampNum(350, { max: 300 })).toBe(300)
    expect(clampNum(660.4, { max: 660 })).toBe(660)
    expect(clampNum(300, { max: 300 })).toBe(300)
  })

  it('rounds to the requested decimal places', () => {
    expect(clampNum(33.333, { dp: 1 })).toBe(33.3)
    expect(clampNum(2.75, { dp: 1 })).toBe(2.8)
    expect(clampNum(2.74, { dp: 1 })).toBe(2.7)
    expect(clampNum(0.256, { dp: 2 })).toBe(0.26)
    expect(clampNum(0.254, { dp: 2 })).toBe(0.25)
  })

  it('takes a fallback for blank or invalid input, and null without one', () => {
    expect(clampNum('', { min: 0, max: 300, fallback: 8 })).toBe(8)
    expect(clampNum(null, { min: 0, fallback: 8 })).toBe(8)
    expect(clampNum(undefined, { fallback: 8 })).toBe(8)
    expect(clampNum(NaN, { fallback: 8 })).toBe(8)
    expect(clampNum(Infinity, { fallback: 8 })).toBe(8)
    expect(clampNum('abc', { fallback: 8 })).toBe(8)
    expect(clampNum(null, { min: 0, max: 300 })).toBe(null)
    expect(clampNum('', {})).toBe(null)
  })

  it('normalizes the fallback through the same bounds', () => {
    // a fallback cannot smuggle a value past the floor or ceiling
    expect(clampNum('', { min: 1, max: 100, fallback: 0 })).toBe(1)
    expect(clampNum('', { min: 1, max: 100, fallback: 999 })).toBe(100)
    expect(clampNum('', { min: 0, max: 50, dp: 1, fallback: 8.28 })).toBe(8.3)
  })

  it('leaves a valid value alone when no bounds apply', () => {
    expect(clampNum(5)).toBe(5)
    expect(clampNum('5')).toBe(5)
    expect(clampNum(0)).toBe(0)
  })
})

describe('clampInt', () => {
  it('rounds a fraction to the nearest whole number instead of truncating it', () => {
    expect(clampInt(2.7)).toBe(3)
    expect(clampInt(2.4)).toBe(2)
    expect(clampInt(2.5)).toBe(3)
    expect(clampInt('3.9')).toBe(4)
    expect(clampInt('2.1')).toBe(2)
    // the old pipeline cut "2.7" at the dot and stored 2 — it must never do that again
    expect(clampInt(2.7)).not.toBe(2)
  })

  it('clamps to the integer bounds', () => {
    expect(clampInt(-5, { min: 1 })).toBe(1)
    expect(clampInt(0, { min: 1 })).toBe(1)
    expect(clampInt(250, { max: 100 })).toBe(100)
    expect(clampInt(1.4, { min: 1, max: 20 })).toBe(1)
    expect(clampInt(19.5, { min: 1, max: 20 })).toBe(20)
  })

  it('takes a fallback for blank or invalid input, and null without one', () => {
    expect(clampInt('', { min: 1, max: 20, fallback: 3 })).toBe(3)
    expect(clampInt(NaN, { min: 1, max: 20, fallback: 3 })).toBe(3)
    expect(clampInt(Infinity, { fallback: 3 })).toBe(3)
    expect(clampInt('abc', { fallback: 3 })).toBe(3)
    expect(clampInt(null, { min: 1 })).toBe(null)
  })

  it('normalizes the fallback through the same bounds', () => {
    expect(clampInt('', { min: 1, max: 20, fallback: 0 })).toBe(1)
    expect(clampInt('', { min: 1, max: 20, fallback: 99 })).toBe(20)
  })
})

describe('clampField', () => {
  it('validates each field by name', () => {
    expect(clampField('sets', 25)).toBe(20)
    expect(clampField('sets', 0)).toBe(1)
    expect(clampField('sets', 4.6)).toBe(5)
    expect(clampField('reps', 0)).toBe(1)
    expect(clampField('reps', 250)).toBe(100)
    expect(clampField('reps', 2.7)).toBe(3)
    expect(clampField('repsMin', 0)).toBe(1)
    expect(clampField('repsMax', 0)).toBe(1)
    expect(clampField('sec', 0)).toBe(1)
    expect(clampField('sec', 5000)).toBe(3600)
    expect(clampField('sec', 90.4)).toBe(90)
    expect(clampField('min', 0)).toBe(1)
    expect(clampField('min', 601)).toBe(600)
  })

  it('keeps 0 a valid weight and speed, and clamps beyond the decimal bounds', () => {
    expect(clampField('speed', 0)).toBe(0)
    expect(clampField('speed', -2)).toBe(0)
    expect(clampField('speed', 33.33)).toBe(33.3)
    expect(clampField('speed', 99)).toBe(50)
    expect(clampField('load', 0)).toBe(0)
    expect(clampField('load', -5)).toBe(0)
    expect(clampField('load', 62.55)).toBe(62.6)
    expect(clampField('inc', 0)).toBe(0.25)
    expect(clampField('inc', 0.1)).toBe(0.25)
    expect(clampField('inc', 0.256)).toBe(0.26)
    expect(clampField('inc', 100)).toBe(50)
  })

  it('resolves the load ceiling by unit', () => {
    expect(clampField('load', 350)).toBe(300)
    expect(clampField('load', 350, { unit: 'kg' })).toBe(300)
    expect(clampField('load', 350, { unit: 'lb' })).toBe(350)
    expect(clampField('load', 700, { unit: 'lb' })).toBe(660)
    // only load is unit-aware; the other decimal fields don't move
    expect(clampField('speed', 60, { unit: 'lb' })).toBe(50)
  })

  it('takes a fallback for blank input', () => {
    expect(clampField('sets', '', { fallback: 3 })).toBe(3)
    expect(clampField('min', '', { fallback: 20 })).toBe(20)
    expect(clampField('speed', '', { fallback: 8 })).toBe(8)
    expect(clampField('load', '', { fallback: 0 })).toBe(0)
  })

  it('passes an unknown field through untouched', () => {
    expect(clampField('nope', 'junk')).toBe('junk')
    expect(clampField('nope', -5)).toBe(-5)
  })
})

describe('limitsFor', () => {
  it('returns the input props a field needs, with the unit-aware load ceiling', () => {
    expect(limitsFor('sets')).toEqual({ min: 1, max: 20, int: true })
    expect(limitsFor('reps')).toEqual({ min: 1, max: 100, int: true })
    expect(limitsFor('sec')).toEqual({ min: 1, max: 3600, int: true })
    expect(limitsFor('speed')).toEqual({ min: 0, max: 50, dp: 1 })
    expect(limitsFor('load')).toEqual({ min: 0, max: 300, dp: 1 })
    expect(limitsFor('load', { unit: 'lb' })).toEqual({ min: 0, max: 660, dp: 1 })
    expect(limitsFor('inc')).toEqual({ min: 0.25, max: 50, dp: 2 })
  })

  it('returns nothing for a field it does not know', () => {
    expect(limitsFor('nope')).toEqual({})
  })
})

describe('normalizeConfig', () => {
  it('clamps the shared sets field for every mode', () => {
    expect(normalizeConfig({ sets: 25 }).sets).toBe(20)
    expect(normalizeConfig({ sets: 0 }, { mode: 'time' }).sets).toBe(1)
    expect(normalizeConfig({ sets: 2.6 }, { mode: 'cardio' }).sets).toBe(3)
    // nothing entered → the mode's default, not 0
    expect(normalizeConfig({}, { mode: 'reps' }).sets).toBe(3)
    expect(normalizeConfig({}, { mode: 'time' }).sets).toBe(3)
    expect(normalizeConfig({}, { mode: 'cardio' }).sets).toBe(1)
  })

  it('normalizes a cardio config — minutes and speed, no mode key', () => {
    expect(normalizeConfig({ sets: 1, min: 20, speed: 8 }, { mode: 'cardio' }))
      .toEqual({ sets: 1, min: 20, speed: 8 })
    expect(normalizeConfig({ sets: 0, min: 0, speed: -3 }, { mode: 'cardio' }))
      .toEqual({ sets: 1, min: 1, speed: 0 })
    expect(normalizeConfig({ sets: 1, min: 900, speed: 99 }, { mode: 'cardio' }))
      .toEqual({ sets: 1, min: 600, speed: 50 })
    expect(normalizeConfig({ sets: 1, min: 20.5, speed: 8.26 }, { mode: 'cardio' }))
      .toEqual({ sets: 1, min: 21, speed: 8.3 })
    // 0 speed stays 0 — it is a valid answer, not a missing one
    expect(normalizeConfig({ sets: 1, min: 20, speed: 0 }, { mode: 'cardio' }).speed).toBe(0)
  })

  it('normalizes a time config — seconds and weight', () => {
    expect(normalizeConfig({ sets: 3, sec: 45, weight: 60 }, { mode: 'time' }))
      .toEqual({ sets: 3, mode: 'time', sec: 45, weight: 60 })
    expect(normalizeConfig({ sets: 3, sec: 0, weight: -5 }, { mode: 'time' }))
      .toEqual({ sets: 3, mode: 'time', sec: 1, weight: 0 })
    expect(normalizeConfig({ sets: 3, sec: 7200, weight: 500 }, { mode: 'time' }))
      .toEqual({ sets: 3, mode: 'time', sec: 3600, weight: 300 })
    expect(normalizeConfig({ sets: 3, sec: 90.4, weight: 62.55 }, { mode: 'time' }))
      .toEqual({ sets: 3, mode: 'time', sec: 90, weight: 62.6 })
    // nothing entered → the mode defaults
    expect(normalizeConfig({}, { mode: 'time' })).toEqual({ sets: 3, mode: 'time', sec: 45, weight: 0 })
  })

  it('normalizes a reps config — reps, weight, even per-side rounding', () => {
    expect(normalizeConfig({ sets: 3, reps: 10, weight: 60 }, { mode: 'reps' }))
      .toEqual({ sets: 3, mode: 'reps', reps: 10, weight: 60 })
    expect(normalizeConfig({ sets: 3, reps: 2.7, weight: -5 }, { mode: 'reps' }))
      .toEqual({ sets: 3, mode: 'reps', reps: 3, weight: 0 })
    expect(normalizeConfig({ sets: 3, reps: 250, weight: 500 }, { mode: 'reps' }))
      .toEqual({ sets: 3, mode: 'reps', reps: 100, weight: 300 })
    expect(normalizeConfig({}, { mode: 'reps' }))
      .toEqual({ sets: 3, mode: 'reps', reps: 10, weight: 0 })
  })

  it('rounds a per-side target up to an even total', () => {
    expect(normalizeConfig({ sets: 3, reps: 15 }, { mode: 'reps', perSide: true }))
      .toEqual({ sets: 3, mode: 'reps', reps: 16, weight: 0, side: true })
    expect(normalizeConfig({ sets: 3, reps: 2 }, { mode: 'reps', perSide: true }).reps).toBe(2)
    expect(normalizeConfig({ sets: 3, reps: 16 }, { mode: 'reps', perSide: true }).reps).toBe(16)
    // the ceiling still holds after rounding
    expect(normalizeConfig({ sets: 3, reps: 99 }, { mode: 'reps', perSide: true }).reps).toBe(100)
    expect(normalizeConfig({ sets: 3, reps: 100 }, { mode: 'reps', perSide: true }).reps).toBe(100)
  })

  it('resolves the load ceiling by unit', () => {
    expect(normalizeConfig({ sets: 3, reps: 10, weight: 350 }, { mode: 'reps' }).weight).toBe(300)
    expect(normalizeConfig({ sets: 3, reps: 10, weight: 350 }, { mode: 'reps', unit: 'lb' }).weight).toBe(350)
    expect(normalizeConfig({ sets: 3, reps: 10, weight: 700 }, { mode: 'reps', unit: 'lb' }).weight).toBe(660)
    expect(normalizeConfig({ sets: 3, sec: 45, weight: 700 }, { mode: 'time', unit: 'lb' }).weight).toBe(660)
  })

  it('includes repsMin only for a double-progression policy, never above the working reps', () => {
    expect(normalizeConfig({ sets: 3, reps: 10, repsMin: 6 }, { mode: 'reps', double: true }).repsMin).toBe(6)
    // a minimum above the working reps is pulled back down to them
    expect(normalizeConfig({ sets: 3, reps: 10, repsMin: 50 }, { mode: 'reps', double: true }).repsMin).toBe(10)
    // a typed 0 lands on the field floor; blank falls back to two below the working reps
    expect(normalizeConfig({ sets: 3, reps: 10, repsMin: 0 }, { mode: 'reps', double: true }).repsMin).toBe(1)
    expect(normalizeConfig({ sets: 3, reps: 10 }, { mode: 'reps', double: true }).repsMin).toBe(8)
    // no double policy → the key is not carried at all
    expect(normalizeConfig({ sets: 3, reps: 10, repsMin: 6 }, { mode: 'reps' }).repsMin).toBeUndefined()
    expect(normalizeConfig({ sets: 3, reps: 10, repsMin: 6 }, { mode: 'time', double: true }).repsMin).toBeUndefined()
  })

  it('lifts a bodyweight rep ceiling to at least the working reps', () => {
    expect(normalizeConfig({ sets: 3, reps: 10, weight: 0, repsMax: 5 }, { mode: 'reps', bodyweight: true }).repsMax).toBe(10)
    expect(normalizeConfig({ sets: 3, reps: 10, weight: 0, repsMax: 15 }, { mode: 'reps', bodyweight: true }).repsMax).toBe(15)
    expect(normalizeConfig({ sets: 3, reps: 10, weight: 0, repsMax: 250 }, { mode: 'reps', bodyweight: true }).repsMax).toBe(100)
  })

  it('only carries a rep ceiling when there is no load to add instead', () => {
    expect(normalizeConfig({ sets: 3, reps: 10, weight: 20, repsMax: 15 }, { mode: 'reps', bodyweight: true }).repsMax).toBeUndefined()
    expect(normalizeConfig({ sets: 3, reps: 10, weight: 0, repsMax: 15 }, { mode: 'reps', bodyweight: false }).repsMax).toBeUndefined()
    expect(normalizeConfig({ sets: 3, reps: 10, weight: 0 }, { mode: 'reps', bodyweight: true }).repsMax).toBeUndefined()
  })

  it('leaves the input object untouched', () => {
    const c = { sets: 999, reps: -1, weight: -1 }
    normalizeConfig(c, { mode: 'reps', perSide: true })
    expect(c).toEqual({ sets: 999, reps: -1, weight: -1 })
  })
})
