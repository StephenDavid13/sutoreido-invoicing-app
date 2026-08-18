import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * Seeds a working demo: one operator, business settings, two bank accounts, two
 * clients, and a monthly hosting service ready for the billing run.
 *
 * Everything here is FICTIONAL. This file is committed to a public repository, so
 * it must never contain real bank accounts, client names or tax identifiers.
 * To seed your own details instead, set the SEED_* variables in .env (which is
 * gitignored) — anything unset falls back to the demo values below.
 *
 *   npm run seed
 *
 * Safe to re-run: every step is find-or-create.
 */

const env = (key: string, fallback: string) => process.env[key]?.trim() || fallback

// 51 824 753 556 is the Australian Taxation Office's own publicly listed ABN,
// used here purely because it is a real, checksum-valid number that belongs to
// nobody's private business.
const DEMO = {
  adminEmail: env('SEED_ADMIN_EMAIL', 'owner@example.com'),
  adminPassword: env('SEED_ADMIN_PASSWORD', 'ChangeMe-Sutoreido-2026'),
  tradingName: env('SEED_TRADING_NAME', 'Demo Studio'),
  abn: env('SEED_ABN', '51824753556'),
  businessEmail: env('SEED_BUSINESS_EMAIL', 'billing@example.com'),
  auBsb: env('SEED_AU_BSB', '123456'),
  auAccount: env('SEED_AU_ACCOUNT', '12345678'),
  nzAccount: env('SEED_NZ_ACCOUNT', '00-0000-0000000-00'),
  clientA: env('SEED_CLIENT_A', 'Northwind Media'),
  clientB: env('SEED_CLIENT_B', 'Acme Consulting'),
}

async function seed() {
  const payload = await getPayload({ config })

  // ---------------------------------------------------------------- the user
  const existingUsers = await payload.find({ collection: 'users', limit: 1 })
  const user =
    existingUsers.docs[0] ??
    (await payload.create({
      collection: 'users',
      data: {
        email: DEMO.adminEmail,
        password: DEMO.adminPassword,
        name: DEMO.tradingName,
        role: 'admin',
        timezone: 'Australia/Melbourne',
        locale: 'en-AU',
      },
    }))
  console.log(`user           ${user.email} (id ${user.id})`)

  // ------------------------------------------------------------ the business
  await payload.updateGlobal({
    slug: 'business-settings',
    data: {
      tradingName: DEMO.tradingName,
      abn: DEMO.abn,
      email: DEMO.businessEmail,
      // Not GST-registered by default. The ATO forbids the words "tax invoice"
      // and any GST line until you are.
      gstRegistered: false,
      taxJurisdiction: 'AU',
      taxLabel: 'GST',
      numberAllocationMode: 'onSend',
      numberPadding: 0,
    },
  })
  await payload.updateGlobal({ slug: 'invoice-defaults', data: {} })
  console.log('settings       business-settings + invoice-defaults written')

  // --------------------------------------------------------- bank accounts
  const bankSeeds = [
    {
      label: 'Everyday (AUD)',
      currency: 'AUD' as const,
      bsb: DEMO.auBsb,
      accountNumber: DEMO.auAccount,
      isDefault: true,
    },
    {
      label: 'NZ account (NZD)',
      currency: 'NZD' as const,
      accountNumber: DEMO.nzAccount,
      isDefault: true,
    },
  ]
  const banks: Record<string, number> = {}
  for (const data of bankSeeds) {
    const found = await payload.find({
      collection: 'bank-accounts',
      where: { label: { equals: data.label } },
      limit: 1,
    })
    const doc =
      found.docs[0] ??
      (await payload.create({ collection: 'bank-accounts', data: { ...data, owner: user.id } }))
    banks[data.currency] = doc.id as number
    console.log(`bank account   ${data.label}`)
  }

  // ------------------------------------------------------------------ clients
  const clientSeeds = [
    {
      name: DEMO.clientA,
      defaultCurrency: 'NZD' as const,
      defaultPaymentTermsDays: 15,
      defaultQtyLabel: 'Hours' as const,
    },
    {
      name: DEMO.clientB,
      defaultCurrency: 'AUD' as const,
      defaultPaymentTermsDays: 7,
      defaultQtyLabel: 'Qty' as const,
    },
  ]
  const clients: Record<string, number> = {}
  for (const data of clientSeeds) {
    const found = await payload.find({
      collection: 'clients',
      where: { name: { equals: data.name } },
      limit: 1,
    })
    const doc =
      found.docs[0] ??
      (await payload.create({
        collection: 'clients',
        data: { ...data, owner: user.id, defaultDueMode: 'on_receipt', status: 'active' },
      }))
    clients[data.name] = doc.id as number
    console.log(`client         ${data.name}`)
  }

  // ------------------------------------------- a monthly hosting service
  const serviceName = `Hosting — ${DEMO.clientA}`
  const foundService = await payload.find({
    collection: 'services',
    where: { name: { equals: serviceName } },
    limit: 1,
  })
  if (!foundService.docs[0]) {
    await payload.create({
      collection: 'services',
      data: {
        owner: user.id,
        name: serviceName,
        client: clients[DEMO.clientA],
        kind: 'hosting',
        status: 'active',
        currency: 'NZD',
        chargeCents: 15000, // $150.00
        billingPeriod: 'monthly',
        startDate: '2026-08-08T00:00:00.000Z',
        periodsBilled: 0,
        autoGenerate: true,
        autoSend: false,
        lineDescription: `${DEMO.clientA} – Hosting Services`,
        quantityMilli: 1000,
        qtyLabel: 'Hours',
        paymentTermsDays: 15,
        bankAccount: banks['NZD'],
        // Illustrative costs so margin and renewal reminders have something to
        // show. Replace with your real vendor bills.
        costs: [
          {
            vendor: 'Hosting provider',
            description: 'Example plan cost — replace with your own',
            amountCents: 2500,
            currency: 'NZD',
            period: 'monthly',
            notifyDaysBefore: 0,
          },
          {
            vendor: 'Registrar',
            description: 'Example domain renewal — replace with your own',
            amountCents: 3500,
            currency: 'NZD',
            period: 'annually',
            renewsOn: '2026-09-10T00:00:00.000Z',
            notifyDaysBefore: 30,
          },
        ],
      },
    })
    console.log(`service        ${serviceName} (NZD $150/mo, illustrative costs)`)
  } else {
    console.log(`service        ${serviceName} already present`)
  }

  console.log('\nDone. Run `npm run bill` to raise the first hosting invoice.')
  if (DEMO.adminPassword === 'ChangeMe-Sutoreido-2026') {
    console.log('NOTE: change the admin password at /admin before using this for real work.')
  }
}

await seed()
process.exit(0)
