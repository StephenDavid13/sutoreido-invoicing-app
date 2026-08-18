import { resolveConnectionString, missingConnectionStringMessage } from '@/lib/db/connection-string'

/** Prints which env var supplied the connection string, masking credentials. */
const found = resolveConnectionString()
if (!found) {
  console.log(missingConnectionStringMessage())
} else {
  const which = ['DATABASE_URI', 'DATABASE_URL', 'POSTGRES_URL'].find(
    (n) => process.env[n]?.trim() === found,
  )
  console.log(`resolved from ${which}: ${found.replace(/\/\/[^@]*@/, '//***:***@')}`)
}
process.exit(0)
