# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: the owner-operator.** A solo freelance web developer running an Australian
sole trader business, billing in AUD and NZD, currently serving four concurrent
clients. Works alone, does his own invoicing and bookkeeping, and is the entire
support team for his own tool. Not currently registered for GST.

He uses this between client work, not as a daily driver: a few minutes at the start
of a month to raise invoices, a glance to see who has not paid, and an occasional
hunt for a document at tax time. Any workflow that assumes daily engagement will
not survive contact with how he actually works.

**Confirmed secondary audiences**, all wanted, none built yet:

- **Clients receiving a tokenised link** with no account: view the invoice, download
  the PDF, see payment details, accept a quote.
- **Clients with real logins**, for invoice history and hosting status.
- **An accountant or bookkeeper**, needing exports or read-only access at tax time.

Whether tokenised links and client logins are sequential or both permanent is
**undecided**. Do not assume one replaces the other.

## Product Purpose

Replaces a hand-maintained Google Docs → PDF invoicing workflow. Invoices are
raised, sent, chased and recorded in one place, and recurring hosting and
maintenance bill themselves.

**Success is that recurring revenue is never missed.** Not "invoices look nicer",
not "invoicing is faster". The manual workflow's specific failure is forgetting to
bill a monthly hosting client, or letting a domain lapse unnoticed. Everything else
this product does is secondary to that.

## Positioning

Freelance invoicing tools are either a PDF generator with no notion of recurring
work, or a full accounting suite priced per seat and built for bookkeepers. This
occupies the gap, with one mechanism a neighbouring invoicing tool could not
truthfully claim: **it models the recurring service as the billable object, and
tracks what that service costs to deliver.** Hosting is not a line item typed each
month; it is a commitment with a charge, a cost, a renewal date, and a margin.

The second differentiator is compliance as behaviour rather than documentation.
Australian GST rules are encoded in what the document is allowed to say, not left to
the operator to remember.

## Operating Context

- **Monthly rhythm.** Recurring hosting and maintenance are billed per calendar
  period. Ad-hoc project work is billed on completion. Billing is a monthly ritual,
  not a continuous activity.
- **Two currencies.** AUD and NZD, per client, never mixed within a document. No
  exchange rate is currently recorded anywhere, so cross-currency totals cannot be
  produced honestly.
- **Three quantity shapes** appear in real invoices: flat monthly fee, day rate, and
  hourly. The quantity column label changes accordingly.
- **Infrastructure carried on clients' behalf.** Hosting plans, domains and CDN sit
  in the operator's name and are rebilled. A missed domain renewal takes a client's
  site down, which is the highest-consequence failure in the whole system.
- **Tax time.** Australian financial year, July to June. Income must be reportable
  and documents retrievable long after they were sent.
- **The admin panel is the current back office.** There is no separate internal
  tooling; PayloadCMS's admin is where records get fixed.

## Capabilities and Constraints

**Built and working:** clients with per-client currency, terms and quantity labels;
invoices with an enforced lifecycle and an immutable audit trail; atomic per-owner
invoice numbering continuing an existing external series; PDF rendering; recurring
services with cost tracking and margin; an idempotent billing run available as both
a command and a scheduled endpoint; renewal warnings; GST posture frozen per
document at issue.

**Planned, not built:** email delivery and due-date reminders; payments and part
payments; a dashboard; quotes and quote-to-invoice conversion; projects, kanban and
time tracking; the client portal.

**Durable constraints:**

- **A sent invoice is a legal document.** Once issued it must not silently change,
  and the archived copy must be the bytes the client actually received, not a
  re-render.
- **Money is exact.** Integer minor units throughout, rounded once at a defined
  point. Approximation is never acceptable, including in reporting.
- **Australian tax rules bind the document.** While not GST-registered, a document
  may not use the words "tax invoice" and may not show a GST line. Crossing the
  registration threshold changes what documents are permitted to say.
- **Per-user tenancy today, organisation-shaped tomorrow.** The owner wants the
  option of other freelancers using this later, without committing now. Avoid
  one-way doors: no design that assumes exactly one user forever, and no self-serve
  signup, plan management or onboarding built speculatively.
- **File uploads require object storage** before logos or archived PDFs work in
  production. Not yet configured.
- **Scheduled work is best-effort.** The production scheduler can fire twice or skip
  a day, so anything that bills or notifies must be idempotent and self-healing.

**Terminology:** a *service* is a recurring commitment (hosting, maintenance, a
retainer), distinct from an invoice *line item*. A *billing run* raises invoices for
periods that have started. *Renewal* refers to a cost the operator carries expiring,
not to a client's subscription.

## Brand Commitments

Named **Sutoreido**. No logo, wordmark, or brand assets exist yet, and none has been
made binding. The business identity that appears on documents (trading name, ABN,
contact, bank accounts) lives in application settings rather than in code, and must
never be committed to the repository, which is public.

## Evidence on Hand

- **Two real issued invoices** are the ground truth for document fidelity: one AUD
  day-rate invoice and one NZD monthly hosting invoice. They disagree with each
  other on column order and on where payment details sit, which is why document
  layout is configuration rather than a fixed template. Both live outside the repo.
- **A predecessor implementation** exists as a separate .NET backend with a written
  system-design document. Its domain model, state machines and PDF layout were
  ported deliberately; two of its defects were identified and fixed.
- **No customers, testimonials, press, benchmarks, pricing, or usage metrics
  exist.** There is one operator and four clients. Future work must not fabricate
  social proof, adoption numbers, or plan pricing.

## Product Principles

1. **Recurring revenue bills itself.** If the operator has to remember something for
   money to arrive, the product has failed at its primary job.
2. **A sent document is frozen.** Immutability of issued invoices outranks
   convenience of editing.
3. **Exact or absent, never approximate.** A confidently wrong number, especially a
   cross-currency total or a margin, is worse than an acknowledged gap.
4. **Compliance is encoded, not documented.** Rules that constrain what a document
   may say are enforced by the system, not left to memory.
5. **No one-way doors on tenancy.** Build for one operator, but never in a way that
   forecloses many.
