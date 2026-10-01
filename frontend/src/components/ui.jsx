// openGym control set.
//
// Every input in the app is built here rather than styled on top of a native
// widget. Native controls are the single loudest "unfinished" tell: a checkbox
// renders blue on iOS and grey on Android, a range slider paints its own white
// track that no theme reaches, and a <select> opens a system list that ignores
// dark mode entirely. Rebuilding them means one visual language and one focus
// treatment across every platform.
//
// Shared rules:
//   · every control is driven by (value, onChange) — no internal source of truth
//   · hit targets are ≥44px even when the painted control is smaller
//   · :active gives a scale/tint response so touch feels acknowledged
//   · focus-visible draws a ring; pointer interaction never does

import { useRef, useState, useEffect, useCallback, forwardRef } from 'react'
import Icon from './Icon.jsx'
import { clampNum, clampInt, toNumber } from '../lib/validation.js'

/* ============================ text ============================ */

// Numeric input accepting "," as decimal separator — iOS decimal keypads in many
// locales only offer a comma, and type="number" reports "" for it (value snaps to
// 0). Keeps a local string draft while focused so partial input like "33," survives.
// `nullable` is for fields where "nothing entered" and 0 mean different things (RIR: a
// logged 0 is a set taken to failure). Those clear back to null instead of snapping to 0.
//
// `min`/`max`/`int`/`dp` bound the field via lib/validation.js. While typing only the
// ceiling is enforced — clamping up on the first keystroke of "10" would turn the "1" into
// the floor and fight the keyboard (the rule capEffort set). The floor lands on blur, so a
// typed "-5" snaps to the field's minimum instead of being read as positive, and a cleared
// reps/sets/min/sec field re-commits to its last valid value or its floor — never 0.
export function NumberField({ value, onChange, decimal = true, nullable = false, min = 0, max, int = false, dp, className = '', ...rest }) {
  const [draft, setDraft] = useState(null)
  const committed = useRef(null)
  const isInt = int || decimal === false
  // null and undefined are the same "empty" here — a nullable field's key is dropped once cleared.
  if (draft !== null && (committed.current ?? null) !== (value ?? null)) { setDraft(null); committed.current = null }
  // what the field should hold once it settles: the full bounds, with the last valid
  // value (or the floor) standing in for anything unusable
  const settle = n => isInt
    ? clampInt(n, { min, max })
    : clampNum(n, { min, max, dp })
  // while typing, cap the ceiling and round the step — but never floor
  const cap = n => isInt
    ? clampInt(n, { max })
    : clampNum(n, { max, dp })
  const lastValid = () => committed.current ?? toNumber(value) ?? min ?? 0
  const commit = raw => {
    // keep a single leading minus and dot, so "-5" and "-.5" can be read as negative at all
    let s = String(raw).replace(/,/g, '.').replace(/[^0-9.-]/g, '')
    s = s.startsWith('-') ? '-' + s.slice(1).replace(/-/g, '') : s.replace(/-/g, '')
    const i = s.indexOf('.')
    if (i !== -1) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, '')
    const n = toNumber(s)
    if (n === null) {
      // a lone sign or dot is a number still being typed, not an emptied field
      if (!nullable && (s === '-' || s === '-.')) { setDraft(s); return }
      if (nullable) { committed.current = null; setDraft(s); onChange(null); return }
      // blank or unusable: re-commit the last valid value, or the field minimum — not 0
      const f = settle(lastValid())
      committed.current = f
      setDraft(null)
      onChange(f)
      return
    }
    const v = cap(n)
    committed.current = v
    setDraft(s)
    onChange(v)
  }
  const onBlur = () => {
    if (draft !== null) {
      const n = toNumber(draft)
      if (n !== null) {
        const f = settle(n)
        if (f !== committed.current) { committed.current = f; onChange(f) }
      } else if (!nullable) {
        const f = settle(lastValid())
        if (f !== committed.current) { committed.current = f; onChange(f) }
      }
    }
    setDraft(null)
    committed.current = null
  }
  return (
    <input
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      className={'num ' + className}
      value={draft ?? (value ?? '')}
      onFocus={e => e.target.select()}
      onChange={e => commit(e.target.value)}
      onBlur={onBlur}
      {...rest}
    />
  )
}

// forwardRef so callers can focus it or read its value imperatively
export const TextField = forwardRef(function TextField({ className = '', ...rest }, ref) {
  return <input ref={ref} className={'field ' + className} {...rest} />
})

export function TextArea({ className = '', ...rest }) {
  return <textarea className={'field area ' + className} {...rest} />
}

export function SearchField({ value, onChange, onClear, ...rest }) {
  return (
    <div className="searchf">
      <Icon name="magnifier" className="lead" />
      <input className="field" value={value} onChange={onChange} {...rest} />
      {!!value && (
        <button className="clear" onClick={onClear} aria-label="Clear">
          <Icon name="xmark" />
        </button>
      )}
    </div>
  )
}

/* ============================ switch ============================ */

export function Switch({ checked, onChange, disabled }) {
  return (
    <button
      role="switch"
      aria-checked={!!checked}
      disabled={disabled}
      className={'sw' + (checked ? ' on' : '')}
      onClick={() => onChange(!checked)}
    >
      <span className="knob" />
    </button>
  )
}

/* ============================ segmented ============================ */

// options: [{ value, label, icon? }]  — the selected pill slides between cells.
export function Segmented({ options, value, onChange, className = '' }) {
  const i = Math.max(0, options.findIndex(o => o.value === value))
  return (
    <div className={'seg ' + className} style={{ '--n': options.length, '--i': i }}>
      <span className="seg-sel" aria-hidden="true" />
      {options.map(o => (
        <button
          key={o.value}
          className={o.value === value ? 'on' : ''}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.icon && <Icon name={o.icon} />}
          {o.label && <span>{o.label}</span>}
        </button>
      ))}
    </div>
  )
}

/* ============================ stepper ============================ */

// One tap of +/- resolves against the same limits the field enforces, so the buttons can
// never walk the value past a bound the number itself would be clamped to.
export function Stepper({ value, step = 1, onChange, decimal = true, className = '', label, unit, min = 0, max, int = false, dp }) {
  const isInt = int || decimal === false
  const set = v => onChange(isInt
    ? clampInt(v, { min, max, fallback: min })
    : clampNum(v, { min, max, dp, fallback: min }))
  const inner = (
    <div className={'stp ' + className}>
      <button onClick={() => set((+value || 0) - step)} aria-label="Decrease"><Icon name="minus" /></button>
      <span className="val">
        <NumberField value={value} decimal={decimal} min={min} max={max} int={isInt} dp={dp} onChange={onChange} />
        {unit && <i>{unit}</i>}
      </span>
      <button onClick={() => set((+value || 0) + step)} aria-label="Increase"><Icon name="plus" /></button>
    </div>
  )
  if (!label) return inner
  return <div className="stp-w"><span className="stp-l">{label}</span>{inner}</div>
}

/* ============================ slider ============================ */

// Pointer-driven so the fill, track and thumb are all ours — no ::-webkit-*
// pseudo-elements, which is the only way the control looks identical on every
// platform and can pick up the accent colour.
export function Slider({ value, min = 0, max = 100, step = 1, onChange, className = '' }) {
  const ref = useRef(null)
  const [drag, setDrag] = useState(false)
  const pct = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))

  const posToValue = useCallback(clientX => {
    const el = ref.current
    if (!el) return value
    const r = el.getBoundingClientRect()
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
    const raw = min + f * (max - min)
    const snapped = Math.round(raw / step) * step
    // step can be fractional (0.1) — round away binary noise
    return Math.min(max, Math.max(min, Math.round(snapped * 1000) / 1000))
  }, [min, max, step, value])

  useEffect(() => {
    if (!drag) return
    const move = e => {
      e.preventDefault()
      onChange(posToValue(e.touches ? e.touches[0].clientX : e.clientX))
    }
    const up = () => setDrag(false)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [drag, onChange, posToValue])

  const key = e => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? step
      : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -step : 0
    if (!d) return
    e.preventDefault()
    onChange(Math.min(max, Math.max(min, Math.round((value + d) * 1000) / 1000)))
  }

  return (
    <div
      ref={ref}
      className={'sld' + (drag ? ' dragging' : '') + ' ' + className}
      role="slider"
      tabIndex={0}
      aria-valuenow={value} aria-valuemin={min} aria-valuemax={max}
      data-nodrag                                  /* keeps the sheet from swipe-dismissing */
      onKeyDown={key}
      onPointerDown={e => { e.currentTarget.setPointerCapture?.(e.pointerId); setDrag(true); onChange(posToValue(e.clientX)) }}
    >
      <span className="sld-track"><span className="sld-fill" style={{ width: pct + '%' }} /></span>
      <span className="sld-knob" style={{ left: pct + '%' }} />
    </div>
  )
}

/* ============================ checkbox ============================ */

export function Check({ checked, onChange, className = '', size }) {
  return (
    <button
      role="checkbox"
      aria-checked={!!checked}
      className={'chk' + (checked ? ' on' : '') + ' ' + className}
      style={size ? { width: size, height: size } : null}
      onClick={() => onChange(!checked)}
    >
      <Icon name="check" />
    </button>
  )
}

/* ============================ grouped list ============================ */

// The inset-grouped list is the app's main structural primitive: a titled
// section holding rows separated by hairlines that stop short of the leading
// edge, so the icon column reads as a continuous rail.
export function Section({ title, footer, children, className = '' }) {
  return (
    <section className={'sect ' + className}>
      {title && <h2 className="sect-t">{title}</h2>}
      <div className="sect-b">{children}</div>
      {footer && <p className="sect-f">{footer}</p>}
    </section>
  )
}

export function Row({ icon, iconTint, title, subtitle, value, accessory = 'none', onClick, danger, children, className = '' }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag className={'lrow' + (onClick ? ' tap' : '') + (danger ? ' danger' : '') + ' ' + className} onClick={onClick}>
      {icon && <span className="lrow-i" style={iconTint ? { '--tint': iconTint } : null}><Icon name={icon} /></span>}
      <span className="lrow-m">
        <span className="lrow-t">{title}</span>
        {subtitle && <span className="lrow-s">{subtitle}</span>}
      </span>
      {children}
      {value != null && <span className="lrow-v">{value}</span>}
      {accessory === 'chevron' && <Icon name="chevronRight" className="lrow-c" />}
      {accessory === 'check' && <Icon name="check" className="lrow-k" />}
    </Tag>
  )
}

/* ============================ picker ============================ */

// Replaces <select>. A native select opens a system list that ignores the app's
// theme entirely — on dark mode it flashes a white sheet — and can't show more
// than a bare label per option. This opens our own sheet with a checkmark on the
// current value, which is also how iOS itself handles a long option list.
export function SelectRow({ icon, iconTint, title, value, options, onChange, sheetTitle }) {
  const cur = options.find(o => o.value === value)
  const open = () => {
    const { openSheet } = require_ui()
    const h = openSheet(close => (
      <>
        <h3>{sheetTitle || title}</h3>
        <div className="sect-b">
          {options.map(o => (
            <button key={o.value} className="lrow tap" onClick={() => { close(); onChange(o.value) }}>
              <span className="lrow-m"><span className="lrow-t">{o.label}</span>
                {o.subtitle && <span className="lrow-s">{o.subtitle}</span>}</span>
              {o.value === value && <Icon name="check" className="lrow-k" />}
            </button>
          ))}
        </div>
        <div style={{ height: 8 }} />
      </>
    ))
    return h
  }
  return (
    <Row icon={icon} iconTint={iconTint} title={title} value={cur ? cur.label : value} accessory="chevron" onClick={open} />
  )
}

// Late import keeps this module free of a cycle at load time (useUI pulls in the
// store, which pulls in helpers that import controls).
let _ui = null
export function bindUI(store) { _ui = store }
function require_ui() {
  if (!_ui) throw new Error('ui store not bound — call bindUI(useUI) once at boot')
  return _ui.getState()
}

/* ============================ buttons ============================ */

export function Button({ variant = 'plain', size, icon, trailingIcon, children, className = '', ...rest }) {
  return (
    <button className={`btn ${variant}${size ? ' ' + size : ''} ${className}`} {...rest}>
      {icon && <Icon name={icon} />}
      {children && <span>{children}</span>}
      {trailingIcon && <Icon name={trailingIcon} />}
    </button>
  )
}
