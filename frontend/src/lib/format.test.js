import { describe, it, expect, afterAll, vi } from 'vitest'

// The bug this suite guards against only exists west of Greenwich: `new Date('YYYY-MM-DD')`
// parses a day key at UTC midnight, which is the previous *day* in UTC-negative zones. The
// app's launch market is El Salvador (UTC-6), so pin that zone before the date helpers are
// imported — without a UTC-negative TZ these assertions cannot tell the two parses apart.
const ORIG_TZ = process.env.TZ
process.env.TZ = 'America/El_Salvador'
const { todayISO, isoOf, fromISO, fmtDate, weekKey } = await import('./format.js')

afterAll(() => {
  if (ORIG_TZ === undefined) delete process.env.TZ
  else process.env.TZ = ORIG_TZ
})

describe('date helpers (America/El_Salvador)', () => {
  it('fromISO parses a day key at local noon, not UTC midnight', () => {
    const d = fromISO('2026-09-01')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(8)
    expect(d.getDate()).toBe(1)
    expect(d.getHours()).toBe(12)
    // the trap itself: the bare-date parse lands on the evening of Aug 31 here
    expect(new Date('2026-09-01').getDate()).toBe(31)
  })

  it('round-trips every day of a year through the key format', () => {
    for (let i = 0; i < 365; i++) {
      const d = new Date(2026, 0, 1 + i)
      const key = isoOf(d)
      expect(isoOf(fromISO(key))).toBe(key)
    }
  })

  it('todayISO reports the local day, not the UTC one', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      // 23:30 on Sep 1 in El Salvador is already Sep 2 in UTC
      vi.setSystemTime(new Date('2026-09-01T23:30:00-06:00'))
      expect(todayISO()).toBe('2026-09-01')
      // just after local midnight is the same UTC day — the key must not jump forward
      vi.setSystemTime(new Date('2026-09-01T00:30:00-06:00'))
      expect(todayISO()).toBe('2026-09-01')
    } finally {
      vi.useRealTimers()
    }
  })

  it('isoOf builds the key from local date parts', () => {
    // 23:30 local on the 1st is the 2nd at UTC — the key stays on the 1st
    expect(isoOf(new Date('2026-09-01T23:30:00-06:00'))).toBe('2026-09-01')
    expect(isoOf(new Date(2026, 8, 1))).toBe('2026-09-01')
    expect(isoOf(new Date(2026, 0, 9))).toBe('2026-01-09')   // zero padding
  })

  it('fmtDate renders the day the key names', () => {
    const short = fromISO('2026-09-01').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    const long = fromISO('2026-09-01').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    expect(fmtDate('2026-09-01')).toBe(short)
    expect(fmtDate('2026-09-01', true)).toBe(long)
    expect(fmtDate('2026-09-01')).not.toContain('31')        // the pre-fix read: 31 Aug
  })

  it('a calendar seeded with a tapped day opens that month', () => {
    // mirrors the seed in sheets.jsx Calendar: parse the day key, then move to the 1st
    const cur = fromISO('2026-09-01')
    cur.setDate(1)
    expect(cur.getMonth()).toBe(8)
    expect(cur.getFullYear()).toBe(2026)
  })

  it('weekKey keeps a calendar week together across its days', () => {
    // 2026-08-31 (Mon) – 2026-09-06 (Sun) is ISO week 36 of 2026
    expect(weekKey('2026-08-31')).toBe('2026-36')
    expect(weekKey('2026-09-01')).toBe('2026-36')
    expect(weekKey('2026-09-06')).toBe('2026-36')
    expect(weekKey('2026-09-07')).toBe('2026-37')
    // a week straddling New Year belongs to the year its Thursday falls in
    expect(weekKey('2025-12-29')).toBe('2026-1')
    expect(weekKey('2026-01-01')).toBe('2026-1')
  })
})
