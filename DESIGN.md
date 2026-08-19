# Design

The visual world for the operator's surfaces. Written from the built result, not
ahead of it. Product truth lives in [PRODUCT.md](PRODUCT.md); this file owns
durable visual decisions only.

Scope: everything under `src/app/(app)/`. The Payload admin at `/admin` is a
separate root layout with its own vendor identity and is deliberately untouched by
this world — see the note at the end.

## The world: The Matter File

The record-keeping of an independent professional practice. A **matter** is opened
per client, and every invoice is a **filing** inside it with a fixed reference and
a readable state. The archive is spined by the client, not the calendar.

What it refuses: the reverse-chronological invoice table with coloured status
pills, a date-range filter, and a search box in the top right. That is what every
invoicing tool ships, and it organises by a key the operator does not think in.

Chosen from seven grounded candidates by the direction roll, seed key `da32bf5b`,
assigned index 5. The full direction contract is emitted as an HTML comment at the
top of `<body>` in `src/app/(app)/layout.tsx`, so it survives the production build
and can be grepped by that seed key.

## Surfaces and their materials

The bench is dark because of the use scene: one person, at a desk, in the evening,
once a month. The documents resting on it are pale, because that is what a document
is. This is material logic, not a theme flip — and it means the page a client opens
from a share link is a white sheet.

| Surface | Ground | Used for |
|---|---|---|
| The bench | `--bench #101419` | the archive, the rail, the docket |
| A raised course | `--bench-course #161b21` | hover, skeleton fills |
| A document plate | `--plate #e8e6df` | `/i/[token]`, the open tab's inversion |

## Colour

Two accents, and **neither may ever do the other's job.** This separation is the
world's central rule; breaking it was the single largest finding of the finish
review.

| Token | Value | Job |
|---|---|---|
| `--reserved` | `#3987e5` | the active query, and the rule marking the open matter. Nothing else. Never status, never links. |
| `--stamp` | `#d75d43` | struck status marks, and only where the state needs acting on. Never money, never a container. |

Ink steps are tinted from the bench hue rather than neutral grey, and every step
was measured against the harder of its two grounds rather than eyeballed:

| Token | Value | Contrast | Use |
|---|---|---|---|
| `--ink` | `#e8e6df` | 14.80:1 | primary |
| `--ink-2` | `#9aa6b4` | 7.47:1 | secondary, quiet state marks |
| `--ink-3` | `#788493` | 4.55:1 | meta. Raised from `#6c7784` (4.06:1) after measuring. |
| `--plate-ink` | `#14171b` | 14.40:1 | document body |
| `--plate-ink-2` | `#686764` | 4.53:1 | document secondary. Replaced a `plate-ink/60` composite at 4.35:1. |
| `--plate-stamp` | `#aa4935` | 4.53:1 | overdue on the plate. Replaced `--stamp` at 3.04:1. |

**The plate needs its own values.** Ink measured against the bench does not carry
to the document; both plate tokens above exist because the first contrast pass
covered only the dark grounds.

### Data colour

The aging ramp is an **ordinal** scale in one hue, not four categorical colours,
because the buckets are ordered. Steps `--age-1`…`--age-4` = `#184f95 · #256abf ·
#3987e5 · #86b6ef`, validated with the ordinal check against this app's real
surfaces in both modes.

Two standing rules for any figure in this product:

- **Never sum across currencies.** Aging is grouped by currency and rendered as one
  set of courses per currency. An AUD and an NZD balance have no common total
  without a recorded rate, and no rate is recorded anywhere.
- **Never assert an age the data lacks.** An invoice with no due date lands in an
  explicit `undated` bucket that is dropped unless it holds money — it is never
  folded into `0-30`.

Note the collision to watch: `--age-3` is the same hex as `--reserved`. With two or
more populated buckets, reserved blue appears with no query active. Acceptable
today; if it reads as noise, re-step the ramp rather than repainting the accent.

## Type

**Archivo**, self-hosted via `next/font/google`, one family for everything.
`font-feature-settings: 'tnum' 1` on `body` plus `tabular-nums` on every figure, so
money and dates align in columns without a second face.

No monospace anywhere. Mono as a costume for "technical" is banned, and tabular
figures do the alignment job it would have been reached for.

Weight carries hierarchy with size; there is currently no width axis (`axes: []`).
A width step is the most available typographic upgrade if the display voice needs
more character.

## Form

- **Radius zero, everywhere, no exceptions.** Square stationery. This includes
  chart data-ends, which override the chart spec's default 4px rounding.
- **Hairline rules instead of cards.** No card containers anywhere, and no nested
  cards. `--rule` for row division, `--rule-strong` for structural seams.
- **Rank by inversion.** The open matter's tab is the only pale plate on the
  bench, so which file is open is legible without reading a word.
- **The gum edge is an interruption, not a protrusion.** The rail's right rule is
  painted by `.rail-ruled::after` and omitted on `.tab-open`, so the line breaks at
  the open file. A negative-margin overhang was tried first and is clipped by the
  nav's scroll container — do not reintroduce it.

## State

**One grammar.** Every state is the same impression: caps over a single 1.5px
struck rule, rotated `-1.1deg`, as a hand-held stamp lands. No borders, because a
border is a container and this world does not put state in a container.

| State | Rendering |
|---|---|
| Overdue | impression, `--stamp` ink, carries the day count |
| Sent | impression, `--ink-2`. Equal weight to paid, never quieter. |
| Paid | impression, `--ink-2` |
| Cancelled | impression plus a rule through the record |
| Draft | a drawn SVG notch (an unpunched corner) plus the impression |

Only urgency varies the ink. Sent is the state the product exists to act on, so it
may not be the quietest thing on a row.

## Interaction

**The query rides over the records.** Typing marks hits in reserved ink and shows
per-client hit counts; it never recolours or reorders the archive, and clearing it
leaves everything where it was. Non-matching tabs dim rather than disappear,
because the rail is the roster and hiding a client would make it lie.

The query field sits at the head of the rail, not the top right, and **above the
responsive split** so it survives at every width. Two instances mount with distinct
ids (`archive-q-narrow` / `archive-q-wide`).

**One authored motion:** `.course-step`, a row settling one line-height with a
single overshoot. Not a fade-up cascade, and the default state is already visible,
so nothing depends on JS to be legible. Gated behind
`prefers-reduced-motion: no-preference`.

## Responsive

**One field dominates.** At narrow widths the rail and the matter are never on
screen together: the rail is the full field until a matter opens, and type stays at
full size rather than shrinking to fit two columns. `?view=all` is how the
cross-client docket is reached there, with `ALL FILES` as the escape.

## Browser surfaces

Themed from the palette, not left to the OS: `::selection`, `caret-color`,
`:focus-visible`, `::-webkit-scrollbar` (track and thumb), `text-underline-offset`,
and tabular numerals. Re-themed inside `.plate-surface` so the document surface
does not inherit the bench's chrome.

## Known gaps

Named rather than hidden, in the order they are worth closing:

1. **No copy-link affordance.** The direction's story ends "finds it, reads it, and
   sends it", and sending currently means selecting the address bar.
2. **No material.** The plate is a flat fill; `--plate-edge` is declared and spent
   only on a scrollbar. A calico grain and a faint bench tooth are this world's own
   materials and cost one asset each.
3. **No legend of marks.** Five state marks and a four-step ramp ship with no key.
4. **`business-settings` is a Payload global**, one row per install, so a second
   owner's document renders the install's single business identity. Correct for one
   operator; the first real blocker to the multi-tenant path.

## Boundary with the admin panel

`src/app/(app)/globals.css` is imported **only** by `src/app/(app)/layout.tsx`.
There is deliberately no shared `src/app/layout.tsx`: two sibling root layouts is
what keeps Tailwind's preflight out of `/admin`, verified by inspecting the shipped
CSS bundles (the admin bundle contains zero Tailwind layer declarations). Style
admin tweaks in `src/app/(payload)/custom.scss` instead.
