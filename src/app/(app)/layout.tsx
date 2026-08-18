import type { Metadata } from 'next'
import React from 'react'

import './globals.css'

/**
 * Root layout for the custom application UI.
 *
 * This is a SIBLING of src/app/(payload)/layout.tsx, not a parent. Do not add a
 * shared src/app/layout.tsx — the separation is what keeps Tailwind out of the
 * admin panel.
 */
export const metadata: Metadata = {
  title: 'Sutoreido',
  description: 'Invoicing, quoting and project management.',
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU" suppressHydrationWarning>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  )
}
