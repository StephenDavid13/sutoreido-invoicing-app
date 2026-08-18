import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
// `Style` is not re-exported from @react-pdf/renderer (it uses `export =`), so
// it comes from the types package that renderer pins.
import type { Style } from '@react-pdf/types'
import React from 'react'

import { BLOCK_GAP, CELL_PADDING, columnWidths, CONTENT_WIDTH, MARGIN } from '../layout'
import type { InvoicePdfModel, PdfLineItem, PdfPartyInfo } from '../model'
import { THEME } from '../theme'

const s = StyleSheet.create({
  page: {
    paddingTop: MARGIN,
    paddingBottom: MARGIN,
    paddingHorizontal: MARGIN,
    fontFamily: THEME.fontFamily,
    fontSize: THEME.bodySize,
    lineHeight: THEME.lineHeightBody,
    color: THEME.black,
  },
  /** Only reserved when there is actually a footer to sit in it. */
  pageWithFooter: { paddingBottom: MARGIN + 20 },

  header: { alignItems: 'flex-end' },
  title: {
    fontFamily: THEME.fontFamilyBold,
    fontSize: THEME.titleSize,
    lineHeight: THEME.lineHeightHeading,
    color: THEME.primary,
    marginBottom: 6,
  },
  bold: { fontFamily: THEME.fontFamilyBold },

  content: { paddingTop: BLOCK_GAP },
  block: { marginBottom: BLOCK_GAP },

  partyRow: { flexDirection: 'row' },
  partyCol: { width: CONTENT_WIDTH / 2, paddingRight: 12 },
  partyHeading: { fontFamily: THEME.fontFamilyBold, marginBottom: 4 },

  row: { flexDirection: 'row' },
  headerCell: {
    backgroundColor: THEME.tableHeaderBg,
    padding: CELL_PADDING,
    fontFamily: THEME.fontFamilyBold,
  },
  bodyCell: { padding: CELL_PADDING },

  totalsBlock: { alignItems: 'flex-end' },
  totalsRow: { marginBottom: 3 },
  amountDue: {
    fontFamily: THEME.fontFamilyBold,
    fontSize: THEME.headingSize,
    lineHeight: THEME.lineHeightHeading,
    marginTop: 6,
  },

  sectionHeading: { fontFamily: THEME.fontFamilyBold, marginBottom: THEME.headingGap },

  footer: {
    position: 'absolute',
    bottom: MARGIN / 2,
    left: MARGIN,
    right: MARGIN,
    textAlign: 'center',
    color: THEME.subtle,
    fontSize: THEME.bodySize,
  },
})

/**
 * Renders a multi-line string as one <Text> per line.
 *
 * `lineGap` separates lines that are distinct thoughts — the numbered terms
 * clauses, for instance, which otherwise read as one dense paragraph. Address
 * blocks pass no gap, because there the lines belong together.
 */
function Lines({
  text,
  style,
  lineGap = 0,
}: {
  text: string
  style?: Style | Style[]
  lineGap?: number
}) {
  const lines = text.split('\n')
  return (
    <>
      {lines.map((line, i) => (
        <Text
          key={i}
          style={[
            ...(Array.isArray(style) ? style : style ? [style] : []),
            i < lines.length - 1 ? { marginBottom: lineGap } : {},
          ]}
        >
          {line || ' '}
        </Text>
      ))}
    </>
  )
}

function Party({ heading, party }: { heading: string; party: PdfPartyInfo }) {
  return (
    <View style={s.partyCol}>
      <Text style={s.partyHeading}>{heading}</Text>
      <Text>{party.name}</Text>
      {party.abn ? <Text>{`ABN: ${party.abn}`}</Text> : null}
      {party.email ? <Text>{`Email: ${party.email}`}</Text> : null}
      {party.address ? <Lines text={party.address} /> : null}
      {party.bankDetails ? <Lines text={party.bankDetails} /> : null}
    </View>
  )
}

function ItemsTable({ model }: { model: InvoicePdfModel }) {
  const widths = columnWidths(model.columns.map((c) => c.ratio))
  const { gridBorders, shadeBodyRows, boldDescription } = model.tableStyle

  const cellBorder = (index: number, isHeader: boolean) => ({
    borderBottomWidth: isHeader ? 1 : 0.5,
    borderBottomColor: THEME.borderGrey,
    ...(gridBorders
      ? {
          borderRightWidth: 0.5,
          borderRightColor: THEME.borderGrey,
          borderTopWidth: isHeader ? 0.5 : 0,
          borderTopColor: THEME.borderGrey,
          ...(index === 0
            ? { borderLeftWidth: 0.5, borderLeftColor: THEME.borderGrey }
            : {}),
        }
      : {}),
  })

  const valueFor = (item: PdfLineItem, key: string) =>
    key === 'description'
      ? item.description
      : key === 'quantity'
        ? item.quantityLabel
        : key === 'unitPrice'
          ? item.unitPriceLabel
          : item.lineTotalLabel

  return (
    <View>
      <View style={s.row}>
        {model.columns.map((col, i) => (
          <View key={col.key} style={[s.headerCell, { width: widths[i] }, cellBorder(i, true)]}>
            <Text style={{ textAlign: col.align }}>{col.label}</Text>
          </View>
        ))}
      </View>

      {model.items.map((item, rowIndex) => (
        <View key={rowIndex} style={s.row} wrap={false}>
          {model.columns.map((col, i) => (
            <View
              key={col.key}
              style={[
                s.bodyCell,
                { width: widths[i] },
                shadeBodyRows ? { backgroundColor: THEME.tableBodyBg } : {},
                cellBorder(i, false),
              ]}
            >
              <Text
                style={[
                  { textAlign: col.align },
                  boldDescription && col.key === 'description' ? s.bold : {},
                ]}
              >
                {valueFor(item, col.key)}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}

export function InvoiceDocument({ model }: { model: InvoicePdfModel }) {
  return (
    <Document title={model.headingLabel} author={model.payableTo.name}>
      <Page size="A4" style={[s.page, model.footerLine ? s.pageWithFooter : {}]}>
        {/* Repeats on every page, right-aligned, as the predecessor did. */}
        <View style={s.header} fixed>
          <Text style={s.title}>{model.headingLabel}</Text>
          <Text>
            <Text style={s.bold}>Issued: </Text>
            {model.issuedLabel}
          </Text>
          <Text>
            <Text style={s.bold}>Due: </Text>
            {model.dueLabel}
          </Text>
        </View>

        <View style={s.content}>
          <View style={[s.block, s.partyRow]}>
            <Party heading="BILL TO:" party={model.billTo} />
            <Party heading="PAYABLE TO:" party={model.payableTo} />
          </View>

          <View style={s.block}>
            <ItemsTable model={model} />
          </View>

          <View style={[s.block, s.totalsBlock]}>
            {model.showSubtotal ? (
              <Text style={s.totalsRow}>
                <Text style={s.bold}>SUBTOTAL: </Text>
                {model.subtotalLabel}
              </Text>
            ) : null}
            {model.discountLabel ? (
              <Text style={s.totalsRow}>
                <Text style={s.bold}>DISCOUNT: </Text>
                {model.discountLabel}
              </Text>
            ) : null}
            {/* Absent entirely when not GST-registered — a TAX $0.00 row would
                imply GST was charged, which the ATO treats as misleading. */}
            {model.taxLine ? (
              <Text style={s.totalsRow}>
                <Text style={s.bold}>{`${model.taxLine.label}: `}</Text>
                {model.taxLine.amountLabel}
              </Text>
            ) : null}
            <Text style={s.amountDue}>
              <Text style={s.amountDue}>AMOUNT DUE: </Text>
              {model.totalLabel}
            </Text>
          </View>

          {model.notes ? (
            <View style={s.block}>
              <Text style={s.sectionHeading}>Notes</Text>
              <Lines text={model.notes} lineGap={THEME.paragraphGap} />
            </View>
          ) : null}

          {model.terms ? (
            <View style={s.block}>
              <Text style={s.sectionHeading}>Terms &amp; Conditions</Text>
              {/* Each numbered clause gets its own breathing room. */}
              <Lines text={model.terms} lineGap={THEME.paragraphGap} />
            </View>
          ) : null}

          {/* In the content flow, left-aligned — a different element from any
              centred page footer. */}
          {model.closingLine ? (
            <View style={s.block}>
              <Lines text={model.closingLine} lineGap={THEME.paragraphGap} />
            </View>
          ) : null}
        </View>

        {/* Optional. Empty by default: the closing line above already thanks the
            client, and repeating it at the foot of the page read as duplication. */}
        {model.footerLine ? (
          <Text style={s.footer} fixed>
            {model.footerLine}
          </Text>
        ) : null}
      </Page>
    </Document>
  )
}
