// Numeric limits and clamping for every typed workout field.
//
// All numeric entry funnels through NumberField/Stepper (components/ui.jsx), and the one
// thing that pipeline could not do was say no: a typed "-5" lost its sign to a regex and
// landed as +5, "2.7" into an integer field was silently cut to 2, and no field had a
// ceiling. This module is the single place that answers "what is a valid number here".
//
// Two rules keep clamping from fighting the keyboard:
//   · while typing, only the ceiling is applied — clamping UP on the first keystroke of
//     "10" would turn the "1" into the floor (the same reasoning capEffort follows in
//     history.js)
//   · the floor is applied when the field settles (blur/commit), so "-5" becomes the
//     field's minimum instead of being read as 5, and a cleared field lands on its last
//     valid value or its floor — never on 0
//
// Pure and dependency-free, so the rules are testable without a DOM.

// Per-field bounds. `int` fields reject fractions by rounding; decimal fields round to
// `dp` places. `load` carries the one unit-dependent ceiling in the app: the screens are
// metric-first, but a pound profile reaches the same physical range (300 kg ≈ 660 lb).
export const LIMITS = {
  sets: { min: 1, max: 20, int: true },
  reps: { min: 1, max: 100, int: true },
  repsMin: { min: 1, max: 100, int: true },
  repsMax: { min: 1, max: 100, int: true },
  sec: { min: 1, max: 3600, int: true },
  min: { min: 1, max: 600, int: true },
  speed: { min: 0, max: 50, dp: 1 },
  load: { min: 0, max: 300, dp: 1, lbMax: 660 },   // kg max, or lb when the profile is in pounds
  inc: { min: 0.25, max: 50, dp: 2 }
}

// Anything the app can hand us → a finite Number, or null for "not a number".
// Strings may use "," as the decimal separator, matching what NumberField commits.
export function toNumber(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v !== 'string') return null
  const s = v.trim().replace(',', '.')
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

const roundDp = (n, dp) => Math.round(n * 10 ** dp) / 10 ** dp

// Clamp a decimal value. A blank, non-numeric or non-finite input yields `fallback`
// (which is itself normalized, so a bad fallback cannot smuggle a value out of range);
// with no fallback it yields null, for callers that treat "nothing" as its own answer.
export function clampNum(v, { min, max, dp, fallback } = {}) {
  let n = toNumber(v)
  if (n === null) n = toNumber(fallback)
  if (n === null) return null
  if (dp != null) n = roundDp(n, dp)
  if (min != null) n = Math.max(min, n)
  if (max != null) n = Math.min(max, n)
  return n
}

// The integer flavour of clampNum: a fraction rounds to the nearest whole number rather
// than being truncated, so a pasted "2.7" reads as 3 instead of silently becoming 2.
export function clampInt(v, { min, max, fallback } = {}) {
  let n = toNumber(v)
  if (n === null) n = toNumber(fallback)
  if (n === null) return null
  n = Math.round(n)
  if (min != null) n = Math.max(min, n)
  if (max != null) n = Math.min(max, n)
  return n
}

// Clamp by field name against LIMITS, resolving the pound ceiling for load.
// An unknown field passes through untouched — this validates the fields it knows.
export function clampField(field, v, { unit, fallback } = {}) {
  const L = LIMITS[field]
  if (!L) return v
  const max = field === 'load' && unit === 'lb' && L.lbMax != null ? L.lbMax : L.max
  return L.int
    ? clampInt(v, { min: L.min, max, fallback })
    : clampNum(v, { min: L.min, max, dp: L.dp, fallback })
}

// The bounds as props for a NumberField/Stepper — { min, max, int } or { min, max, dp }.
export function limitsFor(field, { unit } = {}) {
  const L = LIMITS[field]
  if (!L) return {}
  const max = field === 'load' && unit === 'lb' && L.lbMax != null ? L.lbMax : L.max
  return L.int ? { min: L.min, max, int: true } : { min: L.min, max, dp: L.dp }
}

// Save-time normalization for an exercise config (what ExConfig used to do inline).
// Produces the mode's payload with every number clamped; `bodyweight` is the effective
// flag (it decides whether a rep ceiling applies), `double` carries the progression
// policy's "include repsMin" bit, and `unit` resolves the load ceiling.
export function normalizeConfig(c, { mode = 'reps', perSide = false, bodyweight = false, double = false, unit } = {}) {
  const src = c || {}
  const out = { sets: clampField('sets', src.sets, { fallback: mode === 'cardio' ? 1 : 3 }) }

  if (mode === 'cardio') {
    out.min = clampField('min', src.min, { fallback: 20 })
    out.speed = clampField('speed', src.speed, { fallback: 8 })
    return out
  }
  out.mode = mode

  if (mode === 'time') {
    out.sec = clampField('sec', src.sec, { fallback: 45 })
    out.weight = clampField('load', src.weight, { unit, fallback: 0 })
    return out
  }

  // reps mode. A per-side target is rounded up to an even number: the split has to
  // divide, and a typed 15 would otherwise plan seven reps on one side and eight on the
  // other, every session.
  const typed = clampField('reps', src.reps, { fallback: 10 })
  out.reps = perSide ? Math.ceil(typed / 2) * 2 : typed
  out.weight = clampField('load', src.weight, { unit, fallback: 0 })
  if (perSide) out.side = true
  if (double) out.repsMin = Math.min(out.reps, clampField('repsMin', src.repsMin, { fallback: Math.max(1, out.reps - 2) }))
  // A rep ceiling only means something when there is no load to add instead, and a
  // ceiling below the working reps would tell you to add a set on day one.
  if (bodyweight && !(out.weight > 0) && src.repsMax > 0) {
    out.repsMax = Math.max(out.reps, clampField('repsMax', src.repsMax, { fallback: 1 }))
  }
  return out
}
