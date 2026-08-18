import type { NumberField } from 'payload'

/**
 * Money and quantity fields.
 *
 * Storage is integer minor units — cents, and thousandths for quantities — so
 * arithmetic is exact and never touches a float. But the ADMIN UI must not
 * expose those raw integers: the first invoice created through the panel came
 * out as $0.00 because "1" and "10" were read as 0.001 units at $0.10.
 *
 * So each field renders a custom input that accepts dollars/hours and writes the
 * scaled integer into form state. The integer validator below still guards the
 * real stored value, and every server-side hook keeps working in minor units.
 */

const MONEY_COMPONENT = '/components/admin/scaled-number-field#MoneyField'
const QUANTITY_COMPONENT = '/components/admin/scaled-number-field#QuantityField'

type CentsFieldArgs = {
  name: string
  label?: string
  /** Totals are hook-authoritative; any client-supplied value is discarded. */
  readOnly?: boolean
  required?: boolean
  min?: number
  description?: string
  admin?: Partial<NumberField['admin']>
}

/**
 * Integer cents. Always name the field with a `Cents` suffix so a cents value
 * can never be mistaken for dollars at a call site.
 */
export function centsField({
  name,
  label,
  readOnly = false,
  required = false,
  min = 0,
  description,
  admin = {},
}: CentsFieldArgs): NumberField {
  return {
    name,
    type: 'number',
    label,
    required,
    min,
    validate: (value: number | null | undefined) => {
      if (value === null || value === undefined) return true
      if (!Number.isInteger(value)) return 'Enter an amount with at most 2 decimal places.'
      return true
    },
    admin: {
      readOnly,
      description,
      components: { Field: MONEY_COMPONENT },
      ...admin,
    },
  }
}

type QuantityFieldArgs = {
  name: string
  label?: string
  required?: boolean
  description?: string
}

/**
 * Integer thousandths, so 7.5 hours is exact. Fractional hours are the norm in
 * time-based billing, so a whole-number quantity would not survive contact with
 * a real workflow.
 */
export function quantityMilliField({
  name,
  label,
  required = false,
  description,
}: QuantityFieldArgs): NumberField {
  return {
    name,
    type: 'number',
    label,
    required,
    min: 0,
    validate: (value: number | null | undefined) => {
      if (value === null || value === undefined) return true
      if (!Number.isInteger(value)) return 'Enter a quantity with at most 3 decimal places.'
      return true
    },
    admin: {
      description,
      components: { Field: QUANTITY_COMPONENT },
    },
  }
}
