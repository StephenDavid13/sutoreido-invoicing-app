import 'server-only'

/**
 * Guarded entry point for the PDF renderer — this is what app code imports.
 *
 * The guard matters: @react-pdf/renderer is ~460kB gzipped, so accidentally
 * importing it into a client component would be a serious regression. With
 * `server-only` present that becomes a build error instead.
 */
export { renderInvoicePdf } from './render-core'
