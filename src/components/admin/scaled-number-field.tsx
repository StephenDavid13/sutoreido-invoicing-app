'use client'

import { FieldLabel, useField } from '@payloadcms/ui'
import React, { useState } from 'react'

/**
 * Input component for values STORED as integer minor units but ENTERED in
 * natural units.
 *
 * Why this exists: the stored columns are integer cents and integer thousandths
 * of an hour, which is right for exactness — but the first invoice created
 * through the admin UI came out as $0.00 because the raw columns were exposed
 * directly. Typing "1" and "10" meant 0.001 units at $0.10, not 1 unit at $10.
 * Nobody should have to type 15000 to mean $150.
 *
 * So: the form shows and accepts dollars/hours, and this component writes the
 * scaled integer into form state. Everything server-side keeps working in minor
 * units, unchanged — no hook-ordering hazards, and the integer validator on the
 * field still guards the real stored value.
 */

type Props = {
  field?: { label?: unknown; required?: boolean; admin?: { description?: unknown } }
  path?: string
  readOnly?: boolean
  scale: number
  /** Max decimals to display. 2 for money, 3 for quantities. */
  precision: number
  prefix?: string
}

function formatForDisplay(stored: number | null | undefined, scale: number, precision: number) {
  if (stored === null || stored === undefined || Number.isNaN(stored)) return ''
  const natural = stored / scale
  // Money always shows 2dp; quantities drop trailing zeros so 1 stays "1".
  return precision === 2
    ? natural.toFixed(2)
    : String(Number.parseFloat(natural.toFixed(precision)))
}

export function ScaledNumberField({
  field,
  path,
  readOnly,
  scale,
  precision,
  prefix,
}: Props) {
  const { value, setValue, showError, errorMessage, disabled } = useField<number>({ path })

  // Local draft so partial input ("1.", ".5", "") is not fought by reformatting.
  const [draft, setDraft] = useState<string>(() => formatForDisplay(value, scale, precision))
  const [focused, setFocused] = useState(false)

  // Re-sync when the form loads a value or another control changes it.
  //
  // Adjusted during render rather than in an effect: this is React's documented
  // pattern for derived state, and it avoids the extra commit-then-repaint that
  // a setState-in-effect causes (which the react-hooks lint rule flags).
  const [syncedFrom, setSyncedFrom] = useState<number | null | undefined>(value)
  if (!focused && value !== syncedFrom) {
    setSyncedFrom(value)
    setDraft(formatForDisplay(value, scale, precision))
  }

  const commit = (raw: string) => {
    const cleaned = raw.replace(/[^0-9.\-]/g, '')
    if (cleaned === '' || cleaned === '-' || cleaned === '.') {
      setValue(null)
      return
    }
    const parsed = Number.parseFloat(cleaned)
    if (Number.isNaN(parsed)) {
      setValue(null)
      return
    }
    // Round at the boundary so 0.1 * 100 never lands on 10.000000000000002.
    setValue(Math.round(parsed * scale))
  }

  const isDisabled = readOnly || disabled

  return (
    <div className={`field-type number${showError ? ' error' : ''}`}>
      <FieldLabel
        label={field?.label as string | undefined}
        path={path}
        required={field?.required}
      />
      {showError && errorMessage ? <div className="field-error">{errorMessage}</div> : null}
      <div className="field-type__wrap" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {prefix ? <span style={{ opacity: 0.6 }}>{prefix}</span> : null}
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          disabled={isDisabled}
          value={draft}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false)
            setDraft(formatForDisplay(value, scale, precision))
          }}
          onChange={(event) => {
            setDraft(event.target.value)
            commit(event.target.value)
          }}
        />
      </div>
      {field?.admin?.description ? (
        <div className="field-description">{field.admin.description as string}</div>
      ) : null}
    </div>
  )
}

/** Dollars in, integer cents stored. */
export function MoneyField(props: Omit<Props, 'scale' | 'precision'>) {
  return <ScaledNumberField {...props} scale={100} precision={2} prefix="$" />
}

/** Natural units (hours, days, items) in, integer thousandths stored. */
export function QuantityField(props: Omit<Props, 'scale' | 'precision'>) {
  return <ScaledNumberField {...props} scale={1000} precision={3} />
}
