import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import React from 'react'

/**
 * The shell every message shares.
 *
 * Deliberately plain: an invoice email is a covering note, not a campaign. It
 * carries the same square, hairline-ruled restraint as the document it attaches,
 * with inline styles because email clients strip stylesheets.
 */

export const ink = '#14171b'
export const inkSoft = '#5b5f66'
export const rule = '#d9d6cd'
export const plate = '#ffffff'

export function EmailShell({
  preview,
  children,
  footer,
}: {
  preview: string
  children: React.ReactNode
  footer?: string | null
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: '#f4f2ec',
          margin: 0,
          padding: '32px 0',
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
          color: ink,
        }}
      >
        <Container
          style={{
            backgroundColor: plate,
            maxWidth: '560px',
            margin: '0 auto',
            padding: '32px',
            border: `1px solid ${rule}`,
          }}
        >
          {children}
          {footer ? (
            <>
              <Hr style={{ borderColor: rule, margin: '28px 0 16px' }} />
              <Section>
                <Text style={{ fontSize: '12px', lineHeight: '18px', color: inkSoft, margin: 0 }}>
                  {footer}
                </Text>
              </Section>
            </>
          ) : null}
        </Container>
      </Body>
    </Html>
  )
}

export const heading: React.CSSProperties = {
  fontSize: '20px',
  lineHeight: '26px',
  fontWeight: 600,
  letterSpacing: '-0.01em',
  margin: '0 0 16px',
}

export const paragraph: React.CSSProperties = {
  fontSize: '15px',
  lineHeight: '24px',
  margin: '0 0 14px',
}

export const figureRow: React.CSSProperties = {
  fontSize: '15px',
  lineHeight: '24px',
  margin: '0 0 6px',
}
