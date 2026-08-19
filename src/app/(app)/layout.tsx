import type { Metadata } from 'next'
import { Archivo } from 'next/font/google'
import React from 'react'

import './globals.css'

/**
 * Root layout for the operator's surfaces.
 *
 * A SIBLING of src/app/(payload)/layout.tsx, never a parent. Do not add a shared
 * src/app/layout.tsx: the separation is what keeps this world's CSS out of the
 * Payload admin panel.
 */

const archivo = Archivo({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-archivo',
  axes: [],
})

export const metadata: Metadata = {
  title: 'Sutoreido',
  description: 'Invoice archive, filed by client.',
}

/**
 * The direction contract, emitted as a real HTML comment so it survives the
 * production build and can be grepped by its seed key. Wrapped in a hidden
 * element because React can only emit comments through dangerouslySetInnerHTML.
 */
const DIRECTION_CONTRACT = `<!--
THESIS: The archive is spined by the client, not the calendar. Refuses the reverse-chronological
invoice table with coloured status pills and a top-right search box that every invoicing tool ships.
OWN-WORLD: Ink bench #101419 with calico document plates #E8E6DF; square corners throughout, radius
zero, no exceptions; Archivo with tabular figures, no monospace; hairline rules instead of cards.
Two accents with separate jobs: reserved blue #3987E5 for the active query and the open matter only,
oxblood #D75D43 for struck status marks only. Neither ever does the other's work.
STORY: He remembers work by client and by what it was. He finds it, reads it, and sends it.
FIRST VIEWPORT: Gummed client tabs down the left edge with search at their head; the open matter owns
the rest of the screen, cover sheet then docket rows, its edge running off-frame.
FORM: The matter file. Candidate 5 of 7 grounded directions; seed key da32bf5b.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
-->`

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU" className={archivo.variable}>
      <body className="min-h-screen antialiased">
        <div hidden dangerouslySetInnerHTML={{ __html: DIRECTION_CONTRACT }} />
        {children}
      </body>
    </html>
  )
}
