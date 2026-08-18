/**
 * Ported from the predecessor's PdfTheme.cs so the output matches the invoices
 * Stephen's clients have already received. Every layout knob lives here, so a
 * future logo or rebrand is a one-file change.
 */
export const THEME = {
  primary: '#1F3A5F', // dark navy — document title
  tableHeaderBg: '#E5EDF7', // pale blue — header cells
  tableBodyBg: '#CBDCEE', // the fill PdfTheme.cs declared and never used
  subtle: '#666666', // page footer
  borderGrey: '#CCCCCC',
  black: '#000000',

  titleSize: 26,
  headingSize: 13,
  bodySize: 10,

  /**
   * react-pdf defaults to roughly 1.2, which sets solid blocks of text with no
   * air in them — legible on screen at 100% but cramped on paper. 1.5 for body
   * copy, slightly tighter for the big headings so they do not float apart.
   */
  lineHeightBody: 1.5,
  lineHeightHeading: 1.25,

  /** Vertical space between consecutive lines that are separate thoughts. */
  paragraphGap: 5,
  /** Space under a section heading, before its content. */
  headingGap: 7,

  /**
   * Helvetica is one of the 14 standard PDF fonts, so it needs no registration
   * and cannot lose the race between Font.register() and renderToBuffer().
   * Swapping to Lato later means registering it once at module scope in fonts.ts
   * and changing this single value.
   */
  fontFamily: 'Helvetica',
  fontFamilyBold: 'Helvetica-Bold',
} as const
