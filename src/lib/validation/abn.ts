/**
 * Australian Business Number validation.
 *
 * The ABN carries a checksum, so a typo is detectable rather than silently
 * printed on a legal document. The algorithm is the ATO's published one:
 *
 *   1. Subtract 1 from the first digit.
 *   2. Multiply each of the 11 digits by its positional weight.
 *   3. Sum the products.
 *   4. Valid if the sum is divisible by 89.
 *
 * Worked example, using the ATO's own publicly listed ABN 51 824 753 556:
 * subtract 1 from the leading 5, apply the weights, and the products sum to 623,
 * which is 89 x 7 — so the checksum passes.
 */

const WEIGHTS = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19] as const

/** Strips spaces and any other formatting, leaving digits only. */
export function normaliseAbn(input: string): string {
  return input.replace(/\D/g, '')
}

export function isValidAbn(input: string): boolean {
  const digits = normaliseAbn(input)
  if (digits.length !== 11) return false

  // A leading zero is impossible: step 1 subtracts 1 from the first digit.
  if (digits[0] === '0') return false

  const sum = digits.split('').reduce((acc, char, index) => {
    const digit = Number(char) - (index === 0 ? 1 : 0)
    return acc + digit * WEIGHTS[index]
  }, 0)

  return sum % 89 === 0
}

/** Display form: "28 911 729 962" — the ATO's 2-3-3-3 grouping. */
export function formatAbn(input: string): string {
  const digits = normaliseAbn(input)
  if (digits.length !== 11) return input
  return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 11)}`
}
