/** A4 in points, matching the predecessor's page setup. */
export const PAGE = { width: 595.28, height: 841.89 } as const
export const MARGIN = 36 // 0.5 inch
export const CONTENT_WIDTH = PAGE.width - MARGIN * 2 // 523.28
export const BLOCK_GAP = 26
export const CELL_PADDING = 8

/**
 * Turns column ratios into EXPLICIT point widths.
 *
 * Deliberately not flex: with flex, the header row and each body row compute
 * their own widths independently, so a long description can shift one row's
 * columns out of line with the header. Precomputing the widths once means every
 * row is laid out identically by construction.
 */
export function columnWidths(ratios: number[], totalWidth = CONTENT_WIDTH): number[] {
  const sum = ratios.reduce((a, b) => a + b, 0)
  if (sum <= 0) return ratios.map(() => totalWidth / Math.max(ratios.length, 1))
  return ratios.map((r) => (r / sum) * totalWidth)
}
